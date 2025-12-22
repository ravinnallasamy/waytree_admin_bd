import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { adminConnection } from '../config/db';

export interface IAdminUser extends Document {
    email: string;
    password: string;
    name?: string;
    photoUrl?: string;
    role: 'admin' | 'superadmin';
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

// Match user entered password to hashed password in database
AdminUserSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default adminConnection.model<IAdminUser>('AdminUser', AdminUserSchema, 'admin_user');
