import express from 'express';
import {
    createNetworkCode,
    joinNetwork,
    getNetworkUsers,
    blockUser,
    unblockUser,
    getAllConnections,
    getAllNetworkCodes,
    getConnectionsByCodeId,
    debugNetwork,
    toggleBlockNetworkCode,
} from '../controllers/networkController';

import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/debug', debugNetwork);
router.post('/create', protect, admin, createNetworkCode);
router.post('/join', protect, admin, joinNetwork);
router.get('/connections', protect, admin, getAllConnections);
router.get('/all', protect, admin, getAllNetworkCodes);
router.get('/:codeId/connections', protect, admin, getConnectionsByCodeId);
router.get('/:code/users', protect, admin, getNetworkUsers);
router.put('/block/:connectionId', protect, admin, blockUser);
router.put('/unblock/:connectionId', protect, admin, unblockUser);
router.put('/:id/toggle-block', protect, admin, toggleBlockNetworkCode);

export default router;
