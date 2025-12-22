import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
// Database Connection - Models now handle their own connections via config/db.ts
// import connectDB from './config/db'; 
// connectDB(); // Removed legacy single connection

// Routes Imports
import authRoutes from './routes/authRoutes';
import otpAuthRoutes from './routes/otpAuthRoutes';
import eventRoutes from './routes/eventRoutes';
import userRoutes from './routes/userRoutes';
import networkRoutes from './routes/networkRoutes';

import adminUserRoutes from './routes/adminUserRoutes';
import eventConnectionRoutes from './routes/eventConnectionRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mount routes
app.use('/api/auth', otpAuthRoutes); // OTP-based auth (primary)
app.use('/api/auth/legacy', authRoutes); // Legacy email/password auth
app.use('/api/events', eventRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', userRoutes); // Alias for plural standard
app.use('/api/network', networkRoutes);
app.use('/api/event-connections', eventConnectionRoutes); // Event connections API

app.use('/api/admin-users', adminUserRoutes); // Admin User management API

// Base route
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Basic error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('💥 [GLOBAL_ERROR]:', err);
    res.status(500).json({
        message: 'Internal Server Error',
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
