import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { SmsTemplate } from './sms-template.entity';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';

export interface SmsTemplateWithMeta extends SmsTemplate {
  isDefault: boolean;
}

@Injectable()
export class SmsTemplatesService {
  constructor(
    @InjectRepository(SmsTemplate)
    private readonly repo: Repository<SmsTemplate>,
    private readonly ctx: TenantContextService,
  ) {}

  // Returns tenant's own templates + platform defaults (tenantId = null)
  async findAll(): Promise<SmsTemplateWithMeta[]> {
    const tenantId = this.ctx.getRequiredTenantId();
    const rows = await this.repo.find({
      where: [{ tenantId }, { tenantId: IsNull() }],
      order: { eventTrigger: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => ({ ...r, isDefault: r.tenantId === null }));
  }

  async findOne(id: string): Promise<SmsTemplateWithMeta> {
    const tenantId = this.ctx.getRequiredTenantId();
    const row = await this.repo.findOne({ where: [{ id, tenantId }, { id, tenantId: IsNull() }] });
    if (!row) throw new NotFoundException('SMS template not found');
    return { ...row, isDefault: row.tenantId === null };
  }

  async create(dto: CreateSmsTemplateDto): Promise<SmsTemplate> {
    const tenantId = this.ctx.getRequiredTenantId();
    const template = this.repo.create({ ...dto, tenantId });
    return this.repo.save(template);
  }

  async update(id: string, dto: UpdateSmsTemplateDto): Promise<SmsTemplate> {
    const tenantId = this.ctx.getRequiredTenantId();
    const template = await this.repo.findOne({ where: { id, tenantId } });
    if (!template) {
      // Check if it's a platform default (read-only)
      const isDefault = await this.repo.findOne({ where: { id, tenantId: IsNull() } });
      if (isDefault) throw new ForbiddenException('Platform default templates cannot be edited');
      throw new NotFoundException('SMS template not found');
    }
    Object.assign(template, dto);
    return this.repo.save(template);
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.ctx.getRequiredTenantId();
    const template = await this.repo.findOne({ where: { id, tenantId } });
    if (!template) {
      const isDefault = await this.repo.findOne({ where: { id, tenantId: IsNull() } });
      if (isDefault) throw new ForbiddenException('Platform default templates cannot be deleted');
      throw new NotFoundException('SMS template not found');
    }
    await this.repo.remove(template);
  }
}
