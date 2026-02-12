import express from 'express';
import passport from 'passport';
import {
    registerUser,
    loginUser,
    deleteUser,
    getUserProfile,
    updateUserProfile,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Standard Auth
router.post('/signup', registerUser);
router.post('/login', loginUser);
router.delete('/delete', protect, deleteUser);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

// Google Auth
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, generate JWT
        const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        // Redirect or send token as per frontend needs
        // For now, we'll send a script to post message to opener or just redirect with token
        res.redirect(`http://localhost:3000/login-success?token=${token}`);
    }
);

export default router;
