import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { AmenitiesService } from './amenities.service';
import { AmenityCategory } from '@common/enums/amenity-category.enum';
import { PublicTenant } from '@common/decorators/roles.decorator';

class AmenityFilterDto {
  @IsOptional()
  @IsEnum(AmenityCategory)
  category?: AmenityCategory;
}

@ApiTags('amenities')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly service: AmenitiesService) {}

  @ApiOperation({ summary: 'List amenities (optionally filtered by category)' })
  @PublicTenant()
  @Get()
  findAll(@Query() query: AmenityFilterDto) {
    return this.service.findAll(query.category);
  }
}
