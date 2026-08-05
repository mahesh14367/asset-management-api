import { Router } from 'express';
import * as controller from './maintenance.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import {
  createMaintenanceSchema,
  completeMaintenanceSchema,
  cancelMaintenanceSchema,
  listMaintenanceQuerySchema,
} from './maintenance.validation';

const router = Router();
router.use(authenticate);

const canManage = authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER);

router.get('/', canManage, validate(listMaintenanceQuerySchema, 'query'), controller.listMaintenance);

router.post('/', canManage, validate(createMaintenanceSchema), controller.openMaintenance);

router.get('/:id', canManage, controller.getMaintenanceById);
router.patch('/:id/complete', canManage, validate(completeMaintenanceSchema), controller.completeMaintenance);
router.patch('/:id/cancel', canManage, validate(cancelMaintenanceSchema), controller.cancelMaintenance);

router.get('/asset/:assetId/history', canManage, controller.getAssetMaintenanceHistory);

export default router;
