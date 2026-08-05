import { Router } from 'express';
import * as controller from './asset-assignment.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import {
  createAssignmentSchema,
  returnAssignmentSchema,
  reportLostSchema,
  revokeSeatSchema,
  listAssignmentsQuerySchema,
} from './asset-assignment.validation';

const router = Router();
router.use(authenticate);

const canManage = authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER);

router.get('/', canManage, validate(listAssignmentsQuerySchema, 'query'), controller.listAssignments);

// ONE creation endpoint for both kinds — branches internally by the referenced asset's kind.
router.post('/', canManage, validate(createAssignmentSchema), controller.assignAsset);

// Kind-specific closure endpoints — the URL itself communicates which kind is expected,
// and the service layer rejects a mismatched record with a clear error either way.
router.patch('/:id/return', canManage, validate(returnAssignmentSchema), controller.returnHardwareAsset);
router.patch('/:id/report-lost', canManage, validate(reportLostSchema), controller.reportHardwareAssetLost);
router.patch('/:id/revoke', canManage, validate(revokeSeatSchema), controller.revokeLicenseSeat);

router.get('/asset/:assetId/history', canManage, controller.getAssetHistory);
router.get('/employee/:employeeId', canManage, controller.getEmployeeAssignments);

export default router;