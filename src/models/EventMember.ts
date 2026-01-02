import mongoose, { Schema, Document } from 'mongoose';
import { appConnection } from '../config/db';

export interface IEventMember extends Document {
    eventId: mongoose.Types.ObjectId;
    organizerId: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId; // Optional, might be null if manually added
    name: string;
    phoneNumber?: string;
    source: 'join' | 'manual' | 'excel';
    joinedAt: Date;
}

const EventMemberSchema: Schema = new Schema({
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    source: {
        type: String,
        enum: ['join', 'manual', 'excel'],
        default: 'join'
    },
    joinedAt: { type: Date, default: Date.now },
});

// Indexes for faster lookups
EventMemberSchema.index({ eventId: 1, phoneNumber: 1 }); // To prevent duplicates based on phone
EventMemberSchema.index({ eventId: 1, userId: 1 }); // To prevent duplicates based on userId

export default appConnection.model<IEventMember>('EventMember', EventMemberSchema);
