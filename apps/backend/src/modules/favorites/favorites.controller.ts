import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

interface AuthReq {
  user: { sub: string; tenantId: string };
}

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() dto: CreateFavoriteDto, @Req() req: AuthReq) {
    return this.service.add(req.user.tenantId, req.user.sub, dto);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('listingId') listingId: string, @Req() req: AuthReq) {
    return this.service.remove(req.user.tenantId, req.user.sub, listingId);
  }

  @Get()
  listIds(@Req() req: AuthReq) {
    return this.service.listIds(req.user.tenantId, req.user.sub);
  }

  @Get('listings')
  listWithListings(@Req() req: AuthReq) {
    return this.service.listWithListings(req.user.tenantId, req.user.sub);
  }
}
