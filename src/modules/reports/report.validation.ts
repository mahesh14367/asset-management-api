import Joi from 'joi';
import { ReportType, ReportFormat } from './report.service';
import { AssetCategory } from '../asset/asset.model';

export const downloadReportSchema = Joi.object({
  type:      Joi.string().valid(...Object.values(ReportType)).required(),
  format:    Joi.string().valid(...Object.values(ReportFormat)).required(),
  status:    Joi.string().trim(),
  category:  Joi.string().valid(...Object.values(AssetCategory)),
  startDate: Joi.date().iso(),
  endDate:   Joi.date().iso().min(Joi.ref('startDate')),
});
