import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
    name: string;
    headline?: string;
    description: string;
    dateTime: Date;
    location: string;
    photos: string[]; // URLs
    videos: string[]; // URLs
    tags: string[];
    attachments: { name: string; url: string; type?: string }[];
    isVerified: boolean;
    isActive: boolean;
    createdBy: mongoose.Types.ObjectId;
    attendees: mongoose.Types.ObjectId[];
    eventEmbedding?: number[];
    createdAt: Date;
    updatedAt: Date;
}

const fileSchema = new Schema({
    name: String,
    url: String,
    type: String
}, { _id: false });

const eventSchema: Schema = new Schema(
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
            index: true, // Index for sorting/filtering by date
        },
        location: {
            type: String,
            required: true,
        },
        photos: {
            type: [String], // Array of URLs
            default: [],
        },
        videos: {
            type: [String], // Array of URLs
            default: [],
        },
        tags: {
            type: [String],
            index: true, // Index for searching by tags
        },
        attachments: [fileSchema],
        isVerified: {
            type: Boolean,
            default: false,
            index: true, // Index for filtering verified events
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true, // Index for filtering active/disabled events
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // Index for finding events by user
        },
        attendees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        eventEmbedding: {
            type: [Number],
            select: false, // Don't return by default
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for common queries (e.g., verified events sorted by date)
eventSchema.index({ isVerified: 1, dateTime: -1 });

import { appConnection } from '../config/db';

// ... (schema definition remains same, just replacing model creation)

const Event = appConnection.model<IEvent>("Event", eventSchema);

export default Event;
