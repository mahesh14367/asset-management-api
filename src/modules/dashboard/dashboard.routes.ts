import { Router } from 'express';
import * as controller from './dashboard.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { UserRole } from '../user/user.model';

const router = Router();
router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.ASSET_MANAGER));

router.get('/stats', controller.getStats);
router.get('/charts', controller.getCharts);
router.get('/kpis', controller.getKPIs);

export default router;
