import { Request, Response } from 'express';
import EventConnection from '../models/EventConnection';
import Event from '../models/Event';
import User from '../models/User';
import mongoose from 'mongoose';

/**
 * GET /api/event-connections/events
 * Get all events with connection counts and pagination
 */
export const getAllEvents = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Build query
        // Build query - allow boolean or string true
        const query: any = {
            $or: [
                { isVerified: true },
                { isVerified: 'true' }
            ]
        };

        // Match behavior of eventController: include active, or missing/null isActive
        // UPDATE: User wants to see all verified events in connections view, regardless of active status.
        // query.$or = [
        //    { isActive: true },
        //    { isActive: { $exists: false } },
        //    { isActive: null }
        // ];

        // Search filter
        if (req.query.search) {
            const searchTerm = new RegExp(req.query.search as string, 'i');
            query.$or = [
                { name: searchTerm },
                { headline: searchTerm },
                { description: searchTerm },
                { location: searchTerm },
                { tags: searchTerm }
            ];
            // No need for $and complexity if we removed isActive filter
        }

        // Get total count for pagination
        const totalEvents = await Event.countDocuments(query);

        // Get paginated events
        // Get paginated events
        const events = await Event.find(query)
            .select('name headline description dateTime location photos tags createdAt isActive isVerified')
            .sort({ dateTime: -1 }) // Show most recent first
            .skip(skip)
            .limit(limit)
            .lean();

        // Get connection counts for each event
        const eventIds = events.map(e => e._id);
        const connectionCounts = await EventConnection.aggregate([
            { $match: { eventId: { $in: eventIds } } },
            { $group: { _id: '$eventId', count: { $sum: 1 } } }
        ]);

        const countMap: Record<string, number> = {};
        connectionCounts.forEach((c: any) => {
            countMap[c._id.toString()] = c.count;
        });

        const eventsWithCounts = events.map((event: any) => ({
            _id: event._id,
            name: event.name,
            headline: event.headline,
            description: event.description,
            dateTime: event.dateTime,
            location: event.location,
            photos: event.photos?.[0] || null, // Only return first photo for list view
            tags: event.tags || [],
            createdAt: event.createdAt,
            connectionCount: countMap[event._id.toString()] || 0,
        }));

        res.status(200).json({
            success: true,
            events: eventsWithCounts,
            pagination: {
                total: totalEvents,
                page,
                pages: Math.ceil(totalEvents / limit),
                limit
            }
        });
    } catch (error: any) {
        console.error('❌ Error fetching events:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch events',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/event-connections/:eventId/connections
 * Get all connections for a specific event with pagination and search
 */
export const getEventConnections = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search as string;

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Valid event ID is required',
            });
        }

        // Build match query
        const matchQuery: any = { eventId: new mongoose.Types.ObjectId(eventId) };

        // Add search filter if provided
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            matchQuery.$or = [
                { 'participantId.name': searchRegex },
                { 'participantId.email': searchRegex },
                { 'participantId.company': searchRegex },
                { 'participantId.role': searchRegex },
                { 'participantId.oneLiner': searchRegex }
            ];
        }

        // Get total count for pagination
        const totalConnections = await EventConnection.countDocuments({ eventId });

        // Find all event connections for this event with pagination
        const connections = await EventConnection.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'participantId',
                    foreignField: '_id',
                    as: 'participantId'
                }
            },
            { $unwind: { path: '$participantId', preserveNullAndEmptyArrays: true } },
            { $match: matchQuery },
            { $sort: { joinedAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        // Format the response
        const formattedConnections = connections.map((conn: any) => {
            const user = conn.participantId;
            return {
                connectionId: conn._id,
                userId: user?._id,
                name: user?.name || 'Unknown User',
                email: user?.email || 'N/A',
                role: user?.role || 'N/A',
                location: user?.location,
                avatar: user?.photoUrl || user?.profileImage,
                company: user?.company,
                website: user?.website,
                oneLiner: user?.oneLiner,
                primaryGoal: user?.primaryGoal,
                joinedAt: conn.joinedAt,
                connectionStatus: 'Connected',
                isBlocked: false,
                // Include any additional fields needed by the frontend
            };
        });

        res.status(200).json({
            success: true,
            connections: formattedConnections,
            pagination: {
                total: totalConnections,
                page,
                pages: Math.ceil(totalConnections / limit),
                limit
            }
        });
    } catch (error: any) {
        console.error('❌ Error fetching event connections:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch event connections',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
