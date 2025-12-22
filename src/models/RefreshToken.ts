import mongoose, { Document, Schema } from "mongoose";
import { adminConnection } from "../config/db";

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  deviceId?: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "AdminUser",
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      index: true,
    },
    deviceInfo: {
      type: String, // e.g., "Chrome on Windows", "Mobile App"
    },
    ipAddress: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired tokens
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster lookups
RefreshTokenSchema.index({ userId: 1, deviceId: 1 });

export default adminConnection.model<IRefreshToken>(
  "RefreshToken",
  RefreshTokenSchema,
  "admin_refresh_tokens"
);

