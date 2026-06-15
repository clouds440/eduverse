import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { INSIGHT_TIME_RANGES, type InsightTimeRange } from '../shared/insights-date.util';

export enum InsightQueryInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class InsightsQueryDto {
  @IsIn(INSIGHT_TIME_RANGES)
  @IsOptional()
  range?: InsightTimeRange;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsEnum(InsightQueryInterval)
  @IsOptional()
  interval?: InsightQueryInterval;

  @IsString()
  @IsOptional()
  studentId?: string;
}

export class FinanceInsightsQueryDto extends InsightsQueryDto {

  @IsString()
  @IsOptional()
  currency?: string;
}
