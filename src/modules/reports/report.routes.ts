import { Router } from 'express';
import * as controller from './report.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import { downloadReportSchema } from './report.validation';

const router = Router();
router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER));

router.get('/download', validate(downloadReportSchema, 'query'), controller.downloadReport);

export default router;
