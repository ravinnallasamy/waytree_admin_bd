import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { adminConnection } from '../config/db';

export interface IAdminUser extends Document {
    email: string;
    password: string;
    name?: string;
    photoUrl?: string;
    role: 'admin' | 'superadmin';
    preferences?: {
        theme: 'light' | 'dark' | 'system';
        notifications: {
            email: boolean;
            inApp: boolean;
            marketing: boolean;
        };
        ui: {
            density: 'comfortable' | 'compact';
            sidebarCollapsed: boolean;
        };
    };
    createdAt: Date;
    updatedAt: Date;
    matchPassword(enteredPassword: string): Promise<boolean>;
}

const AdminUserSchema: Schema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            trim: true,
        },
        photoUrl: {
            type: String, // URL or base64
        },
        role: {
            type: String,
            enum: ['admin', 'superadmin'],
            default: 'admin',
        },
    },
    {
        timestamps: true,
    }
);

AdminUserSchema.add({
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        },
        notifications: {
            email: { type: Boolean, default: true },
            inApp: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false }
        },
        ui: {
            density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
            sidebarCollapsed: { type: Boolean, default: false }
        }
    }
});

// Match user entered password to hashed password in database
AdminUserSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default adminConnection.model<IAdminUser>('AdminUser', AdminUserSchema, 'admin_user');
