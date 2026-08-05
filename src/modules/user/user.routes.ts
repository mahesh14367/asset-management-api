import { Router } from 'express';
import * as userController from './user.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from './user.model';
import {
  updateUserSchema,
  updateRoleSchema,
  changePasswordSchema,
  listUsersQuerySchema,
} from './user.validation';

const router = Router();

// router.post('/', validate(createUserSchema), userController.createUser);

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
router.patch(
  '/:id/role',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateRoleSchema),
  userController.updateUserRole
);

export default router;