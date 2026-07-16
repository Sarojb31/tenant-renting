import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum FbConnectionMethod {
  OAUTH_SHARED_APP = 'oauth_shared_app',
  BYO_APP = 'byo_app',
}

@Entity('tenant_facebook_connections')
export class TenantFacebookConnection {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({
    name: 'connection_method',
    type: 'enum',
    enum: FbConnectionMethod,
    default: FbConnectionMethod.OAUTH_SHARED_APP,
  })
  connectionMethod!: FbConnectionMethod;

  @Column({ name: 'fb_page_id' })
  fbPageId!: string;

  @Column({ name: 'fb_page_name' })
  fbPageName!: string;

  @Column({ name: 'page_access_token', type: 'text' })
  pageAccessToken!: string;

  @Column({ name: 'fb_app_id', type: 'varchar', nullable: true })
  fbAppId!: string | null;

  @Column({ name: 'fb_app_secret', type: 'text', nullable: true })
  fbAppSecret!: string | null;

  @Column({ name: 'connected_by', type: 'uuid' })
  connectedBy!: string;

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt!: Date;

  @Column({ name: 'token_expires_at', type: 'timestamp', nullable: true })
  tokenExpiresAt!: Date | null;
}
