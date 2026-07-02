import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    singleton: { type: String, default: 'GLOBAL', unique: true },
    adminUsername: { type: String, default: 'admin' },
    smtpUser: { type: String, default: '' },
    smtpPass: { type: String, default: '' },
    smtpHost: { type: String, default: 'smtp.gmail.com' },
    smtpPort: { type: Number, default: 465 },
    imapHost: { type: String, default: '' },
    imapPort: { type: Number, default: 0 },
    adminPassword: { type: String, default: 'admin123' },
    emailDelaySeconds: { type: Number, default: 1.5 },
    maxLeadsPerRun: { type: Number, default: 500 }
}, { timestamps: true });

export default mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
