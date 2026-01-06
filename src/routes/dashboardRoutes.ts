import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Get aggregated dashboard statistics
// Protected by admin authentication
router.get('/stats', protect, admin, getDashboardStats);

export default router;
