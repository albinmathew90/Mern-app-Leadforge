import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Load connection string from environment variables
const uri = process.env.MONGODB_URI;

async function run() {
    try {
        console.log("Connecting directly to MongoDB Atlas...");
        await mongoose.connect(uri);
        console.log("Connected successfully!");

        // Target the leads collection inside leadGeneratorDB database
        const result = await mongoose.connection.db.collection('leads').updateMany(
            { status: "replied" },
            { $set: { status: "sent", replyBody: "" } }
        );

        console.log("──────────────────────────────────────────");
        console.log(`Matched Records found: ${result.matchedCount}`);
        console.log(`Successfully Flushed/Reset: ${result.modifiedCount}`);
        console.log("──────────────────────────────────────────");

    } catch (err) {
        console.error("Database script error:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected cleanly.");
        process.exit(0);
    }
}

run();
