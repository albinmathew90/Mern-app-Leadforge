// import { ImapFlow }    from 'imapflow';
// import { simpleParser } from 'mailparser';
// import Lead             from '../models/Lead.js';

// export const startLiveResponseTracking = () => {
//     // Check inbox every 2 minutes
//     setInterval(async () => {
//         const client = new ImapFlow({
//             host: process.env.IMAP_HOST,
//             port: parseInt(process.env.IMAP_PORT || "993"),
//             secure: true,
//             logger: false,
//             auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
//         });

//         client.on('error', err => {
//             console.log(`[Tracking] IMAP background network warning: ${err.message}`);
//         });

//         try {
//             await client.connect();
//             let lock = await client.getMailboxLock('INBOX');
            
//             try {
//                 // ═════════════════════════════════════════════════════════════
//                 // FIXED: Correct ImapFlow fetch syntax for unread messages
//                 // ═════════════════════════════════════════════════════════════
//                 for await (const msg of client.fetch({ unseen: true }, { source: true })) {
//                     // msg.source contains the raw email data stream buffer
//                     let parsed = await simpleParser(msg.source);
//                     const senderEmail = parsed.from?.value[0]?.address;

//                     if (senderEmail) {
//                         // Locate the lead matching this sender's address
//                         const lead = await Lead.findOne({ email: senderEmail, status: 'sent' });
//                         if (lead) {
//                             lead.status = 'replied';
//                             await lead.save();
//                             console.log(`[Tracking] Dynamic reply status logged for: ${senderEmail}`);
//                         }
//                     }
//                 }
//             } finally {
//                 lock.release();
//             }
//             await client.logout();
//         } catch (err) {
//             console.log(`[Tracking] IMAP Debug Error: ${err.message}`);
//         }
//     }, 2 * 60 * 1000); 
// };