import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Or } from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly repo: Repository<SupportTicket>,
  ) {}

  create(tenantId: string, userId: string, dto: CreateSupportTicketDto): Promise<SupportTicket> {
    return this.repo.save(
      this.repo.create({
        tenantId,
        raisedByUserId: userId,
        subject: dto.subject,
        description: dto.description,
      }),
    );
  }

  findAllForTenant(tenantId: string): Promise<SupportTicket[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  findAllPlatform(): Promise<SupportTicket[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto): Promise<SupportTicket> {
    const ticket = await this.repo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = dto.status;
    return this.repo.save(ticket);
  }
}
