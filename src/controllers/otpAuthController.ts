import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import OtpRequest from '../models/OtpRequest';
import AdminUser from '../models/AdminUser';

/**
 * Generate OTP - Always 123456 for admin (development mode)
 */
const generateOtp = (): string => {
    return '123456'; // Static OTP for admin
};

/**
 * Hash OTP for secure storage
 */
const hashOtp = async (otp: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(otp, salt);
};

/**
 * Verify OTP against hash
 */
const verifyOtpHash = async (otp: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(otp, hash);
};

/**
 * Generate JWT token
 */
const generateJwt = (userId: string, email: string): string => {
    const payload = { id: userId, email };
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d',
    });
};

/**
 * POST /api/auth/request-otp
 * Request OTP for admin login
 */
export const requestOtp = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        console.log('📧 [OTP] Request OTP for:', email);

        // Validate email
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email is required',
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid email format',
            });
        }

        // Check if admin user exists
        const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });
        if (!adminUser) {
            console.log('❌ [OTP] Admin user not found:', email);
            return res.status(404).json({
                error: 'Not Found',
                message: 'Admin user not found. Please contact support.',
            });
        }

        // Generate OTP
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP request
        await OtpRequest.create({
            email: email.toLowerCase(),
            otpHash,
            expiresAt,
            consumed: false,
        });

        console.log('================================================');
        console.log(`📧 [ADMIN OTP] OTP for ${email}: ${otp}`);
        console.log(`Expires at: ${expiresAt.toISOString()}`);
        console.log('================================================');

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
        });
    } catch (error: any) {
        console.error('❌ [OTP] Error in request-otp:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to process OTP request',
        });
    }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return access token + refresh token + admin info
 */
export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp, deviceId, deviceInfo, logoutFromOtherDevices } = req.body;

        console.log('🔍 [OTP] Verifying OTP for:', email, 'OTP:', otp);

        // Validate inputs
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email is required',
            });
        }

        if (!otp || typeof otp !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'OTP is required',
            });
        }

        // Find the latest OTP request
        const otpRequest = await OtpRequest.findOne({ email: email.toLowerCase() })
            .sort({ createdAt: -1 })
            .exec();

        if (!otpRequest) {
            console.log('❌ [OTP] No OTP request found');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid or expired code',
            });
        }

        // Check if expired
        if (otpRequest.expiresAt < new Date()) {
            console.log('❌ [OTP] OTP expired');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'OTP has expired',
            });
        }

        // Check if already consumed
        if (otpRequest.consumed) {
            console.log('❌ [OTP] OTP already used');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'OTP already used',
            });
        }

        // Verify OTP
        const isValid = await verifyOtpHash(otp, otpRequest.otpHash);
        if (!isValid) {
            console.log('❌ [OTP] Invalid OTP');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid code',
            });
        }

        // Get admin user
        const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });
        if (!adminUser) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Admin user not found',
            });
        }

        const userId = adminUser._id.toString();
        const ipAddress = req.ip || req.socket.remoteAddress || undefined;

        // Import token service
        const {
            generateAccessToken,
            createRefreshToken,
            hasActiveSession,
            deleteRefreshTokenByDevice,
            getUserSessions,
        } = await import('../services/tokenService');

        // Check for existing session on different device
        const hasOtherDeviceSession = deviceId
            ? await hasActiveSession(userId, deviceId)
            : false;
        const hasAnySession = await hasActiveSession(userId);

        if (hasAnySession && !hasOtherDeviceSession && !logoutFromOtherDevices) {
            // User is already logged in on another device
            // Don't mark OTP as consumed yet - allow retry with logoutFromOtherDevices
            const sessions = await getUserSessions(userId);
            console.log('⚠️ [OTP] User already logged in on another device');
            return res.status(409).json({
                error: 'Conflict',
                message: 'You are already logged in on another device',
                sessions: sessions.map((s) => ({
                    deviceId: s.deviceId,
                    deviceInfo: s.deviceInfo,
                    ipAddress: s.ipAddress,
                    createdAt: s.createdAt,
                })),
                canLogoutFromOtherDevices: true,
            });
        }

        // If user wants to logout from other devices, delete all other refresh tokens
        if (logoutFromOtherDevices && deviceId) {
            const allSessions = await getUserSessions(userId);
            for (const session of allSessions) {
                if (session.deviceId && session.deviceId !== deviceId) {
                    await deleteRefreshTokenByDevice(userId, session.deviceId);
                }
            }
        }

        // Mark OTP as consumed only after all checks pass and before generating tokens
        otpRequest.consumed = true;
        await otpRequest.save();

        // Generate tokens
        const accessToken = generateAccessToken(userId, adminUser.email);
        const refreshToken = await createRefreshToken(
            userId,
            deviceId,
            deviceInfo,
            ipAddress
        );

        console.log('✅ [OTP] Login successful for:', email);

        res.status(200).json({
            accessToken,
            refreshToken,
            user: {
                _id: adminUser._id,
                email: adminUser.email,
                name: adminUser.name,
                photoUrl: adminUser.photoUrl,
                role: adminUser.role,
            },
        });
    } catch (error: any) {
        console.error('❌ [OTP] Error in verify-otp:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to verify OTP',
        });
    }
};
