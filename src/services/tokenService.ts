import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken";
import AdminUser from "../models/AdminUser";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

/**
 * Generate access token (short-lived, 15 minutes)
 */
export const generateAccessToken = (userId: string, email: string): string => {
  const payload = {
    id: userId,
    email,
    type: "access",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "1d", // Extended to 1 day to reduce refresh frequency
  });
};

/**
 * Generate refresh token (long-lived, configurable days)
 */
export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * Create and save refresh token in database
 */
export const createRefreshToken = async (
  userId: string,
  deviceId?: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<string> => {
  // Get refresh token expiry days from env (default: 30 days)
  let refreshTokenDays = 30;
  if (process.env.REFRESH_TOKEN_EXPIRE) {
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRE.replace('d', ''));
    if (!isNaN(days)) refreshTokenDays = days;
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenDays);

  const tokenString = generateRefreshTokenString();

  await RefreshToken.create({
    userId,
    token: tokenString,
    deviceId,
    deviceInfo,
    ipAddress,
    expiresAt,
  });

  return tokenString;
};

/**
 * Verify refresh token and return user
 */
export const verifyRefreshToken = async (
  token: string
): Promise<{ userId: string; email: string } | null> => {
  try {
    const refreshToken = await RefreshToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
    }).populate("userId");

    if (!refreshToken) {
      return null;
    }

    // SLIDING EXPIRATION: Extend the token life whenever it's used
    let refreshTokenDays = 30;
    if (process.env.REFRESH_TOKEN_EXPIRE) {
      const days = parseInt(process.env.REFRESH_TOKEN_EXPIRE.replace('d', ''));
      if (!isNaN(days)) refreshTokenDays = days;
    }
    refreshToken.expiresAt = new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
    await refreshToken.save();

    const user = await AdminUser.findById(refreshToken.userId).select("email");
    if (!user) {
      return null;
    }

    return {
      userId: refreshToken.userId.toString(),
      email: user.email,
    };
  } catch (error) {
    console.error("Error verifying refresh token:", error);
    return null;
  }
};

/**
 * Delete refresh token (logout)
 */
export const deleteRefreshToken = async (token: string): Promise<boolean> => {
  try {
    await RefreshToken.deleteOne({ token });
    return true;
  } catch (error) {
    console.error("Error deleting refresh token:", error);
    return false;
  }
};

/**
 * Delete all refresh tokens for a user (logout from all devices)
 */
export const deleteAllUserRefreshTokens = async (
  userId: string
): Promise<boolean> => {
  try {
    await RefreshToken.deleteMany({ userId });
    return true;
  } catch (error) {
    console.error("Error deleting all refresh tokens:", error);
    return false;
  }
};

/**
 * Check if user has active session
 */
export const hasActiveSession = async (
  userId: string,
  deviceId?: string
): Promise<boolean> => {
  try {
    const query: any = {
      userId,
      expiresAt: { $gt: new Date() },
    };

    if (deviceId) {
      query.deviceId = deviceId;
    }

    const count = await RefreshToken.countDocuments(query);
    return count > 0;
  } catch (error) {
    console.error("Error checking active session:", error);
    return false;
  }
};

/**
 * Get all active sessions for a user
 */
export const getUserSessions = async (userId: string) => {
  try {
    const sessions = await RefreshToken.find({
      userId,
      expiresAt: { $gt: new Date() },
    })
      .select("deviceId deviceInfo ipAddress createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return sessions;
  } catch (error) {
    console.error("Error getting user sessions:", error);
    return [];
  }
};

/**
 * Delete refresh token by device ID (logout from specific device)
 */
export const deleteRefreshTokenByDevice = async (
  userId: string,
  deviceId: string
): Promise<boolean> => {
  try {
    await RefreshToken.deleteOne({ userId, deviceId });
    return true;
  } catch (error) {
    console.error("Error deleting refresh token by device:", error);
    return false;
  }
};

