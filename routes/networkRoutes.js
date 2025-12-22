const express = require('express');
const router = express.Router();
const networkController = require('../controllers/networkController');

const { protect, admin } = require('../middleware/authMiddleware');

// Get all users
router.get('/all', protect, admin, networkController.getAllUsers);

// Get connections
router.get('/connections', protect, admin, networkController.getConnections);

// Get connections by network code
router.get('/:codeId/connections', protect, admin, networkController.getConnectionsByCode);

// Block/Unblock
router.put('/block/:id', protect, admin, networkController.blockUser);
router.put('/unblock/:id', protect, admin, networkController.unblockUser);

module.exports = router;

