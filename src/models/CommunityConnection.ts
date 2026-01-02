import mongoose, { Schema, Document } from 'mongoose';
import { appConnection } from '../config/db';

export interface ICommunityConnection extends Document {
    eventId: mongoose.Types.ObjectId;
    organizerId: mongoose.Types.ObjectId;
    participantId: mongoose.Types.ObjectId;
    joinedAt: Date;
}

const CommunityConnectionSchema: Schema = new Schema({
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
});

// Explicitly use 'communityconnections' collection to match app's backend
export default appConnection.model<ICommunityConnection>('CommunityConnection', CommunityConnectionSchema, 'communityconnections');
