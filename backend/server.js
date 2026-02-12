import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket, getIO } from './controllers/mannagersSocket.js';
import passport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import cookieParser from 'cookie-parser';
import session from 'express-session';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const MONGODB_URI = process.env.MONGODB_URI;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Server is alive! Use /test for more info.');
});



app.get('/test', (req, res) => {
  try {
    const data = {
      message: 'Hello server, this is a test message!',
      timestamp: new Date().toISOString()
    }
    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }

});

app.get('/socket', (req, res) => {
  try {
    const io = getIO();

    const payload = {
      message: 'Hello from backend via Socket.IO',
      time: new Date().toISOString()
    };

    // Emit to all connected clients
    io.emit('message', payload);

    res.json({
      success: true,
      info: 'Socket.IO message emitted successfully',
      payload
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Socket.IO not initialized'
    });
  }
});

// Initialize Socket.io
initSocket(httpServer);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
  });




httpServer.listen(process.env.PORT, () => {
  console.log(`🚀 Server is running on port ${process.env.PORT}`);
});
