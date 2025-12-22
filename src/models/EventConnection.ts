import mongoose, { Schema, Document } from 'mongoose';
import { appConnection } from '../config/db';

export interface IEventConnection extends Document {
    eventId: mongoose.Types.ObjectId;
    organizerId: mongoose.Types.ObjectId;
    participantId: mongoose.Types.ObjectId;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const EventConnectionSchema: Schema = new Schema(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true,
        },
        organizerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        participantId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for finding connections by event
EventConnectionSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

export default appConnection.model<IEventConnection>('EventConnection', EventConnectionSchema);

