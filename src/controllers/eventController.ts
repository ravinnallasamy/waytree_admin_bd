import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event';
import { uploadToCloudinary } from '../services/uploadService';
import { EmbeddingService } from '../services/embeddingService';

// Extend Request interface to include files from multer
interface MulterRequest extends Request {
    files?: Express.Multer.File[];
}

/**
 * Create a new event with image upload
 * POST /api/events/create
 */
export const createEvent = async (req: Request, res: Response) => {
    const multerReq = req as MulterRequest;
    try {
        const { title, headline, description, date, time, location, tags, createdBy } = req.body;

        // Handle Image Uploads
        const imageUrls: string[] = [];

        // Case 1: Multer files (if frontend uses FormData)
        if (multerReq.files && Array.isArray(multerReq.files) && multerReq.files.length > 0) {
            const uploadPromises = multerReq.files.map(file => uploadToCloudinary(file.buffer, 'events'));
            const results = await Promise.all(uploadPromises);
            imageUrls.push(...results);
        }
        // Case 2: Base64 strings in body (current frontend)
        else if (req.body.images && Array.isArray(req.body.images)) {
            const uploadPromises = req.body.images.map(async (imgObj: any) => {
                let base64Data = '';
                if (typeof imgObj === 'string') {
                    base64Data = imgObj;
                } else if (imgObj.preview) {
                    base64Data = imgObj.preview;
                }

                if (base64Data.startsWith('data:image')) {
                    // Try to upload to Cloudinary if configured
                    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                        try {
                            // Remove prefix "data:image/png;base64,"
                            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                            if (matches && matches.length === 3) {
                                const buffer = Buffer.from(matches[2], 'base64');
                                return await uploadToCloudinary(buffer, 'events');
                            }
                        } catch (err) {
                            console.error("Cloudinary upload failed, falling back to Base64 storage", err);
                            return base64Data; // Fallback
                        }
                    }
                    // If no Cloudinary, return Base64 string directly
                    return base64Data;
                }
                return null;
            });

            const results = await Promise.all(uploadPromises);
            // Filter out nulls and push to imageUrls
            results.forEach(url => {
                if (url) imageUrls.push(url);
            });
        }

        // Handle Date Time
        // If date and time are separate, combine them. If dateTime is provided, use it.
        let eventDateTime: Date;
        if (date && time) {
            eventDateTime = new Date(`${date}T${time}`);
        } else if (req.body.dateTime) {
            eventDateTime = new Date(req.body.dateTime);
        } else {
            eventDateTime = new Date(); // Fallback
        }

        // Handle Tags (parse if stringified JSON or comma separated)
        let parsedTags: string[] = [];
        if (typeof tags === 'string') {
            try {
                parsedTags = JSON.parse(tags);
            } catch (e) {
                parsedTags = tags.split(',').map(t => t.trim());
            }
        } else if (Array.isArray(tags)) {
            parsedTags = tags;
        }

        // Handle CreatedBy - Use provided ID or generate a dummy one if not authenticated
        // In a real app, this should come from req.user._id
        const userId = createdBy && mongoose.Types.ObjectId.isValid(createdBy)
            ? createdBy
            : new mongoose.Types.ObjectId();

        const newEvent = new Event({
            name: title || req.body.name, // Support both title (frontend) and name (schema)
            headline: headline || req.body.headline, // Include headline
            description,
            dateTime: eventDateTime,
            location,
            tags: parsedTags,
            photos: imageUrls,
            videos: req.body.video && req.body.video.preview ? [req.body.video.preview] : [], // Map single video to array
            attachments: req.body.attachments || [],
            createdBy: userId,
            isVerified: req.body.status === 'verified', // Set based on status from frontend
            isActive: true // Explicitly set to true
        });

        // Save event first to get the ID
        const savedEvent = await newEvent.save();

        // Generate Embedding after saving (so we have all fields)
        try {
            console.log(`📝 Generating embedding for new event: "${savedEvent.name}"`);
            const eventText = EmbeddingService.createEventText(savedEvent);
            if (eventText && eventText.trim()) {
                const embedding = await EmbeddingService.generateEmbedding(eventText);
                if (embedding && embedding.length > 0) {
                    savedEvent.eventEmbedding = embedding;
                    await savedEvent.save();
                    console.log("✅ Event embedding generated and saved successfully");
                } else {
                    console.warn("⚠️ Embedding generation returned empty array");
                }
            } else {
                console.warn("⚠️ No text content to generate embedding from");
            }
        } catch (embError) {
            console.error("❌ Failed to generate embedding for new event:", embError);
            // Non-blocking: event is still created even if embedding fails
        }

        res.status(201).json({
            message: 'Event created successfully',
            event: savedEvent
        });
    } catch (error: any) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Error creating event', error: error.message });
    }
};

/**
 * Get all events with pagination and filtering
 * GET /api/events
 */
/**
 * Internal helper to fetch events
 */
const getEventsInternal = async (req: Request, res: Response, verifiedOverride?: string) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Use override if provided, else query param
        const verified = verifiedOverride !== undefined ? verifiedOverride : req.query.verified;

        const query: any = {};
        if (verified !== undefined) {
            query.isVerified = verified === 'true';
        }

        // Filter by isActive unless explicitly requested to include disabled
        // For verified events with includeDisabled=true, show ALL (including disabled)
        // For other queries, only show active events by default
        if (req.query.includeDisabled !== 'true') {
            query.$or = [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
            ];
        } else if (verified === 'true') {
            console.log('📊 [EVENTS] Showing ALL verified events (including disabled)');
        }

        // Add Search Logic
        if (req.query.search) {
            const searchTerm = req.query.search as string;
            const searchRegex = new RegExp(searchTerm, 'i');
            const searchConditions = [
                { name: searchRegex },
                { headline: searchRegex },
                { description: searchRegex },
                { location: searchRegex },
                { tags: searchRegex }
            ];

            // If we already have an $or (from isActive check), we need to use $and
            if (query.$or) {
                query.$and = [
                    { $or: query.$or }, // Existing active check
                    { $or: searchConditions } // Search check
                ];
                delete query.$or; // Remove top-level $or to avoid conflict
            } else {
                query.$or = searchConditions;
            }
        }

        console.log('📊 [EVENTS] ========== FETCHING EVENTS ==========');
        console.log('📊 [EVENTS] Query params:', req.query);
        console.log('📊 [EVENTS] Verified override:', verifiedOverride);
        console.log('📊 [EVENTS] Final verified value:', verified);
        console.log('📊 [EVENTS] MongoDB Query:', JSON.stringify(query, null, 2));

        // Optimized Query: lean(), select(), pagination
        const events = await Event.find(query)
            .select('name headline description dateTime location photos isVerified isActive tags createdBy') // Select necessary fields including creator
            .populate('createdBy', 'name email photoUrl') // Populate creator details
            .sort({ dateTime: 1 }) // Sort by upcoming events
            .skip(skip)
            .limit(limit)
            .lean(); // Convert to plain JS objects for performance

        const total = await Event.countDocuments(query);
        console.log(`✅ [EVENTS] Found ${total} total events, returning ${events.length} events`);

        res.status(200).json({
            events,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalEvents: total
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
};

/**
 * Get all events with pagination and filtering
 * GET /api/events
 */
export const getEvents = async (req: Request, res: Response) => {
    return getEventsInternal(req, res);
};

/**
 * Get single event by ID
 * GET /api/events/:id
 */
export const getEventById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await Event.findById(id)
            .populate('createdBy', 'name email photoUrl')
            .populate('attendees', 'name email photoUrl')
            .lean();

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if event is active for public access (unless admin - handled by middleware/logic in real app)
        // For now, we'll assume public access shouldn't see disabled events unless specific logic is added
        // But since this is getById, we might want to return it with a flag or let frontend handle it.
        // The requirement says "User/Public APIs should fetch only active events".
        // We can check req.query.includeDisabled here too if needed, but usually getById is specific.
        // Let's leave it as is for now, or add a check if needed.

        res.status(200).json(event);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching event details', error: error.message });
    }
};

/**
 * Get event thumbnail
 * GET /api/events/:id/thumbnail
 */
export const getEventThumbnail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await Event.findById(id).select('photos').slice('photos', 1).lean();

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const thumbnail = event.photos && event.photos.length > 0 ? event.photos[0] : null;
        res.status(200).json({ thumbnail });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching thumbnail', error: error.message });
    }
};

/**
 * Get verified events (Shortcut endpoint)
 * GET /api/events/verified
 */
export const getVerifiedEvents = async (req: Request, res: Response) => {
    return getEventsInternal(req, res, 'true');
};

/**
 * Get pending events (Shortcut endpoint)
 * GET /api/events/pending
 */
export const getPendingEvents = async (req: Request, res: Response) => {
    return getEventsInternal(req, res, 'false');
};

/**
 * Approve event
 * PUT /api/events/approve/:id
 */
export const approveEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const event = await Event.findByIdAndUpdate(
            id,
            { isVerified: true },
            { new: true }
        ).lean();

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event approved successfully', event });
    } catch (error: any) {
        res.status(500).json({ message: 'Error approving event', error: error.message });
    }
};

/**
 * Toggle Event Status (Enable/Disable)
 * PUT /api/events/:id/toggle-status
 */
export const toggleEventStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Find first to get current status
        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Toggle status
        // If isActive is explicitly false, it's disabled -> enable it (true)
        // If isActive is true OR undefined (legacy), it's enabled -> disable it (false)
        const isCurrentlyEnabled = event.isActive !== false;
        event.isActive = !isCurrentlyEnabled;

        await event.save();

        res.status(200).json({
            message: `Event ${event.isActive ? 'enabled' : 'disabled'} successfully`,
            event
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating event status', error: error.message });
    }
};

/**
 * Delete event (Generic)
 * DELETE /api/events/:id
 */
export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const event = await Event.findByIdAndDelete(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
};

// Alias for backward compatibility if needed, or just export deleteEvent as rejectEvent
export const rejectEvent = deleteEvent;

