const { appConnection } = require('../config/db');
const mongoose = require('mongoose');

const NetworkCodeSchema = new mongoose.Schema(
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
    },
    {
        timestamps: true,
    }
);

// Index for faster querying
NetworkCodeSchema.index({ codeId: 1 });
NetworkCodeSchema.index({ keywords: 1 });
NetworkCodeSchema.index({ userId: 1 });

module.exports = appConnection.model('NetworkCode', NetworkCodeSchema);
