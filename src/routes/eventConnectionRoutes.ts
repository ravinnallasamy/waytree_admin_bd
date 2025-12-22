import express from 'express';
import { getAllEvents, getEventConnections } from '../controllers/eventConnectionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Get all events
router.get('/events', protect, admin, getAllEvents);

// Get connections for a specific event
router.get('/:eventId/connections', protect, admin, getEventConnections);

export default router;

