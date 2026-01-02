import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { appConnection } from '../config/db';
import NetworkCode from '../models/NetworkCode';
import Connection from '../models/Connection';
import User from '../models/User';

// Create Network Code
export const createNetworkCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, name, description, qrCodeUrl, userId } = req.body;

        const existingCode = await NetworkCode.findOne({ codeId: code });
        if (existingCode) {
            res.status(400).json({ message: 'Network code already exists' });
            return;
        }

        const newNetworkCode = new NetworkCode({
            codeId: code,
            name: name || `Network ${code}`,
            description: description || 'No description provided',
            qrCodeUrl: qrCodeUrl || 'https://via.placeholder.com/150',
            userId: userId || (req as any).user?._id,
        });

        const savedCode = await newNetworkCode.save();
        res.status(201).json(savedCode);
    } catch (error) {
        console.error('❌ Error in createNetworkCode:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

// Join Network Code
export const joinNetwork = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, code } = req.body;

        // Find network code
        const network = await NetworkCode.findOne({ codeId: code });
        if (!network) {
            res.status(404).json({ message: 'Network code not found' });
            return;
        }

        // Check if blocked by admin
        if (network.isBlocked) {
            res.status(403).json({ message: 'this network code is blocked by the admin' });
            return;
        }

        // Check if blocked by admin
        if (network.isBlocked) {
            res.status(403).json({ message: 'this network code is blocked by the admin' });
            return;
        }

        // Check if already joined
        const existingConnection = await Connection.findOne({ userId: userId, networkCodeId: network._id });
        if (existingConnection) {
            res.status(400).json({ message: 'User already joined this network' });
            return;
        }

        const newConnection = new Connection({
            userId: userId,
            networkCodeId: network._id,
            requestorId: userId, // Assuming joiner is requestor
            codeId: code,
            status: 'accepted', // Admin join is usually accepted
        });

        const savedConnection = await newConnection.save();
        res.status(201).json(savedConnection);
    } catch (error) {
        console.error('❌ Error in joinNetwork:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get All Users Under a Network Code
export const getNetworkUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.params;
        console.log(`📡 [NETWORK] Fetching users for network code: ${code}`);

        const network = await NetworkCode.findOne({ codeId: code }).lean();
        if (!network) {
            res.status(404).json({ message: 'Network code not found' });
            return;
        }

        const connections = await Connection.find({ networkCodeId: network._id })
            .populate('userId', '-password')
            .lean()
            .exec();

        // Map userId to user for frontend compatibility
        const formattedConnections = connections.map((conn: any) => ({
            ...conn,
            user: conn.userId
        }));

        console.log(`✅ [NETWORK] Found ${formattedConnections.length} users for ${code}`);
        res.status(200).json(formattedConnections);
    } catch (error: any) {
        console.error('❌ Error in getNetworkUsers:', error);
        console.error('📋 Stack:', error.stack);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Block User
export const blockUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { connectionId } = req.params;
        console.log(`🔒 [NETWORK] Blocking connection: ${connectionId}`);

        const updatedConnection = await Connection.findByIdAndUpdate(
            connectionId,
            {
                status: 'Blocked',
                isBlocked: true
            },
            { new: true }
        );

        if (!updatedConnection) {
            console.error(`❌ [NETWORK] Connection not found: ${connectionId}`);
            res.status(404).json({ message: 'Connection not found' });
            return;
        }

        console.log(`✅ [NETWORK] Successfully blocked connection: ${connectionId}`);
        res.status(200).json(updatedConnection);
    } catch (error) {
        console.error('❌ [NETWORK] Error in blockUser:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

// Unblock User
export const unblockUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { connectionId } = req.params;
        console.log(`🔓 [NETWORK] Unblocking connection: ${connectionId}`);

        // First find the connection to check its original status
        const connection = await Connection.findById(connectionId);
        if (!connection) {
            console.error(`❌ [NETWORK] Connection not found: ${connectionId}`);
            res.status(404).json({ message: 'Connection not found' });
            return;
        }

        // Update the connection to unblock it
        const updatedConnection = await Connection.findByIdAndUpdate(
            connectionId,
            {
                status: 'accepted', // Reset to accepted status
                isBlocked: false   // Explicitly set isBlocked to false
            },
            { new: true }
        );

        if (!updatedConnection) {
            console.error(`❌ [NETWORK] Failed to update connection: ${connectionId}`);
            res.status(500).json({ message: 'Failed to update connection' });
            return;
        }

        console.log(`✅ [NETWORK] Successfully unblocked connection: ${connectionId}`);
        res.status(200).json(updatedConnection);
    } catch (error) {
        console.error('❌ [NETWORK] Error in unblockUser:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get All Connections (Admin)
export const getAllConnections = async (req: Request, res: Response): Promise<void> => {
    console.log('📡 [NETWORK] getAllConnections: Starting fetch...');
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const networkId = req.query.networkId as string;

        console.log(`📡 [NETWORK] Query params - Page: ${page}, Limit: ${limit}, NetworkId: ${networkId || 'ALL'}`);

        const query: any = {};
        if (networkId && mongoose.Types.ObjectId.isValid(networkId)) {
            query.networkCodeId = new mongoose.Types.ObjectId(networkId);
        }

        console.log('📡 [NETWORK] Running Connection queries...');
        const totalConnections = await Connection.countDocuments(query);
        const connections = await Connection.find(query)
            .populate('userId', '-password')
            .populate('networkCodeId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        // Map fields for frontend compatibility
        const formattedConnections = connections.map((conn: any) => ({
            ...conn,
            user: conn.userId,
            networkCode: conn.networkCodeId,
            code: conn.codeId || (conn.networkCodeId ? (conn.networkCodeId as any).codeId : 'N/A')
        }));

        console.log(`✅ [NETWORK] Found ${formattedConnections.length} connections (Total: ${totalConnections})`);

        res.status(200).json({
            connections: formattedConnections,
            totalConnections,
            totalPages: Math.ceil(totalConnections / limit),
            currentPage: page
        });
    } catch (error: any) {
        console.error('💥 [NETWORK_ERROR] Fatal error in getAllConnections:');
        console.error('❌ Message:', error.message);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get All Network Codes (Admin Overview)
export const getAllNetworkCodes = async (req: Request, res: Response): Promise<void> => {
    console.log('📡 [NETWORK] getAllNetworkCodes: Request received.');
    try {
        const { verified, search } = req.query;
        const query: any = {};

        if (verified !== undefined) {
            if (verified === 'true') {
                query.isVerified = true;
            } else {
                // If verified=false, match explicitly false OR missing (for legacy data)
                query.$or = [
                    { isVerified: false },
                    { isVerified: { $exists: false } }
                ];
            }
        }

        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
            query.$or = [
                { name: searchRegex },
                { codeId: searchRegex },
                { description: searchRegex }
            ];
        }

        // Fetch network codes
        const networkCodes = await NetworkCode.find(query).sort({ createdAt: -1 }).lean();

        // Aggregate connection counts per codeId (more robust than ObjectId)
        const connectionCounts = await Connection.aggregate([
            {
                $group: {
                    _id: "$codeId",
                    total: { $sum: 1 },
                    accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } }
                }
            }
        ]);

        // Create a map for quick lookup
        const statsMap: Record<string, { total: number; accepted: number; pending: number }> = {};
        connectionCounts.forEach((stat: any) => {
            if (stat._id) {
                statsMap[stat._id] = {
                    total: stat.total,
                    accepted: stat.accepted,
                    pending: stat.pending
                };
            }
        });

        console.log(`✅ [NETWORK] Fetched ${networkCodes.length} networks.`);

        const formattedCodes = networkCodes.map((code: any) => {
            // Use codeId for lookup
            const codeKey = code.codeId;
            const stats = statsMap[codeKey] || { total: 0, accepted: 0, pending: 0 };
            return {
                ...code,
                code: code.codeId || 'N/A',
                createdBy: { name: 'Unknown' },
                memberStats: stats,
                connectionCount: stats.total
            };
        });

        res.status(200).json(formattedCodes);

    } catch (error: any) {
        console.error('💥 [NETWORK_ERROR] Failure:', error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get connections for a specific network codeId
// GET /api/network/:codeId/connections
export const getConnectionsByCodeId = async (req: Request, res: Response): Promise<void> => {
    const { codeId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    console.log(`📡 [NETWORK] getConnectionsByCodeId: Fetching for codeId: ${codeId}, Page: ${page}, Search: ${search}`);

    try {
        if (!codeId) {
            res.status(400).json({ message: 'codeId is required' });
            return;
        }

        // Build Aggregation Pipeline
        const pipeline: any[] = [
            { $match: { codeId: codeId } },
            // Lookup User details
            {
                $lookup: {
                    from: 'users',
                    localField: 'requestorId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
        ];

        // Add Search Stage if search term exists
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { 'user.name': searchRegex },
                        { 'user.email': searchRegex },
                        { 'user.company': searchRegex },
                        { 'user.location': searchRegex }
                    ]
                }
            });
        }

        // Count total matching documents properly (before skip/limit)
        // We use $facet to get both data and count in one go
        const facetedPipeline = [
            ...pipeline,
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ];

        const result = await Connection.aggregate(facetedPipeline);

        const metadata = result[0].metadata;
        const total = metadata.length > 0 ? metadata[0].total : 0;
        const connections = result[0].data;

        console.log(`✅ [NETWORK] Found ${connections.length} connections (Total matching: ${total})`);

        // Format connections
        const formattedConnections = connections.map((conn: any) => ({
            ...conn,
            _id: conn._id.toString(),
            // Ensure user object structure matches expected frontend format
            user: conn.user ? {
                ...conn.user,
                // We don't fetch individual user connection counts here for performance in list view
                // If needed, can be a separate call or expensive lookup
                connectionCount: 0
            } : { name: 'Unknown User', email: 'N/A', connectionCount: 0 }
        }));

        res.status(200).json({
            connections: formattedConnections,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error('💥 [NETWORK_ERROR] Failure in getConnectionsByCodeId:');
        console.error('❌ Message:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


/**
 * Debug Endpoint to check DB connectivity
 * GET /api/network/debug
 */
export const debugNetwork = async (req: Request, res: Response): Promise<void> => {
    try {
        const state = appConnection.readyState;
        const count = await NetworkCode.countDocuments();
        res.status(200).json({
            status: 'success',
            readyState: state,
            networkCodeCount: count,
            database: appConnection.name
        });
    } catch (err: any) {
        console.error('💥 [DEBUG_ERROR] failure:', err);
        res.status(500).json({
            status: 'error',
            message: err.message,
            stack: err.stack
        });
    }
};

/**
 * Toggle Block Status of a Network Code
 * PUT /api/network/:id/toggle-block
 */
export const toggleBlockNetworkCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const network = await NetworkCode.findById(id);

        if (!network) {
            res.status(404).json({ message: 'Network code not found' });
            return;
        }

        network.isBlocked = !network.isBlocked;
        await network.save();

        res.status(200).json({
            message: `Network ${network.isBlocked ? 'blocked' : 'unblocked'} successfully`,
            network
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating network status', error: error.message });
    }
};

/**
 * Approve Network Code
 * PUT /api/network/:id/approve
 */
export const approveNetwork = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const network = await NetworkCode.findByIdAndUpdate(
            id,
            { isVerified: true },
            { new: true }
        ).lean();

        if (!network) {
            res.status(404).json({ message: 'Network not found' });
            return;
        }

        res.status(200).json({ message: 'Network approved successfully', network });
    } catch (error: any) {
        res.status(500).json({ message: 'Error approving network', error: error.message });
    }
};

/**
 * Delete/Reject Network Code
 * DELETE /api/network/:id
 */
export const deleteNetwork = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const network = await NetworkCode.findByIdAndDelete(id);

        if (!network) {
            res.status(404).json({ message: 'Network not found' });
            return;
        }

        res.status(200).json({ message: 'Network deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting network', error: error.message });
    }
};

/**
 * PUT /api/network/:id
 * Update Network Code details
 */
export const updateNetworkCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, qrCodeUrl, isVerified, isBlocked } = req.body;

        const updated = await NetworkCode.findByIdAndUpdate(
            id,
            { name, description, qrCodeUrl, isVerified, isBlocked },
            { new: true }
        ).lean();

        if (!updated) {
            res.status(404).json({ message: 'Network code not found' });
            return;
        }

        res.status(200).json({ message: 'Network updated successfully', network: updated });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating network', error: error.message });
    }
};

export const rejectNetwork = deleteNetwork;
