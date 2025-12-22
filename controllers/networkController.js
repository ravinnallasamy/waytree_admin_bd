const NetworkCode = require('../models/NetworkCode');
const Connection = require('../models/Connection');
const User = require('../models/User'); // Ensure User model is loaded

const mongoose = require('mongoose');

// Get all Network Codes (mapped to /api/network/all)
exports.getAllUsers = async (req, res) => {
    try {
        const networks = await NetworkCode.find({}).populate('createdBy', 'name email').lean();

        // Get counts of connections per network
        const counts = await Connection.aggregate([
            { $group: { _id: "$networkCode", count: { $sum: 1 } } }
        ]);

        const countMap = {};
        counts.forEach(c => countMap[c._id.toString()] = c.count);

        const networksWithCounts = networks.map(net => ({
            ...net,
            connectionCount: countMap[net._id.toString()] || 0
        }));

        res.status(200).json(networksWithCounts);
    } catch (error) {
        console.error('Error fetching networks:', error);
        res.status(500).json({ message: 'Error fetching networks', error: error.message });
    }
};

// Get Connections with Pagination (mapped to /api/network/connections)
exports.getConnections = async (req, res) => {
    try {
        const { page = 1, limit = 10, networkId, search } = req.query;

        const pipeline = [];

        // Match network if provided
        if (networkId) {
            pipeline.push({ $match: { networkCode: new mongoose.Types.ObjectId(networkId) } });
        }

        // Lookup User
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user'
            }
        });
        pipeline.push({ $unwind: '$user' });

        // Lookup NetworkCode
        pipeline.push({
            $lookup: {
                from: 'networkcodes',
                localField: 'networkCode',
                foreignField: '_id',
                as: 'networkCode'
            }
        });
        pipeline.push({ $unwind: '$networkCode' });

        // Search filter
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            pipeline.push({
                $match: {
                    $or: [
                        { 'user.name': searchRegex },
                        { 'user.email': searchRegex },
                        { 'user.role': searchRegex },
                        { 'user.location': searchRegex }
                    ]
                }
            });
        }

        // Count total before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Connection.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        // Pagination
        pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) });
        pipeline.push({ $limit: parseInt(limit) });

        const connections = await Connection.aggregate(pipeline);

        res.status(200).json({
            connections,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            totalConnections: total
        });

    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ message: 'Error fetching connections', error: error.message });
    }
};

// Block/Unblock user (Adding these as they are used in frontend)
exports.blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await Connection.findByIdAndUpdate(
            id,
            { isBlocked: true },
            { new: true }
        );
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        res.status(200).json(connection);
    } catch (error) {
        res.status(500).json({ message: 'Error blocking user', error: error.message });
    }
};

exports.unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await Connection.findByIdAndUpdate(
            id,
            { isBlocked: false },
            { new: true }
        );
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        res.status(200).json(connection);
    } catch (error) {
        res.status(500).json({ message: 'Error unblocking user', error: error.message });
    }
};

// Get connections by network code
exports.getConnectionsByCode = async (req, res) => {
    try {
        const { codeId } = req.params;

        // Find connections for this code
        const connections = await Connection.find({ codeId })
            .populate('userId', 'name email role location photoUrl profileImage company website oneLiner primaryGoal connectionCount')
            .lean();

        // Format the response
        const formattedConnections = connections.map(conn => ({
            _id: conn._id,
            user: conn.userId,
            networkCodeId: conn.networkCodeId,
            codeId: conn.codeId,
            status: conn.status,
            isBlocked: conn.isBlocked || false,
            connectionDate: conn.connectionDate,
            createdAt: conn.createdAt
        }));

        res.status(200).json(formattedConnections);
    } catch (error) {
        console.error('Error fetching connections by code:', error);
        res.status(500).json({ message: 'Error fetching connections', error: error.message });
    }
};
