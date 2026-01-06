import { Request, Response } from 'express';
import User from '../models/User';
import Event from '../models/Event';
import EventConnection from '../models/EventConnection';
import NetworkCode from '../models/NetworkCode';
import mongoose from 'mongoose';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        // --- 1. User Stats ---
        const userStatsPromise = User.aggregate([
            {
                $facet: {
                    totalUsers: [{ $count: "count" }],
                    blockedUsers: [{ $match: { isBlocked: true } }, { $count: "count" }],
                    newUsersToday: [{ $match: { createdAt: { $gte: startOfDay } } }, { $count: "count" }],
                    growthHistory: [
                        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    recentSignups: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { name: 1, email: 1, company: 1, role: 1, createdAt: 1, photoUrl: 1, location: 1 } }
                    ]
                }
            }
        ]);

        // --- 2. Event & Community Stats ---
        const eventStatsPromise = Event.aggregate([
            {
                $facet: {
                    totalEvents: [{ $match: { isEvent: true } }, { $count: "count" }],
                    totalCommunities: [{ $match: { isCommunity: true } }, { $count: "count" }],
                    activeEvents: [{ $match: { isEvent: true, isActive: true, isVerified: true } }, { $count: "count" }],
                    activeCommunities: [{ $match: { isCommunity: true, isActive: true, isVerified: true } }, { $count: "count" }],
                    pendingEvents: [{ $match: { isEvent: true, isVerified: false } }, { $count: "count" }],
                    pendingCommunities: [{ $match: { isCommunity: true, isVerified: false } }, { $count: "count" }],
                    upcomingEvents: [
                        { $match: { isEvent: true, dateTime: { $gte: new Date() } } },
                        { $sort: { dateTime: 1 } },
                        { $limit: 5 },
                        { $project: { name: 1, location: 1, dateTime: 1, createdBy: 1 } }
                    ]
                }
            }
        ]);

        // --- 3. Connections Stats ---
        const connectionStatsPromise = EventConnection.aggregate([
            {
                $facet: {
                    totalConnections: [{ $count: "count" }],
                    recentActivity: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 10 }, // Get recent connection activity
                        {
                            $lookup: {
                                from: "users",
                                localField: "participantId",
                                foreignField: "_id",
                                as: "user"
                            }
                        },
                        {
                            $lookup: {
                                from: "events",
                                localField: "eventId",
                                foreignField: "_id",
                                as: "event"
                            }
                        },
                        { $unwind: "$user" },
                        { $unwind: "$event" },
                        {
                            $project: {
                                type: { $literal: "connection" },
                                userName: "$user.name",
                                eventName: "$event.name",
                                isCommunity: "$event.isCommunity",
                                createdAt: 1
                            }
                        }
                    ]
                }
            }
        ]);

        // --- 4. Network Code Stats ---
        const networkStatsPromise = NetworkCode.aggregate([
            {
                $facet: {
                    totalCodes: [{ $count: "count" }],
                    pendingCodes: [{ $match: { isVerified: false } }, { $count: "count" }],
                    activeCodes: [{ $match: { isActive: true, isBlocked: false } }, { $count: "count" }]
                }
            }
        ]);

        const [userStats, eventStats, connectionStats, networkStats] = await Promise.all([
            userStatsPromise,
            eventStatsPromise,
            connectionStatsPromise,
            networkStatsPromise
        ]);

        const formattedUserStats = userStats[0];
        const formattedEventStats = eventStats[0];
        const formattedConnStats = connectionStats[0];
        const formattedNetStats = networkStats[0];

        // Construct Response
        const response = {
            counts: {
                users: formattedUserStats.totalUsers[0]?.count || 0,
                blockedUsers: formattedUserStats.blockedUsers[0]?.count || 0,
                newUsersToday: formattedUserStats.newUsersToday[0]?.count || 0,

                events: formattedEventStats.totalEvents[0]?.count || 0,
                activeEvents: formattedEventStats.activeEvents[0]?.count || 0,
                pendingEvents: formattedEventStats.pendingEvents[0]?.count || 0,

                communities: formattedEventStats.totalCommunities[0]?.count || 0,
                activeCommunities: formattedEventStats.activeCommunities[0]?.count || 0,
                pendingCommunities: formattedEventStats.pendingCommunities[0]?.count || 0,

                connections: formattedConnStats.totalConnections[0]?.count || 0,

                networkCodes: formattedNetStats.totalCodes[0]?.count || 0,
                pendingNetworkCodes: formattedNetStats.pendingCodes[0]?.count || 0,

                totalPendingReviews: (formattedEventStats.pendingEvents[0]?.count || 0) +
                    (formattedEventStats.pendingCommunities[0]?.count || 0) +
                    (formattedNetStats.pendingCodes[0]?.count || 0)
            },
            charts: {
                userGrowth: formattedUserStats.growthHistory,
                // We can add more chart data here if needed, e.g., verificationStatus
                verificationStatus: [
                    { name: 'Verified', value: (formattedEventStats.activeEvents[0]?.count || 0) + (formattedEventStats.activeCommunities[0]?.count || 0) },
                    { name: 'Pending', value: (formattedEventStats.pendingEvents[0]?.count || 0) + (formattedEventStats.pendingCommunities[0]?.count || 0) }
                ]
            },
            lists: {
                recentSignups: formattedUserStats.recentSignups,
                upcomingEvents: formattedEventStats.upcomingEvents,
                recentActivity: formattedConnStats.recentActivity
            }
        };

        res.status(200).json({ success: true, data: response });

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats', error: error.message });
    }
};
