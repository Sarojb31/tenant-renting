import { NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { SupportService } from './support.service';
import { SupportTicket } from './support-ticket.entity';
import { SupportTicketStatus } from '@common/enums/support-ticket-status.enum';

function makeRepo(overrides: Partial<Repository<SupportTicket>> = {}): Repository<SupportTicket> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    create: jest.fn().mockImplementation((x) => x),
    ...overrides,
  } as unknown as Repository<SupportTicket>;
}

function buildSvc(repo: Partial<Repository<SupportTicket>> = {}) {
  return new SupportService(makeRepo(repo));
}

describe('SupportService.create', () => {
  it('saves ticket with correct fields', async () => {
    const repo = makeRepo();
    const svc = new SupportService(repo);
    await svc.create('tenant-1', 'user-1', { subject: 'Bug report', description: 'Details here' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', raisedByUserId: 'user-1', subject: 'Bug report' }),
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('SupportService.findAllForTenant', () => {
  it('returns tickets for the correct tenant', async () => {
    const tickets = [{ id: 't-1', tenantId: 'tenant-1' }];
    const repo = makeRepo({ find: jest.fn().mockResolvedValue(tickets) });
    const svc = new SupportService(repo);
    const result = await svc.findAllForTenant('tenant-1');
    expect(result).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });
});

describe('SupportService.updateStatus', () => {
  it('updates status to resolved', async () => {
    const ticket = { id: 'ticket-1', status: SupportTicketStatus.OPEN } as SupportTicket;
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(ticket) });
    const svc = new SupportService(repo);
    await svc.updateStatus('ticket-1', { status: SupportTicketStatus.RESOLVED });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SupportTicketStatus.RESOLVED }),
    );
  });

  it('throws NotFoundException when ticket not found', async () => {
    const svc = buildSvc({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(
      svc.updateStatus('missing-id', { status: SupportTicketStatus.CLOSED }),
    ).rejects.toThrow(NotFoundException);
  });
});
