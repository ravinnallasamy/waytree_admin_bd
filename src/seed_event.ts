import mongoose from 'mongoose';
import Event from './models/Event';
import User from './models/User';
import dotenv from 'dotenv';

dotenv.config();

const sampleEvents = [
    {
        name: 'Tech Innovation Summit 2025',
        headline: 'The Future of AI and Robotics',
        description: 'Join us for a day of insightful talks and networking with industry leaders. We will explore the latest trends in Artificial Intelligence, Robotics, and Quantum Computing. \n\nAgenda:\n- 9:00 AM: Keynote Speech\n- 10:30 AM: Panel Discussion\n- 12:00 PM: Networking Lunch',
        dateTime: new Date('2025-12-25T10:00:00'),
        location: 'San Francisco Convention Center',
        photos: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80'],
        videos: [],
        tags: ['AI', 'Tech', 'Networking'],
        attachments: [
            { name: 'Event Brochure.pdf', url: 'https://example.com/brochure.pdf', type: 'PDF' },
            { name: 'Speaker List.docx', url: 'https://example.com/speakers.docx', type: 'DOCX' }
        ],
        isVerified: true,
    },
    {
        name: 'Startup Pitch Night',
        headline: 'Meet the next unicorns',
        description: 'Watch 10 early-stage startups pitch their ideas to a panel of top investors. Great opportunity to network and find co-founders.',
        dateTime: new Date('2025-11-15T18:00:00'),
        location: 'The Hive, New York',
        photos: ['https://images.unsplash.com/photo-1515187029135-18ee286d815b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80'],
        videos: [],
        tags: ['Startup', 'Pitch', 'Investment'],
        attachments: [],
        isVerified: true,
    },
    {
        name: 'Web3 & Blockchain Workshop',
        headline: 'Hands-on coding session',
        description: 'Learn how to build decentralized applications (dApps) on Ethereum. Bring your laptop!',
        dateTime: new Date('2025-10-20T14:00:00'),
        location: 'TechHub, London',
        photos: ['https://images.unsplash.com/photo-1639762681485-074b7f938ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80'],
        videos: [],
        tags: ['Blockchain', 'Web3', 'Coding'],
        attachments: [
            { name: 'Prerequisites.pdf', url: 'https://example.com/prereqs.pdf', type: 'PDF' }
        ],
        isVerified: false, // Pending event
    }
];

const seedEvents = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'networkcode'
        });
        console.log('Connected to MongoDB (networkcode database)');

        // 1. Find or Create User
        let user = await User.findOne({});
        if (!user) {
            console.log('No user found, creating a default user...');
            user = await User.create({
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'founder',
                primaryGoal: 'other'
            });
        }
        console.log(`Using user: ${user.name} (${user._id})`);

        // 2. Clear existing events
        console.log('Clearing existing events...');
        await Event.deleteMany({});

        // 3. Prepare events with createdBy
        const eventsToInsert = sampleEvents.map(event => ({
            ...event,
            createdBy: user!._id
        }));

        // 4. Insert new events
        console.log(`Seeding ${eventsToInsert.length} events...`);
        const createdEvents = await Event.insertMany(eventsToInsert);

        console.log('Successfully seeded events:');
        createdEvents.forEach(e => console.log(`- ${e.name} (${e._id})`));

        process.exit(0);
    } catch (error) {
        console.error('Error seeding events:', error);
        process.exit(1);
    }
};

seedEvents();
