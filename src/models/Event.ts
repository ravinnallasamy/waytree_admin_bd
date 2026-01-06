import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
    name: string;
    headline?: string;
    description: string;
    dateTime?: Date;
    location: string;
    photos: string[]; // Base64 or URLs
    videos: string[]; // URLs
    tags: string[];
    pdfFiles?: string[]; // Array of Base64 encoded PDFs
    pdfExtractedTexts?: string[];
    isEvent: boolean;
    isCommunity: boolean;
    isVerified: boolean;
    isActive: boolean;
    isAdmin: boolean;
    createdBy: mongoose.Types.ObjectId;
    attendees: mongoose.Types.ObjectId[];
    metadataEmbedding?: number[];
    eventEmbedding?: number[];
    pdfChunks?: {
        chunkId: string;
        text: string;
        embedding: number[];
    }[];
    attachments?: {
        url: string;
        name: string;
        type?: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

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
            required: false,
        },
        location: {
            type: String,
            required: true,
        },
        photos: {
            type: [String],
            default: [],
        },
        videos: {
            type: [String],
            default: [],
        },
        tags: {
            type: [String],
            default: [],
        },
        pdfFiles: {
            type: [String],
            default: [],
        },
        pdfExtractedTexts: {
            type: [String],
            default: [],
        },
        attachments: [
            {
                url: { type: String, required: true },
                name: { type: String, required: true },
                type: { type: String }
            }
        ],
        isEvent: {
            type: Boolean,
            default: true,
        },
        isCommunity: {
            type: Boolean,
            default: false,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isAdmin: {
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
        metadataEmbedding: [Number],
        eventEmbedding: [Number],
        pdfChunks: [
            {
                chunkId: String,
                text: String,
                embedding: [Number]
            }
        ],
    },
    {
        timestamps: true,
    }
);

eventSchema.index({ isVerified: 1, isEvent: 1, isCommunity: 1 });
eventSchema.index({ dateTime: 1 });

import { appConnection } from '../config/db';

// ... (schema definition remains same, just replacing model creation)

const Event = appConnection.model<IEvent>("Event", eventSchema, "events");

export default Event;
