import { Request, Response } from 'express';
import User from '../models/User';
import Connection from '../models/Connection';
import bcrypt from 'bcryptjs';

// Register a user
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, role, location, profileImage } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            location,
            profileImage,
        });

        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get user details
export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password').lean();

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const networkCount = await Connection.countDocuments({ userId: id });

        res.status(200).json({
            ...user,
            networkCount,
            connectionCount: networkCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get all users (with optional filtering)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const role = req.query.role as string;
        const query: any = {};
        if (role) {
            query.role = role;
        }

        console.log(`🔍 [Admin] Fetching Users. Query:`, JSON.stringify(query));

        // Use lean() for better performance and easier object modification
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await User.countDocuments(query);
        console.log(`✅ [Admin] Found ${users.length} users (Total: ${total}).`);

        // Aggregate network/connection counts per user
        // We match connections where userId is in our fetched users list
        const userIds = users.map((u: any) => u._id);

        const connectionCounts = await Connection.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ]);

        const countMap: Record<string, number> = {};
        connectionCounts.forEach((c: any) => {
            if (c._id) countMap[c._id.toString()] = c.count;
        });

        const usersWithCounts = users.map((u: any) => ({
            ...u,
            networkCount: countMap[u._id.toString()] || 0,
            connectionCount: countMap[u._id.toString()] || 0
        }));

        res.status(200).json({
            users: usersWithCounts,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsers: total
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * Get user statistics overview
 * GET /api/users/stats/overview
 */
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📊 Fetching user statistics...');

        const totalUsers = await User.countDocuments();
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        const usersByGoal = await User.aggregate([
            { $group: { _id: '$primaryGoal', count: { $sum: 1 } } }
        ]);

        // Recent users (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentUsers = await User.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        console.log('✅ Stats fetched successfully');
        res.status(200).json({
            totalUsers,
            recentUsers,
            usersByRole,
            usersByGoal
        });
    } catch (error: any) {
        console.error('❌ Error fetching user stats:', error);
        res.status(500).json({
            message: 'Error fetching user statistics',
            error: error.message
        });
    }
};

/**
 * Get all users with pagination and search
 * GET /api/users/all
 */
export const getAllUsersPaginated = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📋 Fetching all users...');
        console.log('Query params:', req.query);

        const { search, page = '1', limit = '50' } = req.query;

        // Check if User model is available
        if (!User) {
            console.error('❌ User model is not defined!');
            res.status(500).json({
                message: 'User model not available',
                error: 'Model initialization failed'
            });
            return;
        }

        // Build query
        let query: any = {};
        if (search && typeof search === 'string' && search.trim() !== '') {
            console.log('🔍 Search term:', search);
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { company: { $regex: search, $options: 'i' } }
                ]
            };
        }

        console.log('📊 Query:', JSON.stringify(query));

        // Get total count
        console.log('🔢 Counting documents...');
        const total = await User.countDocuments(query);
        console.log(`✅ Total count: ${total}`);

        // Get users with pagination
        console.log('📥 Fetching users...');
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const users = await User.find(query)
            .select('-profileEmbedding') // Exclude large fields
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();

        console.log(`✅ Fetched ${users.length} users (total: ${total})`);
        res.status(200).json({
            users,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error: any) {
        console.error('❌ Error fetching users:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Error fetching users',
            error: error.message,
            errorType: error.name
        });
    }
};

/**
 * Toggle User Block Status
 * PUT /api/users/:id/toggle-block
 */
export const toggleBlockUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const wasBlocked = (user as any).isBlocked;
        (user as any).isBlocked = !(user as any).isBlocked;
        await user.save();

        // If user is being blocked, delete all their refresh tokens
        if ((user as any).isBlocked && !wasBlocked) {
            const { deleteAllUserRefreshTokens } = await import('../services/tokenService');
            await deleteAllUserRefreshTokens(id);
            console.log(`🚫 [BLOCK] Deleted all refresh tokens for blocked user: ${id}`);
        }

        res.status(200).json({
            message: `User ${(user as any).isBlocked ? 'blocked' : 'unblocked'} successfully`,
            user
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating user status', error: error.message });
    }
};

/**
 * Update User Details
 * PUT /api/users/:id
 */
export const updateUserDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const allowedFields = [
            'name', 'role', 'primaryGoal', 'company', 'website',
            'location', 'oneLiner', 'profileImage', 'interests', 'skills', 'isBlocked'
        ];

        // Filter valid updates
        const updates: any = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        // Special handling for photoUrl -> profileImage mapping if needed
        if (req.body.photoUrl && !updates.profileImage) {
            updates.profileImage = req.body.photoUrl;
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            res.status(404).json({ message: `User with ID ${id} not found` });
            return;
        }

        console.log(`✅ [Admin] Updated user ${id} successfully`);
        res.status(200).json(user);

    } catch (error: any) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user details', error: error.message });
    }
};

/**
 * Delete User
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);

        if (!user) {
            res.status(404).json({ message: `User with ID ${id} not found` });
            return;
        }

        // Also delete connections
        await Connection.deleteMany({ userId: id });

        console.log(`✅ [Admin] Deleted user ${id} successfully`);
        res.status(200).json({ message: 'User deleted successfully', id });

    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};
