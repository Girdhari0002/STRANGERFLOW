import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            const newUser = {
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value,
            };

            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    done(null, user);
                } else {
                    // Check if user exists with the same email
                    user = await User.findOne({ email: profile.emails[0].value });
                    if (user) {
                        // Update existing user with googleId
                        user.googleId = profile.id;
                        user.avatar = profile.photos[0].value;
                        await user.save();
                        done(null, user);
                    } else {
                        user = await User.create(newUser);
                        done(null, user);
                    }
                }
            } catch (err) {
                console.error(err);
                done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;
