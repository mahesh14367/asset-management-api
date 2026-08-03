import { Router } from 'express';
import * as employeeController from './employee.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmploymentStatusSchema,
  grantAccessSchema,
  listEmployeesQuerySchema,
} from './employee.validation';

const router = Router();

router.use(authenticate);

// ---- Self-service (any authenticated user with a linked employee profile) ----
router.get('/me', employeeController.getMyProfile);

// ---- Read access: SUPER_ADMIN (full HR control) + ASSET_MANAGER (needed to assign assets to people) ----
router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(listEmployeesQuerySchema, 'query'),
  employeeController.listEmployees
);
router.get('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER), employeeController.getEmployee);

// ---- Write access: SUPER_ADMIN only (HR/IT provisioning functions) ----
router.post('/', authorize(UserRole.SUPER_ADMIN), validate(createEmployeeSchema), employeeController.createEmployee);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);
router.patch(
  '/:id/employment-status',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateEmploymentStatusSchema),
  employeeController.updateEmploymentStatus
);
router.post(
  '/:id/grant-access',
  authorize(UserRole.SUPER_ADMIN),
  validate(grantAccessSchema),
  employeeController.grantSystemAccess
);
router.post('/:id/revoke-access', authorize(UserRole.SUPER_ADMIN), employeeController.revokeSystemAccess);

export default router;