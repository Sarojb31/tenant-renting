import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { TenantContextService } from '@common/tenant-context.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly service: ReviewsService,
    private readonly ctx: TenantContextService,
  ) {}

  /** POST /reviews — any authenticated user (customer) can submit a review */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateReviewDto,
    @Req() req: { user: { sub: string; tenantId: string } },
  ) {
    const tenantId = req.user.tenantId;
    const customerId = req.user.sub;
    return this.service.create(tenantId, customerId, dto);
  }

  /** GET /reviews/listing/:listingId — public, tenant resolved from context */
  @Get('listing/:listingId')
  getByListing(@Param('listingId') listingId: string) {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.findByListing(tenantId, listingId);
  }
}
