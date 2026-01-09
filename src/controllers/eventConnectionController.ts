import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event';
import User from '../models/User';
import EventConnection from '../models/EventConnection';
import CommunityConnection from '../models/CommunityConnection';
import EventMember from '../models/EventMember';
import * as XLSX from 'xlsx';

/**
 * GET /api/event-connections/events
 * Get all verified circles (Events/Communities)
 */
export const getAllEvents = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search as string;
        const isEvent = req.query.isEvent === 'true';
        const isCommunity = req.query.isCommunity === 'true';

        let query: any = { isVerified: true };
        if (isEvent) query.isCommunity = false;
        if (isCommunity) query.isCommunity = true;

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const events = await Event.find(query)
            .select('name image date location isCommunity createdAt attendees')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Event.countDocuments(query);

        // Get counts from all models
        const eventIds = events.map(e => new mongoose.Types.ObjectId(e._id.toString()));
        const [eventMemberCounts, communityCounts, eventConnCounts] = await Promise.all([
            EventMember.aggregate([
                { $match: { eventId: { $in: eventIds } } },
                { $group: { _id: '$eventId', count: { $sum: 1 } } }
            ]),
            CommunityConnection.aggregate([
                { $match: { eventId: { $in: eventIds } } },
                { $group: { _id: '$eventId', count: { $sum: 1 } } }
            ]),
            EventConnection.aggregate([
                { $match: { eventId: { $in: eventIds } } },
                { $group: { _id: '$eventId', count: { $sum: 1 } } }
            ])
        ]);

        const countMap: Record<string, number> = {};
        eventMemberCounts.forEach((c: any) => countMap[c._id.toString()] = (countMap[c._id.toString()] || 0) + c.count);
        communityCounts.forEach((c: any) => countMap[c._id.toString()] = (countMap[c._id.toString()] || 0) + c.count);
        eventConnCounts.forEach((c: any) => countMap[c._id.toString()] = (countMap[c._id.toString()] || 0) + c.count);

        const result = events.map((e: any) => {
            const attendeesCount = e.attendees?.length || 0;
            const modelCount = countMap[e._id.toString()] || 0;
            const finalCount = Math.max(attendeesCount, modelCount);

            return {
                ...e,
                connectionCount: finalCount
            };
        });

        res.status(200).json({
            success: true,
            events: result,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/event-connections/:eventId/connections
 * Get members for a specific circle
 */
export const getEventConnections = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const search = req.query.search as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Circle not found' });

        const queryIds: (string | mongoose.Types.ObjectId)[] = [eventId];
        if (mongoose.Types.ObjectId.isValid(eventId)) {
            queryIds.push(new mongoose.Types.ObjectId(eventId));
        }

        const [eventMembers, communityConns, eventConns, eventDoc] = await Promise.all([
            EventMember.find({ eventId: { $in: queryIds } }).lean(),
            CommunityConnection.find({ eventId: { $in: queryIds } }).populate('participantId', 'name email phoneNumber photoUrl role company').lean(),
            EventConnection.find({ eventId: { $in: queryIds } }).populate('participantId', 'name email phoneNumber photoUrl role company').lean(),
            Event.findById(mongoose.Types.ObjectId.isValid(eventId) ? eventId : null).populate('attendees', 'name email phoneNumber photoUrl role company').lean()
        ]);

        let nameFallbackMembers: any[] = [];
        if (eventMembers.length === 0 && communityConns.length === 0 && eventConns.length === 0 && (!eventDoc || (eventDoc.attendees?.length || 0) === 0)) {
            if (event && event.name) {
                const similarEvents = await Event.find({
                    name: event.name,
                    _id: { $ne: event._id }
                }).select('_id').lean();
                if (similarEvents.length > 0) {
                    const otherIds = similarEvents.map(e => e._id);
                    nameFallbackMembers = await EventMember.find({ eventId: { $in: otherIds } }).lean();
                }
            }
        }

        const membersMap = new Map();

        communityConns.forEach((conn: any) => {
            if (conn.participantId) {
                const u = conn.participantId;
                const key = u.phoneNumber || u.email || u._id?.toString();
                if (key) {
                    membersMap.set(key, {
                        connectionId: conn._id,
                        userId: u._id,
                        name: u.name,
                        email: u.email,
                        phoneNumber: u.phoneNumber,
                        role: u.role,
                        company: u.company || '',
                        avatar: u.photoUrl,
                        source: 'join',
                        joinedAt: conn.joinedAt || (conn as any).createdAt,
                        connectionStatus: 'Connected'
                    });
                }
            }
        });

        eventConns.forEach((conn: any) => {
            if (conn.participantId) {
                const u = conn.participantId;
                const key = u.phoneNumber || u.email || u._id?.toString();
                if (key && !membersMap.has(key)) {
                    membersMap.set(key, {
                        connectionId: conn._id,
                        userId: u._id,
                        name: u.name,
                        email: u.email,
                        phoneNumber: u.phoneNumber,
                        role: u.role,
                        company: u.company || '',
                        avatar: u.photoUrl,
                        source: 'join',
                        joinedAt: conn.joinedAt || (conn as any).createdAt,
                        connectionStatus: 'Connected'
                    });
                }
            }
        });

        eventMembers.forEach((m: any) => {
            const key = m.phoneNumber || (m as any).email || m.userId?.toString() || m._id?.toString();
            if (key && !membersMap.has(key)) {
                membersMap.set(key, {
                    connectionId: m._id,
                    userId: m.userId,
                    name: m.name,
                    email: (m as any).email || '',
                    phoneNumber: m.phoneNumber,
                    company: m.company || '',  // Add company
                    bio: m.bio || '',          // Add bio
                    source: m.source,
                    joinedAt: m.joinedAt || (m as any).createdAt,
                    connectionStatus: 'Connected'
                });
            }
        });

        nameFallbackMembers.forEach((m: any) => {
            const key = m.phoneNumber || (m as any).email || m.userId?.toString() || m._id?.toString();
            if (key && !membersMap.has(key)) {
                membersMap.set(key, {
                    connectionId: m._id,
                    userId: m.userId,
                    name: m.name,
                    email: (m as any).email || '',
                    phoneNumber: m.phoneNumber,
                    source: m.source,
                    joinedAt: m.joinedAt || (m as any).createdAt,
                    connectionStatus: 'Connected'
                });
            }
        });

        if (eventDoc && eventDoc.attendees) {
            (eventDoc.attendees as any[]).forEach((u: any) => {
                const key = u.phoneNumber || u.email || (u._id ? u._id.toString() : u.toString());
                if (key && !membersMap.has(key)) {
                    const isPopulated = u._id !== undefined;
                    const userId = isPopulated ? u._id : u;
                    membersMap.set(key, {
                        connectionId: userId,
                        userId: userId,
                        name: isPopulated ? u.name : 'App User',
                        email: isPopulated ? u.email : '',
                        phoneNumber: isPopulated ? u.phoneNumber : '',
                        role: isPopulated ? u.role : '',
                        company: isPopulated ? (u.company || '') : '',
                        avatar: isPopulated ? u.photoUrl : '',
                        source: 'join',
                        joinedAt: eventDoc.createdAt,
                        connectionStatus: 'Connected'
                    });
                }
            });
        }

        let participants = Array.from(membersMap.values());

        if (search) {
            const lowerSearch = search.toLowerCase();
            participants = participants.filter(p =>
                (p.name || '').toLowerCase().includes(lowerSearch) ||
                (p.phoneNumber || '').includes(lowerSearch) ||
                (p.email || '').toLowerCase().includes(lowerSearch)
            );
        }

        participants.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

        const total = participants.length;
        const paginatedParticipants = participants.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            connections: paginatedParticipants,
            pagination: { total, page, pages: Math.ceil(total / limit) }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import { EmbeddingService } from '../services/embeddingService';
import { SupabaseService } from '../services/supabaseService';

/**
 * POST /api/event-connections/add-member
 * Add member manually
 */
export const addManualMember = async (req: Request, res: Response) => {
    try {
        const { eventId, name, phoneNumber, company, bio } = req.body;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Circle not found' });

        if (phoneNumber) {
            const existing = await EventMember.findOne({ eventId, phoneNumber: phoneNumber.trim() });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: `A member with phone number ${phoneNumber} is already added to this circle.`
                });
            }
        }

        const newMember = new EventMember({
            eventId,
            organizerId: event.createdBy,
            name,
            phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
            company,
            bio,
            source: 'manual'
        });

        const savedMember = await newMember.save();

        // Generate & Store Embedding
        try {
            const profileText = `Name: ${name}. Company: ${company || ''}. Bio: ${bio || ''}. Role: Member`;
            const embedding = await EmbeddingService.generateEmbedding(profileText);
            if (embedding.length > 0) {
                await SupabaseService.storeMemberProfile(
                    eventId,
                    (savedMember._id as any).toString(),
                    profileText,
                    embedding,
                    { name, company, bio, phoneNumber }
                );
                console.log(`✅ [MEMBER] Stored embedding for ${name}`);
            }
        } catch (e) {
            console.error(`❌ [MEMBER] Failed to generate embedding for ${name}:`, e);
        }

        res.status(201).json({ success: true, member: savedMember });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/event-connections/upload-members
 * Upload members from Excel
 */
export const uploadMembersExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        const { eventId } = req.body;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Circle not found' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        const added = [];
        const duplicates = [];

        for (const row of data) {
            const name = row['Name'] || row['name'] || row['NAME'];
            const phone = row['Mobile'] || row['Phone'] || row['Number'] || row['phone'];
            const company = row['Company'] || row['company'] || row['COMPANY'];
            const bio = row['Bio'] || row['bio'] || row['BIO'] || row['Designation'] || row['Role']; // Fallback to Title/Role for bio

            const trimmedPhone = phone ? String(phone).trim() : undefined;

            if (name) {
                if (trimmedPhone) {
                    const existing = await EventMember.findOne({ eventId, phoneNumber: trimmedPhone });
                    if (existing) {
                        duplicates.push({ name, phoneNumber: trimmedPhone });
                        continue;
                    }
                }

                try {
                    const member = await EventMember.create({
                        eventId,
                        organizerId: event.createdBy,
                        name,
                        phoneNumber: trimmedPhone,
                        company,
                        bio,
                        source: 'excel'
                    });

                    added.push(member);

                    // Generate & Store Embedding (Async, don't block loop too much, or await if strict)
                    // Better to await to ensure reliable ingestion even if slower
                    const profileText = `Name: ${name}. Company: ${company || ''}. Bio: ${bio || ''}. Role: Member`;
                    const embedding = await EmbeddingService.generateEmbedding(profileText);
                    if (embedding.length > 0) {
                        await SupabaseService.storeMemberProfile(
                            eventId,
                            (member._id as any).toString(),
                            profileText,
                            embedding,
                            { name, company, bio, phoneNumber: trimmedPhone }
                        );
                    }

                } catch (err) {
                    console.error('Error adding member row:', err);
                }
            }
        }

        res.status(200).json({
            success: true,
            count: added.length,
            addedCount: added.length,
            duplicateCount: duplicates.length
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/event-connections/members/:memberId
 * Update event member details
 */
export const updateMember = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const { name, phoneNumber } = req.body;

        const member = await EventMember.findByIdAndUpdate(memberId, {
            name,
            phoneNumber: phoneNumber ? phoneNumber.trim() : undefined
        }, { new: true });

        if (member) {
            return res.status(200).json({ success: true, member });
        }

        return res.status(404).json({ success: false, message: 'Member not found or not editable' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/event-connections/members/:memberId
 * Remove member from event
 */
export const deleteMember = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const { eventId, source, userId } = req.query;

        if (source === 'manual' || source === 'excel') {
            await EventMember.findByIdAndDelete(memberId);
        } else {
            const queries = [
                CommunityConnection.deleteOne({ eventId, participantId: userId || memberId }),
                EventConnection.deleteOne({ eventId, participantId: userId || memberId }),
                Event.findByIdAndUpdate(eventId, { $pull: { attendees: userId || memberId } })
            ];
            await Promise.all(queries);
        }

        res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
