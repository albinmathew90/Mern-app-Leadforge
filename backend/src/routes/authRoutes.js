import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/user.js';
import { protect } from '../middleware/auth.js';
import { evictUser, registerSSE } from '../services/sessionRegistry.js';

const router = express.Router();

const generateToken = (id, sessionId) => {
    return jwt.sign({ id, sessionId }, process.env.JWT_SECRET || 'fallbacksecret123', { expiresIn: '7d' });
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Please fill in all parameters.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
        }

        let userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, error: 'User already exists' });
        }

        const user = await User.create({ name, email, password });

        // Generate a session ID for this new registration
        const sessionId = crypto.randomUUID();
        user.currentSessionId = sessionId;
        await user.save({ validateBeforeSave: false });

        return res.status(201).json({
            success: true,
            token: generateToken(user._id, sessionId),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join('. ') });
        }
        console.error("❌ CRITICAL BACKEND REGISTRATION ERROR:", err);
        return res.status(500).json({ success: false, error: 'Server error during registration.' });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═════════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Please enter all credentials.' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid email credentials or password' });
        }

        // Generate a new session ID — this invalidates any previous active session
        const sessionId = crypto.randomUUID();
        user.currentSessionId = sessionId;
        await user.save({ validateBeforeSave: false });

        // ── Instant SSE eviction ──────────────────────────────────────────────
        // Push SESSION_EVICTED to any browser tab that is currently open for
        // this user. The EventSource listener on the frontend fires immediately.
        evictUser(user._id);
        // ─────────────────────────────────────────────────────────────────────

        return res.json({
            success: true,
            token: generateToken(user._id, sessionId),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
    const { access_token } = req.body;
    try {
        // Fetch user info from Google using the access token
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        if (!googleRes.ok) throw new Error('Invalid Google access token');

        const payload = await googleRes.json();
        const { sub: googleId, email, name } = payload;

        let user = await User.findOne({ email });

        if (user) {
            // Update googleId if they already have an account but haven't linked Google
            if (!user.googleId) {
                user.googleId = googleId;
            }
        } else {
            // Create a new user without a password
            user = await User.create({ name, email, googleId });
        }

        // Generate a new session ID — this invalidates any previous active session
        const sessionId = crypto.randomUUID();
        user.currentSessionId = sessionId;
        await user.save({ validateBeforeSave: false });

        // ── Instant SSE eviction (Google login) ───────────────────────────────
        evictUser(user._id);
        // ─────────────────────────────────────────────────────────────────────

        return res.json({
            success: true,
            token: generateToken(user._id, sessionId),
            user: { id: user._id, name: user.name, email: user.email }
        });

    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(401).json({ success: false, error: 'Invalid Google token' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: 'There is no user with that email' });

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        //  NEW WAY (Reads frontend URL from your .env file)
        const clientUrl = process.env.APP_FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${clientUrl}/?resetToken=${resetToken}`;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const message = {
            from: `LeadForge <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You are receiving this email because you requested a password reset. Please click on the following link or paste it into your browser to complete the process:\n\n${resetUrl}\n\nThis link will expire in 10 minutes.`
        };

        await transporter.sendMail(message);
        res.status(200).json({ success: true, message: 'Email sent' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, error: 'Email could not be sent' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, password } = req.body;
        const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired token' });

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/events  — Server-Sent Events stream
// ─────────────────────────────────────────────────────────────────────────────
// The frontend opens this as an EventSource right after login.  The connection
// stays open (it is a long-lived HTTP response). When a new login for this
// account is processed, evictUser() writes a SESSION_EVICTED event here and
// closes the stream — the browser receives it within milliseconds.
// ═════════════════════════════════════════════════════════════════════════════
router.get('/events', protect, (req, res) => {
    // ── SSE headers — tuned for Azure App Service / IIS / ARR ────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');      // forces IIS/ARR into streaming (no buffering)
    res.setHeader('X-Accel-Buffering', 'no');           // disables Nginx buffering (if in the chain)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(200);
    res.flushHeaders();                                 // push all headers to client immediately

    // ── Initial handshake — confirms stream is live ───────────────────────────
    res.write('event: connected\ndata: {"status":"ok"}\n\n');
    if (typeof res.flush === 'function') res.flush();

    // ── Register in the in-memory session registry ────────────────────────────
    const cleanup = registerSSE(req.user._id, res);

    // ── Keep-alive ping every 20 s ───────────────────────────────────────────
    // Azure App Service / ARR closes idle HTTP connections after ~240 seconds.
    // Sending a SSE comment line (:ping) every 20 s keeps the connection alive.
    // The web.config httpRuntime executionTimeout="600" prevents IIS from
    // closing the long-lived request before the ping can reset the ARR timer.
    const keepAlive = setInterval(() => {
        try {
            res.write(':ping\n\n');
            if (typeof res.flush === 'function') res.flush();
        } catch {
            clearInterval(keepAlive);
        }
    }, 20_000);

    // ── Clean up on client disconnect ─────────────────────────────────────────
    req.on('close', () => {
        clearInterval(keepAlive);
        cleanup();
    });
});


// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/heartbeat  (kept as a fallback polling safety net)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/heartbeat', protect, (req, res) => {
    return res.json({ success: true, ok: true });
});

export default router;
