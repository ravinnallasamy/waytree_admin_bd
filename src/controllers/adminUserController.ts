import { Request, Response } from 'express';
import AdminUser from '../models/AdminUser';
import bcrypt from 'bcryptjs';

/**
 * Register a new Admin User
 */
export const registerAdmin = async (req: Request, res: Response) => {
    try {
        const { email, password, role, name, photoUrl } = req.body;

        // Check if admin user exists
        const existingAdmin = await AdminUser.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin user already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new AdminUser({
            email,
            password: hashedPassword,
            name,
            photoUrl,
            role: role || 'admin'
        });

        const savedAdmin = await newAdmin.save();

        // Remove password from response
        const { password: _, ...adminResponse } = savedAdmin.toObject();

        res.status(201).json(adminResponse);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating admin user', error: error.message });
    }
};

/**
 * Get all Admin Users
 */
export const getAllAdmins = async (req: Request, res: Response) => {
    try {
        const admins = await AdminUser.find({}).select('-password');
        res.status(200).json(admins);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching admin users', error: error.message });
    }
};

/**
 * Delete an Admin User
 */
export const deleteAdmin = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent deleting the last admin
        const adminCount = await AdminUser.countDocuments();
        if (adminCount <= 1) {
            return res.status(400).json({ message: 'Cannot delete the only admin' });
        }

        const result = await AdminUser.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.status(200).json({ message: 'Admin deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting admin', error: error.message });
    }
};
