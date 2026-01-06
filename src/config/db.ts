import mongoose from 'mongoose';
import dotenv from 'dotenv';

import path from 'path';

// Try loading .env from current directory (default) and parent (just in case)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('🔌 Debug: Loading DB Config...');
const adminUri = process.env.ADMIN_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
const appUri = process.env.APP_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;

console.log('🔌 Admin DB URI:', adminUri ? 'Found' : 'MISSING');
console.log('🔌 App DB URI:', appUri ? 'Found' : 'MISSING');

if (!adminUri) {
    throw new Error('❌ FATAL: ADMIN_DB_URI is not defined in .env');
}

if (!appUri) {
    console.warn('⚠️ WARNING: APP_DB_URI is not defined. Using Admin URI or failing.');
}

// Connections
export const adminConnection = mongoose.createConnection(adminUri as string);
export const appConnection = mongoose.createConnection(appUri || (adminUri as string));

// Event listeners
adminConnection.on('connected', () => {
    console.log('✅ Connected to Admin DB');
});
adminConnection.on('error', (err) => {
    console.error('❌ Admin DB Connection Error:', err);
});

appConnection.on('connected', () => {
    console.log('✅ Connected to App DB');
});
appConnection.on('error', (err) => {
    console.error('❌ App DB Connection Error:', err);
});

// For backward compatibility if needed, or just remove default export
const connectDB = async () => {
    console.log('⚠️ connectDB() called: This is deprecated. Use exported connections directly.');
};
export default connectDB;
