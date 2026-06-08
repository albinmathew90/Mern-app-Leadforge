import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import leadRoutes, { checkRepliesViaImap } from './src/routes/leadRoutes.js';
import Lead from './src/models/Lead.js';

dotenv.config();

const app = express();

//  DYNAMIC CORS: Read origins from .env file, fallback to localhost if empty
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Establish connection to MongoDB instance
connectDB();

// Core Route Mount Engine Points
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);

// ═══════════════════════════════════════════════════════════════
// AUTO REPLY CHECK SCHEDULER
// ═══════════════════════════════════════════════════════════════
const AUTO_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let lastAutoCheckTime = null;
let nextAutoCheckTime = null;
let autoCheckRunning = false;

async function runAutoReplyCheck() {
    if (autoCheckRunning) {
        console.log('[AutoCheck] Previous check still running, skipping this cycle');
        return;
    }
    autoCheckRunning = true;
    lastAutoCheckTime = new Date();
    nextAutoCheckTime = new Date(Date.now() + AUTO_CHECK_INTERVAL_MS);

    try {
        const usersWithSentEmails = await Lead.distinct('user', {
            status: { $in: ['sent', 'replied'] },
            messageId: { $exists: true, $ne: '' },
        });

        if (!usersWithSentEmails.length) {
            console.log('[AutoCheck] No users with sent emails — skipping');
            return;
        }

        console.log(`[AutoCheck] ⏰ Running for ${usersWithSentEmails.length} user(s)...`);

        for (const userId of usersWithSentEmails) {
            try {
                const result = await checkRepliesViaImap(userId.toString());
                if (result.newReplies > 0) {
                    console.log(`[AutoCheck] 🎉 Found ${result.newReplies} new repl${result.newReplies > 1 ? 'ies' : 'y'} for user ${userId}`);
                } else {
                    console.log(`[AutoCheck] 📭 No new replies for user ${userId}`);
                }
            } catch (err) {
                console.error(`[AutoCheck] ❌ Error for user ${userId}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[AutoCheck] Scheduler error:', err.message);
    } finally {
        autoCheckRunning = false;
        console.log(`[AutoCheck] ✅ Done. Next check at ${nextAutoCheckTime.toLocaleTimeString()}`);
    }
}

// Status endpoint — frontend polls this to show countdown timer
app.get('/api/leads/auto-check-status', (req, res) => {
    res.json({
        lastChecked: lastAutoCheckTime,
        nextCheck: nextAutoCheckTime,
        running: autoCheckRunning,
        intervalMinutes: AUTO_CHECK_INTERVAL_MS / 60000,
    });
});

// Start the scheduler after a short delay (let DB connect first)
setTimeout(() => {
    // Modified log string to dynamically match your real interval variable
    console.log(`[AutoCheck] 🟢 Auto reply checker started — interval: ${AUTO_CHECK_INTERVAL_MS / 60000} minutes`);
    runAutoReplyCheck(); 
    setInterval(runAutoReplyCheck, AUTO_CHECK_INTERVAL_MS);
}, 5000);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Automated Lead Server operational on port ${PORT}`));