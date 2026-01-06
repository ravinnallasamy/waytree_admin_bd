import mongoose, { Schema, Document } from 'mongoose';
import { adminConnection } from '../config/db';

export interface IPlatformSettings extends Document {
    verification: {
        autoVerifyEvents: boolean;
        autoVerifyCommunities: boolean;
        requirePhoneVerification: boolean;
    };
    security: {
        sessionTimeoutMinutes: number;
        enforceMfa: boolean;
    };
    limits: {
        maxDailyEventsPerUser: number;
        maxUploadSizeMB: number;
    };
    features: {
        enableNetworkCodes: boolean;
        maintenanceMode: boolean;
    };
    updatedBy?: mongoose.Types.ObjectId;
    updatedAt: Date;
}

const PlatformSettingsSchema: Schema = new Schema(
    {
        verification: {
            autoVerifyEvents: { type: Boolean, default: false },
            autoVerifyCommunities: { type: Boolean, default: false },
            requirePhoneVerification: { type: Boolean, default: false },
        },
        security: {
            sessionTimeoutMinutes: { type: Number, default: 60 },
            enforceMfa: { type: Boolean, default: false },
        },
        limits: {
            maxDailyEventsPerUser: { type: Number, default: 5 },
            maxUploadSizeMB: { type: Number, default: 10 },
        },
        features: {
            enableNetworkCodes: { type: Boolean, default: true },
            maintenanceMode: { type: Boolean, default: false },
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'AdminUser'
        }
    },
    {
        timestamps: true,
        capped: { size: 1024, max: 1 } // Singleton: ensure only one document exists
    }
);

// Helper to ensure singleton exists
PlatformSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

export default adminConnection.model<IPlatformSettings>('PlatformSettings', PlatformSettingsSchema, 'platform_settings');
