import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
    email: string;
    name: string;
    role?: string;
    primaryGoal?: string;
    company?: string;
    website?: string;
    location?: string;
    isBlocked?: boolean;
    oneLiner?: string;
    photoUrl?: string;
    phoneNumber?: string;
    connectionCount: number;
    interests: string[];
    skills: string[];
    profileEmbedding?: number[];
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
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
            required: false,
        },
        primaryGoal: {
            type: String,
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
        isBlocked: {
            type: Boolean,
            default: false,
        },
        oneLiner: {
            type: String,
            trim: true,
        },
        photoUrl: {
            type: String,
            trim: true,
        },
        phoneNumber: {
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
            select: false,
        },
    },
    {
        timestamps: true,
    }
);

import { appConnection } from '../config/db';

export default appConnection.model<IUser>("User", UserSchema, "users");
