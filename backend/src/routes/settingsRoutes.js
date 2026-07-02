import express from 'express';
import Settings from '../models/Settings.js';
import User from '../models/user.js';
import Lead from '../models/Lead.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

const router = express.Router();

export async function getGlobalSettings() {
    let s = await Settings.findOne({ singleton: 'GLOBAL' });
    if (!s) {
        s = await Settings.create({
            adminUsername: 'admin',
            smtpUser: process.env.SMTP_USER || '',
            smtpPass: process.env.SMTP_PASS || '',
            smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
            smtpPort: parseInt(process.env.SMTP_PORT || '465'),
            imapHost: process.env.IMAP_HOST || 'imap.gmail.com',
            imapPort: parseInt(process.env.IMAP_PORT || '993'),
            adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
            emailDelaySeconds: 1.5,
            maxLeadsPerRun: 500
        });
    }
    return s;
}

const loginAttempts = new Map();

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const ip = req.ip;
        const now = Date.now();
        
        let attemptData = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
        
        if (attemptData.lockUntil > now) {
            const minsLeft = Math.ceil((attemptData.lockUntil - now) / 60000);
            return res.status(429).json({ success: false, error: `Too many failed attempts. Locked for ${minsLeft} minutes.` });
        }

        const { username, password } = req.body;
        const s = await getGlobalSettings();
        
        if (username === s.adminUsername && password === s.adminPassword) {
            loginAttempts.delete(ip);
            const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'fallbacksecret123', { expiresIn: '1d' });
            res.json({ success: true, token });
        } else {
            attemptData.count += 1;
            
            if (attemptData.count >= 5) {
                attemptData.lockUntil = now + 30 * 60 * 1000; // 30 minutes
                loginAttempts.set(ip, attemptData);
                return res.status(429).json({ success: false, error: 'Maximum attempts reached. Locked for 30 minutes.' });
            }
            
            loginAttempts.set(ip, attemptData);
            
            let errorMsg = 'Invalid username or password';
            if (attemptData.count >= 3) {
                const triesLeft = 5 - attemptData.count;
                errorMsg = `Invalid credentials. Only ${triesLeft} tries left!`;
            }
            res.status(401).json({ success: false, error: errorMsg });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware for Admin Protect
const adminProtect = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw new Error('No token provided');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallbacksecret123');
        if (decoded.role === 'admin') next();
        else throw new Error('Not authorized as admin');
    } catch (e) {
        res.status(401).json({ error: 'Not authorized as admin' });
    }
};

// Get settings
router.get('/', adminProtect, async (req, res) => {
    try {
        const s = await getGlobalSettings();
        // Hide password in response
        res.json({ success: true, data: {
            adminUsername: s.adminUsername,
            smtpUser: s.smtpUser,
            smtpPass: s.smtpPass,
            smtpHost: s.smtpHost,
            smtpPort: s.smtpPort,
            imapHost: s.imapHost,
            imapPort: s.imapPort,
            adminPassword: s.adminPassword,
            emailDelaySeconds: s.emailDelaySeconds,
            maxLeadsPerRun: s.maxLeadsPerRun
        } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update settings
router.put('/', adminProtect, async (req, res) => {
    try {
        const s = await getGlobalSettings();
        const { adminUsername, smtpUser, smtpPass, smtpHost, smtpPort, imapHost, imapPort, adminPassword, emailDelaySeconds, maxLeadsPerRun } = req.body;
        
        if (adminUsername !== undefined) s.adminUsername = adminUsername;
        if (smtpUser !== undefined) s.smtpUser = smtpUser;
        if (smtpPass !== undefined) s.smtpPass = smtpPass;
        if (smtpHost !== undefined) s.smtpHost = smtpHost;
        if (smtpPort !== undefined) s.smtpPort = smtpPort;
        if (imapHost !== undefined) s.imapHost = imapHost;
        if (imapPort !== undefined) s.imapPort = imapPort;
        if (adminPassword !== undefined) s.adminPassword = adminPassword;
        if (emailDelaySeconds !== undefined) s.emailDelaySeconds = emailDelaySeconds;
        if (maxLeadsPerRun !== undefined) s.maxLeadsPerRun = maxLeadsPerRun;
        
        await s.save();
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all users and their stats
router.get('/users', adminProtect, async (req, res) => {
    try {
        const users = await User.find({ email: { $ne: 'admin@leadforge.com' } }).select('-password -resetPasswordToken -resetPasswordExpire').lean();
        
        // Fetch stats for each user
        const usersWithStats = await Promise.all(users.map(async (u) => {
            const totalLeads = await Lead.countDocuments({ user: u._id });
            const emailsSent = await Lead.countDocuments({ user: u._id, status: { $in: ['sent', 'replied'] } });
            return {
                ...u,
                totalLeads,
                emailsSent
            };
        }));
        
        res.json({ success: true, data: usersWithStats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a user
router.delete('/users/:id', adminProtect, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Delete all leads associated with the user
        await Lead.deleteMany({ user: userId });
        
        // Delete the user
        await User.findByIdAndDelete(userId);
        
        res.json({ success: true, message: 'User and all associated data deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
