import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  TenantFacebookConnection,
  FbConnectionMethod,
} from './tenant-facebook-connection.entity';
import { EncryptionService } from '@common/encryption.service';
import { ByoConnectDto } from './dto/byo-connect.dto';

const GRAPH = 'https://graph.facebook.com/v19.0';

export interface FbConnectionStatus {
  connected: boolean;
  connection?: {
    fbPageId: string;
    fbPageName: string;
    connectionMethod: FbConnectionMethod;
    connectedAt: Date;
  };
}

@Injectable()
export class FacebookConnectionService {
  private readonly logger = new Logger(FacebookConnectionService.name);

  constructor(
    @InjectRepository(TenantFacebookConnection)
    private readonly repo: Repository<TenantFacebookConnection>,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  async getStatus(tenantId: string): Promise<FbConnectionStatus> {
    const conn = await this.repo.findOne({ where: { tenantId } });
    if (!conn) return { connected: false };
    return {
      connected: true,
      connection: {
        fbPageId: conn.fbPageId,
        fbPageName: conn.fbPageName,
        connectionMethod: conn.connectionMethod,
        connectedAt: conn.connectedAt,
      },
    };
  }

  getAdminBaseUrl(): string {
    return this.configService.get<string>('app.adminBaseUrl') ?? 'http://localhost:5174';
  }

  /** Builds the Facebook Login for Business OAuth URL. Encodes tenantId+userId in state. */
  buildOAuthUrl(tenantId: string, userId: string): string {
    const appId = this.configService.get<string>('facebook.appId');
    const baseUrl = this.configService.get<string>('app.baseUrl');
    const redirectUri = encodeURIComponent(`${baseUrl}/facebook/callback`);
    const scope = 'pages_show_list,pages_messaging,pages_manage_metadata';
    const state = Buffer.from(`${tenantId}:${userId}`).toString('base64url');
    return (
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`
    );
  }

  /**
   * Exchange OAuth code for a long-lived Page token, store, subscribe webhook.
   * Returns the redirect URL for the admin console.
   */
  async handleOAuthCallback(code: string, state: string): Promise<string> {
    const adminBase = this.getAdminBaseUrl();

    let tenantId: string;
    let userId: string;
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const sep = decoded.indexOf(':');
      tenantId = decoded.slice(0, sep);
      userId = decoded.slice(sep + 1);
    } catch {
      return `${adminBase}/company/fb-leads?error=invalid_state`;
    }

    try {
      const appId = this.configService.get<string>('facebook.appId');
      const appSecret = this.configService.get<string>('facebook.appSecret');
      const baseUrl = this.configService.get<string>('app.baseUrl');
      const redirectUri = `${baseUrl}/facebook/callback`;

      // 1. Exchange code → short-lived user token
      const tokenRes = await axios.get<{ access_token: string }>(
        `${GRAPH}/oauth/access_token`,
        {
          params: {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          },
        },
      );
      const shortLivedToken = tokenRes.data.access_token;

      // 2. Exchange short-lived → long-lived user token
      const longRes = await axios.get<{ access_token: string }>(
        `${GRAPH}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken,
          },
        },
      );
      const longLivedUserToken = longRes.data.access_token;

      // 3. Get list of Pages the user manages
      const pagesRes = await axios.get<{
        data: Array<{ id: string; name: string; access_token: string }>;
      }>(`${GRAPH}/me/accounts`, { params: { access_token: longLivedUserToken } });

      const pages = pagesRes.data.data;
      if (!pages.length) {
        return `${adminBase}/company/fb-leads?error=no_pages`;
      }

      // Use first page (multi-page selector is a Phase 4 refinement)
      const page = pages[0];

      // 4. Store connection (userId decoded from state)
      await this._upsertConnection({
        tenantId,
        connectionMethod: FbConnectionMethod.OAUTH_SHARED_APP,
        fbPageId: page.id,
        fbPageName: page.name,
        pageAccessToken: page.access_token,
        fbAppId: null,
        fbAppSecret: null,
        connectedBy: userId,
      });

      // 5. Subscribe this Page to our shared app's webhook
      await this._subscribePageToWebhook(page.id, page.access_token);

      const pageName = encodeURIComponent(page.name);
      return `${adminBase}/company/fb-leads?connected=true&pageName=${pageName}`;
    } catch (err) {
      this.logger.error(`OAuth callback error: ${String(err)}`);
      return `${adminBase}/company/fb-leads?error=oauth_failed`;
    }
  }

  /** Store BYO-app credentials and create the connection */
  async connectByo(
    tenantId: string,
    userId: string,
    dto: ByoConnectDto,
  ): Promise<FbConnectionStatus> {
    const existing = await this.repo.findOne({ where: { tenantId } });
    if (existing) throw new ConflictException('Facebook Page already connected. Disconnect first.');

    // Check no other tenant owns this page
    const pageOwner = await this.repo.findOne({ where: { fbPageId: dto.pageId } });
    if (pageOwner && pageOwner.tenantId !== tenantId) {
      throw new BadRequestException('This Facebook Page is already connected to another tenant.');
    }

    await this._upsertConnection({
      tenantId,
      connectionMethod: FbConnectionMethod.BYO_APP,
      fbPageId: dto.pageId,
      fbPageName: dto.pageName,
      pageAccessToken: dto.pageAccessToken,
      fbAppId: dto.appId,
      fbAppSecret: dto.appSecret,
      connectedBy: userId,
    });

    return this.getStatus(tenantId);
  }

  async disconnect(tenantId: string): Promise<void> {
    const conn = await this.repo.findOne({ where: { tenantId } });
    if (!conn) throw new NotFoundException('No Facebook Page connected.');
    await this.repo.delete({ tenantId });
  }

  /**
   * Lookup a connection by fb_page_id.
   * Returns the decrypted App Secret for signature verification.
   * Falls back to global FB_APP_SECRET if no connection found.
   */
  async resolveAppSecret(fbPageId: string): Promise<{ tenantId: string; appSecret: string } | null> {
    const conn = await this.repo.findOne({ where: { fbPageId } });
    if (!conn) return null;

    let appSecret: string;
    if (conn.connectionMethod === FbConnectionMethod.BYO_APP && conn.fbAppSecret) {
      appSecret = this.encryption.decrypt(conn.fbAppSecret);
    } else {
      appSecret = this.configService.get<string>('facebook.appSecret') ?? '';
    }

    return { tenantId: conn.tenantId, appSecret };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _upsertConnection(data: {
    tenantId: string;
    connectionMethod: FbConnectionMethod;
    fbPageId: string;
    fbPageName: string;
    pageAccessToken: string;
    fbAppId: string | null;
    fbAppSecret: string | null;
    connectedBy: string;
  }): Promise<void> {
    const encryptedToken = this.encryption.encrypt(data.pageAccessToken);
    const encryptedSecret = data.fbAppSecret
      ? this.encryption.encrypt(data.fbAppSecret)
      : null;

    await this.repo.upsert(
      {
        tenantId: data.tenantId,
        connectionMethod: data.connectionMethod,
        fbPageId: data.fbPageId,
        fbPageName: data.fbPageName,
        pageAccessToken: encryptedToken,
        fbAppId: data.fbAppId,
        fbAppSecret: encryptedSecret,
        connectedBy: data.connectedBy,
      },
      { conflictPaths: ['tenantId'] },
    );
  }

  private async _subscribePageToWebhook(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void> {
    try {
      await axios.post(
        `${GRAPH}/${pageId}/subscribed_apps`,
        null,
        {
          params: {
            subscribed_fields: 'messages,messaging_postbacks',
            access_token: pageAccessToken,
          },
        },
      );
    } catch (err) {
      this.logger.error(`subscribed_apps call failed for page ${pageId}: ${String(err)}`);
      // Non-fatal — tenant can reconnect if needed
    }
  }
}
