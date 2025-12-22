import express from 'express';
import { registerAdmin, getAllAdmins, deleteAdmin } from '../controllers/adminUserController';
import { protect, superadminOnly } from '../middleware/authMiddleware';

const router = express.Router();

// Only superadmins can manage other admins
router.get('/', protect, superadminOnly, getAllAdmins);
router.post('/register', protect, superadminOnly, registerAdmin); // Protect registration as well
router.delete('/:id', protect, superadminOnly, deleteAdmin);

export default router;
