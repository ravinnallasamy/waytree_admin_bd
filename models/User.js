const mongoose = require('mongoose');
const { appConnection } = require('../config/db');

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            default: "",
            trim: true,
        },
        role: {
            type: String,
            enum: ["founder", "investor", "mentor", "cxo", "service", "other"],
            required: false,
        },
        primaryGoal: {
            type: String,
            enum: ["fundraising", "clients", "cofounder", "hiring", "learn", "other"],
            required: false,
        },
        company: {
            type: String,
            trim: true,
        },
        website: {
            type: String,
            trim: true,
        },
        location: {
            type: String,
            trim: true,
        },
        oneLiner: {
            type: String,
            trim: true,
        },
        photoUrl: {
            type: String,
            trim: true,
        },
        connectionCount: {
            type: Number,
            default: 0,
        },
        interests: {
            type: [String],
            default: [],
        },
        skills: {
            type: [String],
            default: [],
        },
        profileEmbedding: {
            type: [Number],
            select: false, // Don't return by default for performance
        },
    },
    {
        timestamps: true,
    }
);

// Indexes (matching App Backend)
UserSchema.index({ name: 1 });
UserSchema.index({ name: "text", email: "text", company: "text" });

const User = appConnection.model("User", UserSchema);

module.exports = User;
