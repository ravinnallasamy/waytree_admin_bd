import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const adminOptions = {
    dbName: 'admin_panel'
};

// Connections
// We remove hardcoded dbNames so they use what's specified in the .env URIs
export const adminConnection = mongoose.createConnection(process.env.ADMIN_DB_URI || '');
export const appConnection = mongoose.createConnection(process.env.APP_DB_URI || '');

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
