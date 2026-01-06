import { Request, Response } from 'express';
import AdminUser from '../models/AdminUser';
import PlatformSettings from '../models/PlatformSettings';

// --- User Preferences ---

export const getMySettings = async (req: any, res: Response) => {
    try {
        const user = await AdminUser.findById(req.user._id).select('preferences name email photoUrl');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return defaults if preferences are missing
        const defaultPreferences = {
            theme: 'system',
            notifications: { email: true, inApp: true, marketing: false },
            ui: { density: 'comfortable', sidebarCollapsed: false }
        };

        const mergedPreferences = {
            ...defaultPreferences,
            ...((user.preferences as any) || {}), // Cast to any to safely handle missing props
            // Deep merge for nested objects if needed, but simple spread works for one level depth usually.
            // Better to be explicit:
            notifications: { ...defaultPreferences.notifications, ...((user.preferences?.notifications) || {}) },
            ui: { ...defaultPreferences.ui, ...((user.preferences?.ui) || {}) },
            theme: user.preferences?.theme || defaultPreferences.theme
        };

        res.json({
            success: true,
            data: {
                profile: {
                    name: user.name,
                    email: user.email,
                    photoUrl: user.photoUrl
                },
                preferences: mergedPreferences
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateMySettings = async (req: any, res: Response) => {
    try {
        const { preferences, profile } = req.body;
        const user = await AdminUser.findById(req.user._id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (preferences) {
            // Merge existing preferences
            user.preferences = {
                ...user.preferences, // existing Mongoose object
                ...preferences,
                notifications: { ...user.preferences?.notifications, ...preferences.notifications },
                ui: { ...user.preferences?.ui, ...preferences.ui }
            };
        }

        // Optional: Allow updating basic profile info here too
        if (profile) {
            if (profile.name) user.name = profile.name;
        }

        await user.save();
        res.json({ success: true, message: 'Settings saved', data: user.preferences });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


// --- Platform Settings (Admin Only) ---

export const getPlatformSettings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore - Custom static method
        const settings = await PlatformSettings.getSettings();
        res.json({ success: true, data: settings });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePlatformSettings = async (req: any, res: Response) => {
    try {
        const updates = req.body;
        // @ts-ignore
        let settings = await PlatformSettings.getSettings();

        // Update fields safely
        if (updates.verification) settings.verification = { ...settings.verification, ...updates.verification };
        if (updates.limits) settings.limits = { ...settings.limits, ...updates.limits };
        if (updates.features) settings.features = { ...settings.features, ...updates.features };
        if (updates.security) settings.security = { ...settings.security, ...updates.security };

        settings.updatedBy = req.user._id;

        await settings.save();
        res.json({ success: true, message: 'Platform settings updated', data: settings });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
