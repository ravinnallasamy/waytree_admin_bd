import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import NetworkCode from './models/NetworkCode';
import Connection from './models/Connection';

dotenv.config();

const seedDatabase = async () => {
    try {
        const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/admin-panel';

        await mongoose.connect(MONGODB_URI, {
            dbName: 'networkcode',
        });

        console.log('Connected to MongoDB for seeding...');

        // 1. Create an Admin User
        const adminEmail = 'admin@example.com';
        let adminUser = await User.findOne({ email: adminEmail });

        if (!adminUser) {
            adminUser = new User({
                name: 'Admin User',
                email: adminEmail,
                role: 'cxo',
                location: 'Headquarters',
                company: 'Admin Corp',
                website: 'https://admin.com',
                oneLiner: 'Managing the platform',
                primaryGoal: 'hiring',
                connectionCount: 100,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await adminUser.save();
            console.log('✔ User collection created (Admin user added)');
        } else {
            console.log('ℹ User collection already exists');
        }

        // 2. Create a Network Code
        const code = 'NC001';
        let networkCode = await NetworkCode.findOne({ code });

        if (!networkCode) {
            networkCode = new NetworkCode({
                code: code,
                createdBy: adminUser._id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await networkCode.save();
            console.log('✔ NetworkCode collection created (NC001 added)');
        } else {
            console.log('ℹ NetworkCode collection already exists');
        }

        // 3. Create a Connection
        // Let's create a dummy member to connect
        const memberEmail = 'member@example.com';
        let memberUser = await User.findOne({ email: memberEmail });

        if (!memberUser) {
            memberUser = new User({
                name: 'Member User',
                email: memberEmail,
                role: 'founder',
                location: 'Remote',
                company: 'Tech Startup Inc.',
                website: 'https://example.com',
                oneLiner: 'Building the future of AI',
                primaryGoal: 'fundraising',
                photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                connectionCount: 5,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await memberUser.save();
        }

        const existingConnection = await Connection.findOne({ user: memberUser._id, networkCode: networkCode._id });

        if (!existingConnection) {
            const newConnection = new Connection({
                user: memberUser._id,
                networkCode: networkCode._id,
                status: 'Connected',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await newConnection.save();
            console.log('✔ Connection collection created (User connected to NC001)');
        } else {
            console.log('ℹ Connection collection already exists');
        }

        console.log('\nSUCCESS: All collections (users, networkcodes, connections) are now initialized in the database.');
        process.exit(0);

    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
