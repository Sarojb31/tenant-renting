import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { SmsTemplatesService } from './sms-templates.service';
import { SmsTemplate } from './sms-template.entity';
import { SmsTemplateEvent } from '@common/enums/sms-template-event.enum';

const ctx = { getRequiredTenantId: () => 'tenant-1' };

function makeTemplate(overrides: Partial<SmsTemplate> = {}): SmsTemplate {
  return {
    id: 'tmpl-1',
    tenantId: 'tenant-1',
    name: 'Match Alert',
    bodyText: 'New room in {city} for {rentAmount}!',
    eventTrigger: SmsTemplateEvent.NEW_MATCH,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SmsTemplate;
}

function buildSvc(repoOverrides: Partial<Repository<SmsTemplate>> = {}): SmsTemplatesService {
  const repo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((x) => x),
    save: jest.fn().mockImplementation(async (x) => ({ id: 'new-id', ...x })),
    remove: jest.fn().mockResolvedValue(undefined),
    ...repoOverrides,
  } as unknown as Repository<SmsTemplate>;
  return new SmsTemplatesService(repo, ctx as never);
}

describe('SmsTemplatesService.findAll', () => {
  it('returns tenant templates with isDefault flag', async () => {
    const tenantTmpl = makeTemplate();
    const platformTmpl = makeTemplate({ id: 'platform-1', tenantId: null });
    const svc = buildSvc({ find: jest.fn().mockResolvedValue([tenantTmpl, platformTmpl]) });
    const result = await svc.findAll();
    expect(result).toHaveLength(2);
    expect(result.find((t) => t.id === 'tmpl-1')!.isDefault).toBe(false);
    expect(result.find((t) => t.id === 'platform-1')!.isDefault).toBe(true);
  });
});

describe('SmsTemplatesService.create', () => {
  it('creates template with tenant id', async () => {
    const svc = buildSvc();
    const result = await svc.create({ name: 'Alert', bodyText: 'Hi {city}', eventTrigger: SmsTemplateEvent.CUSTOM });
    expect(result.tenantId).toBe('tenant-1');
    expect(result.name).toBe('Alert');
  });
});

describe('SmsTemplatesService.update', () => {
  it('updates tenant-owned template', async () => {
    const tmpl = makeTemplate();
    const svc = buildSvc({ findOne: jest.fn().mockResolvedValue(tmpl) });
    const result = await svc.update('tmpl-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('throws ForbiddenException for platform default', async () => {
    const svc = buildSvc({
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeTemplate({ tenantId: null })),
    });
    await expect(svc.update('platform-1', { name: 'x' })).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException for unknown template', async () => {
    const svc = buildSvc({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(svc.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
  });
});

describe('SmsTemplatesService.remove', () => {
  it('deletes tenant-owned template', async () => {
    const removeFn = jest.fn().mockResolvedValue(undefined);
    const svc = buildSvc({ findOne: jest.fn().mockResolvedValue(makeTemplate()), remove: removeFn });
    await svc.remove('tmpl-1');
    expect(removeFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'tmpl-1' }));
  });

  it('throws ForbiddenException for platform default', async () => {
    const svc = buildSvc({
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeTemplate({ tenantId: null })),
    });
    await expect(svc.remove('platform-1')).rejects.toThrow(ForbiddenException);
  });
});
