import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId; // Password is required only if googleId is not present
        },
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows null values while maintaining uniqueness
    },
    avatar: {
        type: String,
    },
}, {
    timestamps: true,
});

const User = mongoose.model('User', userSchema);
export default User;
