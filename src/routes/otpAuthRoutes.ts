import express, { Request, Response } from 'express';
import { requestOtp, verifyOtp } from '../controllers/otpAuthController';
import {
    generateAccessToken,
    verifyRefreshToken,
    deleteRefreshToken,
    deleteAllUserRefreshTokens,
    getUserSessions,
    deleteRefreshTokenByDevice,
} from '../services/tokenService';
import AdminUser from '../models/AdminUser';

const router = express.Router();

// OTP-based authentication routes
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken || typeof refreshToken !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token is required',
            });
        }

        const userData = await verifyRefreshToken(refreshToken);

        if (!userData) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token',
            });
        }

        // Check if admin user still exists and is not blocked
        const adminUser = await AdminUser.findById(userData.userId);
        if (!adminUser) {
            await deleteAllUserRefreshTokens(userData.userId);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Admin user not found',
            });
        }

        // Generate new access token
        const accessToken = generateAccessToken(userData.userId, userData.email);

        res.status(200).json({
            accessToken,
        });
    } catch (error: any) {
        console.error('❌ [AUTH] Error in refresh:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to refresh token',
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout and delete refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken || typeof refreshToken !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token is required',
            });
        }

        await deleteRefreshToken(refreshToken);

        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error: any) {
        console.error('❌ [AUTH] Error in logout:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to logout',
        });
    }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken || typeof refreshToken !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token is required',
            });
        }

        const userData = await verifyRefreshToken(refreshToken);

        if (!userData) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token',
            });
        }

        await deleteAllUserRefreshTokens(userData.userId);

        res.status(200).json({
            success: true,
            message: 'Logged out from all devices successfully',
        });
    } catch (error: any) {
        console.error('❌ [AUTH] Error in logout-all:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to logout from all devices',
        });
    }
});

export default router;
