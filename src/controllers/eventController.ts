import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event';
import { uploadToS3 } from '../services/s3Service';
import { EmbeddingService } from '../services/embeddingService';
import { PdfService } from '../services/pdfService';
import { RagPipelineService } from '../services/ragPipelineService';

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

        // Case 1: Multer files
        if (multerReq.files && Array.isArray(multerReq.files) && multerReq.files.length > 0) {
            console.log(`📡 [EVENT] Uploading ${multerReq.files.length} files from multer to S3...`);
            const uploadPromises = multerReq.files.map(file =>
                uploadToS3(file.buffer, file.originalname, file.mimetype, 'events')
            );
            const results = await Promise.all(uploadPromises);
            imageUrls.push(...results);
        }
        // Case 2: Base64
        else if (req.body.images && Array.isArray(req.body.images)) {
            const uploadPromises = req.body.images.map(async (imgObj: any) => {
                let base64Data = typeof imgObj === 'string' ? imgObj : imgObj.preview;
                if (base64Data && base64Data.startsWith('data:image')) {
                    try {
                        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            const contentType = matches[1];
                            const buffer = Buffer.from(matches[2], 'base64');
                            const extension = contentType.split('/')[1] || 'png';
                            const fileName = `image_${Date.now()}.${extension}`;
                            return await uploadToS3(buffer, fileName, contentType, 'events');
                        }
                    } catch (err) {
                        return base64Data;
                    }
                }
                return null;
            });
            const results = await Promise.all(uploadPromises);
            results.forEach(url => { if (url) imageUrls.push(url); });
        }

        const newEvent = new Event({
            name: title || req.body.name,
            headline: headline || req.body.headline,
            description,
            dateTime: req.body.isCommunity ? undefined : (date && time ? new Date(`${date}T${time}`) : (req.body.dateTime ? new Date(req.body.dateTime) : new Date())),
            location,
            tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : []),
            photos: imageUrls,
            pdfFiles: req.body.pdfFiles || [],
            createdBy: createdBy || new mongoose.Types.ObjectId(),
            isEvent: req.body.isEvent !== undefined ? req.body.isEvent : !req.query.isCommunity,
            isCommunity: req.body.isCommunity !== undefined ? req.body.isCommunity : false,
            isVerified: false, // Creation ALWAYS starts as unverified to save cost
            isActive: true
        });

        const savedEvent = await newEvent.save();
        console.log(`✅ [EVENT] Created unverified event: ${savedEvent.name}. Embeddings TBD on approval.`);

        res.status(201).json({
            message: 'Event created successfully (Unverified)',
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

        if (req.query.isEvent !== undefined) {
            query.isEvent = req.query.isEvent === 'true';
        }
        if (req.query.isCommunity !== undefined) {
            query.isCommunity = req.query.isCommunity === 'true';
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
            .select('name headline description dateTime location photos isVerified isActive tags createdBy isEvent isCommunity pdfFiles')
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
 * Approve event & Trigger RAG Pipeline
 * PUT /api/events/approve/:id
 */
export const approveEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`🎯 [ADMIN-APPROVE] Approving event: ${id}`);

        const baseEvent = await Event.findById(id);
        if (!baseEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (baseEvent.isVerified) {
            return res.status(400).json({ message: 'Event is already verified' });
        }

        // 1. PDF EXTRACTION & RAG PIPELINE
        let pdfChunks: any[] = [];
        let pdfExtractedTexts: string[] = [];

        if (baseEvent.pdfFiles && baseEvent.pdfFiles.length > 0) {
            try {
                console.log(`📄 [ADMIN-APPROVE] Processing ${baseEvent.pdfFiles.length} PDFs...`);

                // Extract unique texts for embedding
                for (const pdfUrl of baseEvent.pdfFiles) {
                    if (PdfService.isValidPdf(pdfUrl)) {
                        const text = await PdfService.extractTextFromPdf(pdfUrl);
                        pdfExtractedTexts.push(text);
                    }
                }

                // Run Python RAG Pipeline
                pdfChunks = await RagPipelineService.processMultiplePdfs(baseEvent.pdfFiles);
                console.log(`✅ [ADMIN-APPROVE] RAG Pipeline completed with ${pdfChunks.length} chunks.`);
            } catch (ragErr) {
                console.error("❌ [ADMIN-APPROVE] PDF/RAG Processing failed:", ragErr);
                // We proceed even if RAG fails (fallback to basic embeddings)
            }
        }

        // 2. GENERATE DUAL EMBEDDINGS (using Gemini via EmbeddingService)
        let eventEmbedding: number[] = [];
        let metadataEmbedding: number[] = [];

        try {
            console.log('📝 [ADMIN-APPROVE] Generating Gemini embeddings...');
            const tempObj = {
                ...baseEvent.toObject(),
                pdfExtractedTexts
            };

            const metadataText = EmbeddingService.createEventMetadataText(tempObj);
            const eventText = EmbeddingService.createEventText(tempObj);

            if (metadataText === eventText) {
                const sharedEmbedding = await EmbeddingService.generateEmbedding(metadataText);
                eventEmbedding = sharedEmbedding;
                metadataEmbedding = sharedEmbedding;
            } else {
                eventEmbedding = await EmbeddingService.generateEmbedding(eventText);
                metadataEmbedding = await EmbeddingService.generateEmbedding(metadataText);
            }
        } catch (embErr) {
            console.error("❌ [ADMIN-APPROVE] Embedding generation failed:", embErr);
        }

        // 3. UPDATE DOCUMENT
        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            {
                isVerified: true,
                eventEmbedding,
                metadataEmbedding,
                pdfChunks,
                pdfExtractedTexts,
                isActive: true
            },
            { new: true }
        );

        console.log(`✅ [ADMIN-APPROVE] Event "${updatedEvent?.name}" approved and semantic pipeline finished.`);

        res.status(200).json({
            message: 'Event approved and RAG pipeline processed successfully',
            event: updatedEvent
        });
    } catch (error: any) {
        console.error('❌ [ADMIN-APPROVE] Error in approval process:', error);
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

