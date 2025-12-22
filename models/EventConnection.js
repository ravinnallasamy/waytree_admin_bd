const mongoose = require('mongoose');
const { appConnection } = require('../config/db');

// Make sure we're using the correct connection
const connection = appConnection || mongoose.connection;

const eventConnectionSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // You can add more fields specific to the connection if needed
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    // Add any other relevant fields here
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add index for better query performance
eventConnectionSchema.index({ eventId: 1, userId: 1 }, { unique: true });

// Add a method to get connections by event ID
eventConnectionSchema.statics.findByEventId = function(eventId, page = 1, limit = 10) {
    return this.find({ eventId })
        .populate('userId', 'name email profilePicture')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
};

// Add a method to count connections by event ID
eventConnectionSchema.statics.countByEventId = function(eventId) {
    return this.countDocuments({ eventId });
};

// Create the model using the correct connection
const EventConnection = connection.model('EventConnection', eventConnectionSchema);

// Verify the model is properly registered
if (!connection.models.EventConnection) {
    connection.model('EventConnection', eventConnectionSchema);
}

module.exports = EventConnection;
