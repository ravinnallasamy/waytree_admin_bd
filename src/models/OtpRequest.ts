import mongoose, { Schema, Document } from 'mongoose';
import { adminConnection } from '../config/db';

export interface IOtpRequest extends Document {
    email: string;
    otpHash: string;
    expiresAt: Date;
    consumed: boolean;
    createdAt: Date;
}

const OtpRequestSchema: Schema = new Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        otpHash: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        consumed: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Index for cleanup of expired OTPs
OtpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default adminConnection.model<IOtpRequest>('OtpRequest', OtpRequestSchema);
