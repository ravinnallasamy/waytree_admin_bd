const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const adminOptions = {
    dbName: 'admin_panel'
};

const appOptions = {
    dbName: 'waytree_app' // Ensure this matches the actual app db name
};

const adminUri = process.env.ADMIN_DB_URI;
const appUri = process.env.APP_DB_URI;

console.log('DEBUG: URI Loaded check');
console.log('Admin URI:', adminUri ? adminUri.split('@')[1] : 'UNDEFINED');
console.log('App URI:', appUri ? appUri.split('@')[1] : 'UNDEFINED');

// Create connections
const adminConnection = mongoose.createConnection(adminUri, adminOptions);
const appConnection = mongoose.createConnection(appUri, appOptions);

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

module.exports = { adminConnection, appConnection };
