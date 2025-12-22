const mongoose = require('mongoose');
const { appConnection } = require('../config/db');

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        headline: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        dateTime: {
            type: Date,
            required: true,
        },
        location: {
            type: String,
            required: true,
        },
        photos: [
            {
                type: String, // Base64 strings
            },
        ],
        videos: [
            {
                type: String,
            },
        ],
        attachments: [
            {
                url: { type: String, required: true },
                name: { type: String, required: true },
                type: { type: String }
            }
        ],
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        isVerified: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        attendees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        eventEmbedding: [
            {
                type: Number,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes
eventSchema.index({ createdBy: 1 });
eventSchema.index({ dateTime: 1 });

const Event = appConnection.model("Event", eventSchema);

module.exports = Event;
