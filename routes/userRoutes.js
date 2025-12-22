const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

// Debug endpoint to test database connection
router.get('/debug/test', protect, admin, async (req, res) => {
    try {
        console.log('🔧 Testing database connection...');

        // Check if User model is available
        if (!User) {
            return res.status(500).json({
                success: false,
                message: 'User model is not defined',
                modelAvailable: false
            });
        }

        // Try to count documents
        const count = await User.countDocuments();

        // Try to fetch one user
        const sampleUser = await User.findOne().select('name email').lean();

        res.status(200).json({
            success: true,
            message: 'Database connection working',
            modelAvailable: true,
            totalUsers: count,
            sampleUser: sampleUser || 'No users in database',
            modelName: User.modelName,
            collectionName: User.collection.name
        });
    } catch (error) {
        console.error('❌ Debug test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
            errorType: error.name,
            stack: error.stack
        });
    }
});

// Get user statistics - MUST BE BEFORE /:userId route
router.get('/stats/overview', protect, admin, async (req, res) => {
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
    } catch (error) {
        console.error('❌ Error fetching user stats:', error);
        res.status(500).json({ message: 'Error fetching user statistics', error: error.message });
    }
});

// Get all users from the database
router.get('/all', protect, admin, async (req, res) => {
    try {
        console.log('📋 Fetching all users...');
        console.log('Query params:', req.query);

        const { search, page = 1, limit = 50 } = req.query;

        // Check if User model is available
        if (!User) {
            console.error('❌ User model is not defined!');
            return res.status(500).json({
                message: 'User model not available',
                error: 'Model initialization failed'
            });
        }

        // Build query
        let query = {};
        if (search && search.trim() !== '') {
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
        const users = await User.find(query)
            .select('-profileEmbedding') // Exclude large fields
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        console.log(`✅ Fetched ${users.length} users (total: ${total})`);
        res.status(200).json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
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
});

// Get single user by ID - MUST BE AFTER specific routes
router.get('/:userId', protect, admin, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`👤 Fetching user: ${userId}`);
        const user = await User.findById(userId).select('-profileEmbedding').lean();

        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('✅ User fetched successfully');
        res.status(200).json(user);
    } catch (error) {
        console.error('❌ Error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
});

// Update user details
router.put('/:userId', protect, admin, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        console.log(`✏️ Updating user: ${userId}`);

        // Remove fields that shouldn't be updated directly
        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-profileEmbedding');

        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('✅ User updated successfully');
        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('❌ Error updating user:', error);
        res.status(500).json({ message: 'Error updating user', error: error.message });
    }
});

// Delete user
router.delete('/:userId', protect, admin, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🗑️ Deleting user: ${userId}`);

        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('✅ User deleted successfully');
        res.status(200).json({ message: 'User deleted successfully', user });
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
});

module.exports = router;
