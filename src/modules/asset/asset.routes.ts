import { Router } from 'express';
import * as assetController from './asset.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';
import { upload } from '../../shared/storage';
import {
  createAssetSchema,
  updateAssetSchema,
  updateAssetStatusSchema,
  listAssetsQuerySchema,
} from './asset.validation';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(listAssetsQuerySchema, 'query'),
  assetController.listAssets
);
router.get('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER), assetController.getAsset);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(createAssetSchema),
  assetController.createAsset
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(updateAssetSchema),
  assetController.updateAsset
);
router.patch(
  '/:id/status',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  validate(updateAssetStatusSchema),
  assetController.updateAssetStatus
);
router.post(
  '/:id/attachments',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  upload.single('file'),
  assetController.addAttachment
);
router.delete(
  '/:id/attachments',
  authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER),
  assetController.deleteAttachment
);

export default router;