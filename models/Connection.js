const { appConnection } = require('../config/db');
const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema(
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
        isBlocked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
ConnectionSchema.index({ codeId: 1 });
ConnectionSchema.index({ userId: 1 });
ConnectionSchema.index({ requestorId: 1 });
ConnectionSchema.index({ networkCodeId: 1 });
ConnectionSchema.index({ status: 1 });
ConnectionSchema.index({ codeId: 1, requestorId: 1 }, { unique: true });

module.exports = appConnection.model('Connection', ConnectionSchema);
