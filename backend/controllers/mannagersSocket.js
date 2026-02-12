import { Server } from 'socket.io';

let io;
const users = new Map();

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust this for production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Add to users map with basic info (stranger by default)
        users.set(socket.id, {
            id: socket.id,
            name: 'Stranger',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`
        });

        // Broadcast updated user list
        io.emit('update-users', Array.from(users.values()));

        socket.on('register-user', (userData) => {
            console.log(`👤 User registered: ${userData.name} (${socket.id})`);
            users.set(socket.id, {
                id: socket.id,
                name: userData.name,
                avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`,
                userId: userData._id // Database ID
            });
            io.emit('update-users', Array.from(users.values()));
        });

        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            console.log(`🏠 User ${socket.id} joined room: ${roomId}`);
        });

        socket.on('message', (data) => {
            console.log(`📩 Message in room ${data.roomId} from ${socket.id}:`, data.text);
            socket.to(data.roomId).emit('message', {
                text: data.text,
                sender: 'partner',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        });

        socket.on('offer', (data) => {
            console.log(`📤 Offer from ${socket.id} to room ${data.roomId}`);
            socket.to(data.roomId).emit('offer', data.offer);
        });

        socket.on('answer', (data) => {
            console.log(`📥 Answer from ${socket.id} to room ${data.roomId}`);
            socket.to(data.roomId).emit('answer', data.answer);
        });

        socket.on('ice-candidate', (data) => {
            socket.to(data.roomId).emit('ice-candidate', data.candidate);
        });

        socket.on('typing', (data) => {
            socket.to(data.roomId).emit('typing', { isTyping: data.isTyping });
        });

        socket.on('call-user', (data) => {
            console.log(`📞 Call from ${socket.id} to ${data.to}`);
            const caller = users.get(socket.id);
            socket.to(data.to).emit('incoming-call', {
                from: socket.id,
                name: caller?.name || 'Stranger',
                avatar: caller?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`
            });
        });

        socket.on('peer-ready', (data) => {
            console.log(`🤝 Peer ${socket.id} is ready in room ${data.roomId}`);
            socket.to(data.roomId).emit('peer-ready', { id: socket.id });
        });

        socket.on('leave-call', (data) => {
            console.log(`📡 User ${socket.id} left room ${data.roomId}`);
            socket.to(data.roomId).emit('partner-left');
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
            users.delete(socket.id);
            io.emit('update-users', Array.from(users.values()));
        });
    });
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};