import express from 'express';
import multer from 'multer';
import {
    getAllEvents,
    getEventConnections,
    addManualMember,
    uploadMembersExcel,
    updateMember,
    deleteMember
} from '../controllers/eventConnectionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all verified circles (Events/Communities)
router.get('/events', protect, admin, getAllEvents);

// Get members for a specific circle
router.get('/:eventId/connections', protect, admin, getEventConnections);

// Add member manually
router.post('/add-member', protect, admin, addManualMember);

// Upload members from Excel
router.post('/upload-members', protect, admin, upload.single('file'), uploadMembersExcel);

// Update member
router.put('/members/:memberId', protect, admin, updateMember);

// Delete member
router.delete('/members/:memberId', protect, admin, deleteMember);

export default router;
