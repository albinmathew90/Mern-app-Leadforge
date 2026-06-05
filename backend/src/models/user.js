import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: false, // Optional for Google Auth users
        minlength: 6
    },
    googleId: {
        type: String,
        required: false,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

// ═════════════════════════════════════════════════════════════════════════════
// CLEAN PRE-SAVE HOOK (Bypasses the arrow-function context breakdown)
// ═════════════════════════════════════════════════════════════════════════════
userSchema.pre('save', async function () {
    // Only hash the password if it has been modified or is completely fresh
    if (!this.isModified('password') || !this.password) {
        return;
    }
    
    // Explicitly uses modern async/await execution block syntax
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.comparePassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;