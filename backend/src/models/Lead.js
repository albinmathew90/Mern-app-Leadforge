import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        category: String,
        phone: String,
        address: String,
        website: String,
        email: { type: String, default: null, unique: true, sparse: true },
        mapsUrl: String,

        // ── outbound email ──────────────────────────────────────────
        status: { type: String, enum: ['unsent', 'sent', 'replied', 'failed'], default: 'unsent' },
        sentSubject: String,
        sentBody: String,
        sentAt: Date,

        // ── reply tracking ──────────────────────────────────────────
        repliedAt: Date,
        replyBody: String,
        replyFrom: String,

        // ── IMAP thread linking ─────────────────────────────────────
        messageId: String,
        threadId: String,

        // ── reply subject ───────────────────────────────────────────
        replySubject: String,
    
    },
{ timestamps: true }
);

// Sparse unique index — only enforces uniqueness on non-null emails

export default mongoose.models.Lead || mongoose.model('Lead', leadSchema);