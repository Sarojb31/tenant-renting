import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerFavorite } from './customer-favorite.entity';
import { Listing } from '../listings/listing.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerFavorite, Listing])],
  providers: [FavoritesService],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
