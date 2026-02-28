import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [socketId, setSocketId] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const { user } = useAuth();

    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_API_URL);

        newSocket.on('connect', () => {
            console.log('✅ Connected with ID:', newSocket.id);
            setSocketId(newSocket.id);

            // If user is already logged in when socket connects
            if (user) {
                newSocket.emit('register-user', user);
            }
        });

        newSocket.on('update-users', (users) => {
            console.log('👥 Online users updated:', users.length);
            setOnlineUsers(users);
        });

        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    // Also register when user login status changes
    useEffect(() => {
        if (socket && user) {
            socket.emit('register-user', user);
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{ socket, socketId, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};
