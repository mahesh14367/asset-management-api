import { Router } from 'express';
import * as userController from './user.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from './user.model';
import {
  createUserSchema,
  updateUserSchema,
  updateRoleSchema,
  updateStatusSchema,
  changePasswordSchema,
  listUsersQuerySchema,
} from './user.validation';

const router = Router();

// All routes below require authentication
router.use(authenticate);

// ---- Self-service (any authenticated user) ----
router.patch('/me', validate(updateUserSchema), userController.updateOwnProfile);
router.patch('/me/password', validate(changePasswordSchema), userController.changeOwnPassword);

// ---- Admin-only user management ----
router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers
);
router.get('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER), userController.getUser);
router.post('/', authorize(UserRole.SUPER_ADMIN), validate(createUserSchema), userController.createUser);
router.patch('/:id', authorize(UserRole.SUPER_ADMIN), validate(updateUserSchema), userController.updateUser);
router.patch(
  '/:id/role',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateRoleSchema),
  userController.updateUserRole
);
router.patch(
  '/:id/status',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateStatusSchema),
  userController.updateUserStatus
);

export default router;