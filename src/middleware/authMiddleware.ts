import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AdminUser, { IAdminUser } from '../models/AdminUser';

interface AuthRequest extends Request {
    user?: IAdminUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    console.log('🔐 [AUTH] ========== NEW REQUEST ==========');
    console.log('🔐 [AUTH] Method:', req.method, 'Path:', req.path);
    console.log('📋 [AUTH] Authorization header:', req.headers.authorization);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('✅ [AUTH] Token extracted successfully');
            console.log('🎫 [AUTH] Token preview:', token.substring(0, 30) + '...');

            const jwtSecret = process.env.JWT_SECRET || 'secret';
            console.log('🔑 [AUTH] JWT_SECRET loaded:', jwtSecret === 'secret' ? '⚠️  USING DEFAULT "secret"' : `✅ Custom secret: "${jwtSecret}"`);

            console.log('🔍 [AUTH] Attempting to verify token...');
            const decoded: any = jwt.verify(token, jwtSecret);
            console.log('✅ [AUTH] Token verified successfully!');
            
            // Check if token is an access token
            if (decoded.type && decoded.type !== 'access') {
                console.error('❌ [AUTH] Invalid token type. Access token required.');
                return res.status(401).json({ 
                    message: 'Not authorized, invalid token type',
                    error: 'Access token required'
                });
            }

            const userId = decoded.id || decoded.userId;
            console.log('👤 [AUTH] Decoded user ID:', userId);
            console.log('📅 [AUTH] Token issued at:', new Date(decoded.iat * 1000).toISOString());
            console.log('📅 [AUTH] Token expires at:', new Date(decoded.exp * 1000).toISOString());

            console.log('🔍 [AUTH] Looking up user in database...');
            req.user = await AdminUser.findById(userId).select('-password') as IAdminUser;

            if (!req.user) {
                console.error('❌ [AUTH] User not found in database for ID:', userId);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            console.log('✅ [AUTH] User found:', req.user.email, 'Role:', req.user.role);
            console.log('✅ [AUTH] Authentication successful!');
            next();
        } catch (error: any) {
            console.error('❌ [AUTH] ========== TOKEN VERIFICATION FAILED ==========');
            console.error('❌ [AUTH] Error name:', error.name);
            console.error('❌ [AUTH] Error message:', error.message);

            if (error.name === 'JsonWebTokenError') {
                console.error('❌ [AUTH] Invalid token signature - JWT_SECRET mismatch!');
                console.error('❌ [AUTH] This usually means:');
                console.error('   1. Token was created with a different JWT_SECRET');
                console.error('   2. Server was restarted with a new JWT_SECRET');
                console.error('   3. Token is malformed');
            } else if (error.name === 'TokenExpiredError') {
                console.error('❌ [AUTH] Token has expired');
                return res.status(401).json({
                    message: 'Not authorized, token expired',
                    error: error.message,
                    errorType: error.name,
                    code: 'TOKEN_EXPIRED'
                });
            }

            console.error('❌ [AUTH] Full error stack:', error.stack);
            return res.status(401).json({
                message: 'Not authorized, token failed',
                error: error.message,
                errorType: error.name
            });
        }
    } else {
        console.error('❌ [AUTH] No Bearer token in Authorization header');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('👤 [ADMIN] Checking admin role...');
    console.log('👤 [ADMIN] User:', req.user?.email, 'Role:', req.user?.role);

    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        console.log('✅ [ADMIN] User has admin privileges');
        next();
    } else {
        console.error('❌ [ADMIN] Access denied - not an admin');
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

export const superadminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('👑 [SUPERADMIN] Checking superadmin role...');
    console.log('👑 [SUPERADMIN] User:', req.user?.email, 'Role:', req.user?.role);

    if (req.user && req.user.role === 'superadmin') {
        console.log('✅ [SUPERADMIN] User has superadmin privileges');
        next();
    } else {
        console.error('❌ [SUPERADMIN] Access denied - not a superadmin');
        res.status(403).json({ message: 'Forbidden: Superadmin access required' });
    }
};

