import mongoose from 'mongoose';
import Event from '../models/Event';
import connectDB from '../config/db';

const updateEvents = async () => {
    await connectDB();
    try {
        const result = await Event.updateMany(
            { isActive: { $exists: false } },
            { $set: { isActive: true } }
        );
        console.log(`Updated ${result.modifiedCount} events to have isActive: true.`);
    } catch (error) {
        console.error("Error updating events:", error);
    }
    process.exit();
};

updateEvents();
