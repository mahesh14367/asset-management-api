import { Router } from 'express';
import * as auditLogController from './audit-log.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import { listAuditLogsQuerySchema } from './audit-log.validation';

const router = Router();

// The audit trail itself is one of the most sensitive things in the system —
// restrict it to SUPER_ADMIN only, no exceptions for ASSET_MANAGER here.
router.use(authenticate, authorize(UserRole.SUPER_ADMIN));

router.get('/', validate(listAuditLogsQuerySchema, 'query'), auditLogController.listAuditLogs);
router.get('/:entityType/:entityId', auditLogController.getEntityHistory);

export default router;