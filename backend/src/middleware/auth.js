import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract the pure token string out of the Bearer wrap context
            token = req.headers.authorization.split(' ')[1];

            // Decode and verify token signature
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallbacksecret123');

            // Find the active account profile and pass it along the request pipeline
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ success: false, error: 'User account no longer exists' });
            }

            return next(); // Pass verification smoothly
        } catch (error) {
            console.error('❌ MIDDLEWARE VERIFICATION FAILURE:', error.message);
            return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized, no token found' });
    }
};
