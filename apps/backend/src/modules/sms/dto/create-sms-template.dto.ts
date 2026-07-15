import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SmsTemplateEvent } from '@common/enums/sms-template-event.enum';

export class CreateSmsTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  bodyText!: string;

  @IsEnum(SmsTemplateEvent)
  eventTrigger!: SmsTemplateEvent;
}
