import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { resolve } from 'path';

// DATABASE_URL is injected by dotenv-cli in the migration:* npm scripts
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [resolve(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [resolve(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
