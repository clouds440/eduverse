import { IsArray, IsString } from 'class-validator';

export class AssignBuildingDepartmentsDto {
  @IsArray()
  @IsString({ each: true })
  departmentIds: string[];
}
