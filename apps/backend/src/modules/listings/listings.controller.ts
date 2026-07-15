import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ListingsService, ListingPage } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { JwtPayload } from '@modules/auth/strategies/jwt.strategy';

const STAFF_ROLES = [UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT];

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @ApiOperation({ summary: 'List published listings for this tenant (cursor-paginated, filterable)' })
  @Get()
  findAll(@Query() filters: ListingFilterDto): Promise<ListingPage> {
    return this.listingsService.findAll(filters);
  }

  @ApiOperation({ summary: 'Admin: list all listings for this tenant (all statuses, offset-paginated)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Get('admin/all')
  findAllAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('city') city?: string,
  ) {
    return this.listingsService.findAllAdmin({ page, limit, status, city });
  }

  @ApiOperation({ summary: 'Get a single listing (public)' })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Listing> {
    const listing = await this.listingsService.findOne(id);
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  @ApiOperation({ summary: 'Create a listing (Staff/Admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post()
  create(
    @Body() dto: CreateListingDto,
    @Req() req: Request,
  ): Promise<Listing> {
    const user = req.user as JwtPayload;
    return this.listingsService.create(dto, user.sub);
  }

  @ApiOperation({ summary: 'Update a listing (Staff/Admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<Listing> {
    return this.listingsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a listing (Staff/Admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<Listing> {
    return this.listingsService.archive(id);
  }

  @ApiOperation({ summary: 'Upload images to a listing (Staff/Admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  addImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ListingImage[]> {
    return this.listingsService.addImages(id, files);
  }
}
