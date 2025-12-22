import express from 'express';
import multer from 'multer';
import {
    createEvent,
    getEvents,
    getEventById,
    getEventThumbnail,
    getVerifiedEvents,
    getPendingEvents,
    approveEvent,
    rejectEvent,
    deleteEvent,
    toggleEventStatus
} from '../controllers/eventController';

import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Configure Multer for memory storage (files kept in memory as buffers)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// Create Event
router.post('/create', protect, admin, upload.array('images', 5), createEvent);
router.post('/', protect, admin, createEvent);

// Get All Events
router.get('/', protect, admin, getEvents);

// Get Verified Events
router.get('/verified', protect, admin, getVerifiedEvents);

// Get Pending Events
router.get('/pending', protect, admin, getPendingEvents);

// Get Single Event
router.get('/:id', protect, admin, getEventById);

// Get Event Thumbnail (Public? or Admin? Let's keep it protected for now to be safe, or public if needed for rendering images securely? Usually images are public URLs)
// But this is an API endpoint returning a URL. 
router.get('/:id/thumbnail', protect, admin, getEventThumbnail);

// Approve Event
router.put('/approve/:id', protect, admin, approveEvent);

// Toggle Event Status
router.put('/:id/toggle-status', protect, admin, toggleEventStatus);

// Reject Event
router.delete('/reject/:id', protect, admin, rejectEvent);

// Delete Event
router.delete('/:id', protect, admin, deleteEvent);

export default router;
