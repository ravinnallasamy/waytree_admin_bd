import mongoose, { Schema, Document } from 'mongoose';

export interface INetworkCode extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    codeId: string;
    description: string;
    keywords: string[];
    autoConnect: boolean;
    isActive: boolean;
    isBlocked: boolean;
    expirationTime: Date | null;
    qrCodeUrl: string;
    mediaUrls: string[];
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const NetworkCodeSchema: Schema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        codeId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        keywords: [
            {
                type: String,
                trim: true,
            },
        ],
        autoConnect: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        expirationTime: {
            type: Date,
            default: null,
        },
        qrCodeUrl: {
            type: String,
            required: true,
        },
        mediaUrls: [
            {
                type: String,
                trim: true,
            },
        ],
        isVerified: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

import { appConnection } from '../config/db';

const NetworkCode = appConnection.model<INetworkCode>('NetworkCode', NetworkCodeSchema);

export default NetworkCode;
