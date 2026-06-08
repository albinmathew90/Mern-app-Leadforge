import mongoose from 'mongoose';

// Your explicit cluster connection target path
const uri = "mongodb+srv://rncluster90.3kcjcvb.mongodb.net/leadGeneratorDB?retryWrites=true&w=majority";

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
