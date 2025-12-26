import express from 'express';
import { registerUser, getUserDetails, getAllUsers, toggleBlockUser, getUserStats, getAllUsersPaginated, updateUserDetails, deleteUser } from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);

// Specific routes MUST be before parameterized routes (/:id)
router.get('/stats/overview', protect, admin, getUserStats); // Get user statistics
router.get('/all', protect, admin, getAllUsersPaginated); // Get all users with pagination and search
router.get('/', protect, admin, getAllUsers); // Get All Users (alternative endpoint)

// Parameterized routes MUST be after specific routes
router.get('/:id', protect, admin, getUserDetails);
router.put('/:id', protect, admin, updateUserDetails);
router.delete('/:id', protect, admin, deleteUser);
router.put('/:id/toggle-block', protect, admin, toggleBlockUser);

export default router;
