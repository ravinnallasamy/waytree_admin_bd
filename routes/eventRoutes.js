const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get all verified events (Public? Or Admin only? Assuming Admin for backend)
router.get('/verified', protect, admin, eventController.getVerifiedEvents);

// Get all pending events
router.get('/pending', protect, admin, eventController.getPendingEvents);

// Approve event
router.put('/approve/:id', protect, admin, eventController.approveEvent);

// Reject event
router.delete('/reject/:id', protect, admin, eventController.rejectEvent);

// Create event (Admin creates?)
router.post('/', protect, admin, eventController.createEvent);

// Get event connections - This needs to come before :id to avoid conflict
router.get('/:id/connections', protect, admin, eventController.getEventConnections);

// Get event thumbnail
router.get('/:id/thumbnail', protect, admin, eventController.getEventThumbnail);

// Get event by ID - This should be the last route to avoid conflicts
router.get('/:id', protect, admin, eventController.getEventById);

// Toggle Event Status
router.put('/:id/toggle-status', protect, admin, eventController.toggleEventStatus);

// Delete Event
router.delete('/:id', protect, admin, eventController.deleteEvent);

module.exports = router;
