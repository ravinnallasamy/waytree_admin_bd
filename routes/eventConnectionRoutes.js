const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get connections for a specific event
router.get('/:id', protect, admin, eventController.getEventConnections);

module.exports = router;
