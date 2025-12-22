import mongoose, { Schema, Document } from 'mongoose';

export interface IConnection extends Document {
    networkCodeId: mongoose.Types.ObjectId;
    codeId: string;
    userId: mongoose.Types.ObjectId;
    requestorId: mongoose.Types.ObjectId;
    status: "pending" | "accepted" | "rejected";
    autoConnected: boolean;
    connectionDate: Date;
    message?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ConnectionSchema: Schema = new Schema(
    {
        networkCodeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "NetworkCode",
            required: true,
        },
        codeId: {
            type: String,
            required: true,
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        requestorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
        autoConnected: {
            type: Boolean,
            default: false,
        },
        connectionDate: {
            type: Date,
            default: Date.now,
        },
        message: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

ConnectionSchema.index({ codeId: 1, requestorId: 1 }, { unique: true });

import { appConnection } from '../config/db';

const Connection = appConnection.model<IConnection>('Connection', ConnectionSchema);

export default Connection;
