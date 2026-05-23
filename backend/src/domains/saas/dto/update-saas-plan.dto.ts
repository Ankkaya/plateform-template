import { PartialType } from '@nestjs/swagger';
import { CreateSaasPlanDto } from './create-saas-plan.dto';

export class UpdateSaasPlanDto extends PartialType(CreateSaasPlanDto) {}
