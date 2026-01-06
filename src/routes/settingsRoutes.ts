import express from 'express';
import {
    getMySettings,
    updateMySettings,
    getPlatformSettings,
    updatePlatformSettings
} from '../controllers/settingsController';
import { protect, admin, superadminOnly } from '../middleware/authMiddleware';

const router = express.Router();

// User Preferences (All authenticated admins)
router.get('/me', protect, getMySettings);
router.put('/me', protect, updateMySettings);

// Platform Configuration (Superadmin only, or Admin depending on policy. Let's say Admin generally for now)
// Assuming sensitive global settings might need restricted access, but for this task "Admin" is sufficient.
router.get('/platform', protect, admin, getPlatformSettings);
router.put('/platform', protect, admin, updatePlatformSettings);

export default router;
