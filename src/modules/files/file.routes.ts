import { Router } from 'express';
import * as controller from './file.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { upload } from '../../shared/storage';
import { UserRole } from '../user/user.model';

const router = Router();
router.use(authenticate);

const canManage = authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER);

// `upload.single('file')` must run before the controller so req.file is populated
router.post('/upload', canManage, upload.single('file'), controller.uploadFile);
router.delete('/', canManage, controller.deleteFile);
router.get('/signed-url', canManage, controller.getSignedUrl);

export default router;
