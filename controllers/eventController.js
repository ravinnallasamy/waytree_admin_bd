const Event = require('../models/Event');
const User = require('../models/User');
const EventConnection = require('../models/EventConnection');

// Get all verified events
exports.getVerifiedEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Filter by isActive unless explicitly requested to include disabled
        // Note: isActive removed from schema to match App Backend. Using isVerified.
        const query = { isVerified: true };

        const events = await Event.find(query)
            .select('-photos -videos') // Exclude ALL heavy fields for list view
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Event.countDocuments(query);

        res.status(200).json({
            events,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalEvents: total
        });
    } catch (error) {
        console.error('Error in getVerifiedEvents:', error);
        res.status(500).json({ message: 'Error fetching verified events', error: error.message });
    }
};

// Get event thumbnail
exports.getEventThumbnail = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id).select('photos').slice('photos', 1);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const thumbnail = event.photos && event.photos.length > 0 ? event.photos[0] : null;
        res.status(200).json({ thumbnail });
    } catch (error) {
        console.error('Error in getEventThumbnail:', error);
        res.status(500).json({ message: 'Error fetching thumbnail', error: error.message });
    }
};

// Get event by ID
exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json(event);
    } catch (error) {
        console.error('Error in getEventById:', error);
        res.status(500).json({ message: 'Error fetching event details', error: error.message });
    }
};

// Get all unverified (pending) events
exports.getPendingEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const events = await Event.find({ isVerified: false })
            .select('-photos -videos') // Exclude ALL heavy fields for list view
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Event.countDocuments({ isVerified: false });

        res.status(200).json({
            events,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalEvents: total
        });
    } catch (error) {
        console.error('Error in getPendingEvents:', error);
        res.status(500).json({ message: 'Error fetching pending events', error: error.message });
    }
};

// Approve event
exports.approveEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findByIdAndUpdate(
            id,
            { isVerified: true },
            { new: true }
        );

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event approved successfully', event });
    } catch (error) {
        res.status(500).json({ message: 'Error approving event', error: error.message });
    }
};

// Reject event (Delete event)
exports.rejectEvent = async (req, res) => {
    try {
        const { id } = req.params;
        // Option 1: Set isVerified to false (but it's already false if pending)
        // Option 2: Delete the event (as per user suggestion "or delete event")
        // We will delete it to remove it from the pending list.
        const event = await Event.findByIdAndDelete(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event rejected and deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting event', error: error.message });
    }
};

// Toggle Event Status (Mapped to Verification for now as App Backend has no isActive)
exports.toggleEventStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Toggle verification
        const isCurrentlyVerified = event.isVerified;
        event.isVerified = !isCurrentlyVerified;

        await event.save();

        res.status(200).json({
            message: `Event ${event.isVerified ? 'verified' : 'unverified'} successfully`,
            event
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating event status', error: error.message });
    }
};

// Get event connections
exports.getEventConnections = async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 9);
    
    const log = (message, data = {}) => {
        console.log(`[${requestId}] ${message}`, Object.keys(data).length ? data : '');
    };

    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        log('🔍 Request received', { 
            method: req.method, 
            url: req.originalUrl,
            params: req.params,
            query: req.query,
            headers: req.headers 
        });

        // Verify mongoose connection
        const mongoose = require('mongoose');
        log('🔌 Database connection state', {
            readyState: mongoose.connection.readyState,
            dbName: mongoose.connection.name,
            host: mongoose.connection.host,
            db: mongoose.connection.db ? 'Connected' : 'Not connected',
            models: Object.keys(mongoose.connection.models)
        });

        // Verify model exists
        const modelNames = Object.keys(mongoose.connection.models);
        log('📋 Available models', { modelNames });
        
        // Check if EventConnection model exists
        const EventConnectionModel = mongoose.connection.models['EventConnection'];
        log('🔍 Checking EventConnection model', { 
            exists: !!EventConnectionModel,
            collectionName: EventConnectionModel?.collection?.name,
            modelSchema: EventConnectionModel ? 'Found' : 'Not found'
        });

        // Verify event exists
        log('🔍 Checking if event exists', { eventId: id });
        const event = await Event.findById(id).lean();
        if (!event) {
            log('❌ Event not found', { eventId: id });
            return res.status(404).json({ 
                success: false,
                message: 'Event not found',
                requestId
            });
        }

        log('✅ Event found, fetching connections...', { 
            eventId: id,
            eventTitle: event.title
        });

        // Get connections
        log('🔍 Querying EventConnection collection...');
        const [connections, total] = await Promise.all([
            EventConnection.find({ eventId: id })
                .populate('userId', 'name email profilePicture')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            EventConnection.countDocuments({ eventId: id })
        ]);

        log('📊 Connections retrieved', { 
            count: connections.length,
            total,
            page,
            limit,
            executionTime: `${Date.now() - startTime}ms`
        });

        res.status(200).json({
            success: true,
            connections: connections || [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            requestId
        });

    } catch (error) {
        console.error(`[${requestId}] ❌ Error in getEventConnections:`, {
            error: error.message,
            stack: error.stack,
            executionTime: `${Date.now() - startTime}ms`
        });

        res.status(500).json({ 
            success: false,
            message: 'Error fetching event connections',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId
        });
    }
};

// Delete Event (Generic)
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findByIdAndDelete(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
};

// Create new event
exports.createEvent = async (req, res) => {
    try {
        console.log("Received create event request body:", JSON.stringify(req.body, (key, value) => {
            if (key === 'images' || key === 'preview') return '[BASE64_DATA]'; // Truncate long base64 strings for logging
            return value;
        }, 2));

        const eventData = req.body;

        // Since we don't have authentication yet, we'll use a dummy ObjectId for createdBy
        // In a real app, this would come from req.user._id
        const mongoose = require('mongoose');
        const dummyUserId = new mongoose.Types.ObjectId();

        const newEvent = new Event({
            ...eventData,
            name: eventData.title, // Map title to name as per schema
            dateTime: new Date(`${eventData.date}T${eventData.time}`), // Combine date and time
            photos: eventData.images ? eventData.images.map(img => img.preview) : [], // Assuming preview is base64
            videos: eventData.video && eventData.video.preview ? [eventData.video.preview] : [], // Map single video to array
            attachments: eventData.attachments || [],
            createdBy: dummyUserId,
            isVerified: eventData.status === 'verified'
        });

        const savedEvent = await newEvent.save();
        res.status(201).json(savedEvent);
    } catch (error) {
        console.error("Error creating event FULL ERROR:", error);
        res.status(500).json({ message: `Error creating event: ${error.message}`, error: error.message, details: error.errors });
    }
};
