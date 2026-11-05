import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPatientsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export const ROUTES = ['Oral', 'Topical', 'Inhaled', 'Subcutaneous', 'Intramuscular', 'Intravenous', 'Sublingual', 'Ophthalmic'] as const;

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  drugName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  dosage: string;

  @IsIn(ROUTES)
  route: (typeof ROUTES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  frequency: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  refills?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
