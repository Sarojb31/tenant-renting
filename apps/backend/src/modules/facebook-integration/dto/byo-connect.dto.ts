import { IsNotEmpty, IsString } from 'class-validator';

export class ByoConnectDto {
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @IsString()
  @IsNotEmpty()
  pageName!: string;

  @IsString()
  @IsNotEmpty()
  pageAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  appId!: string;

  @IsString()
  @IsNotEmpty()
  appSecret!: string;
}
