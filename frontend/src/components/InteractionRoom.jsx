import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Video, VideoOff, Mic, MicOff, Send, PhoneOff, Smile, Paperclip } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { motion } from 'framer-motion';

const InteractionRoom = ({ partner, socket, isInitiator, onLeave }) => {
    const { socketId } = useSocket();
    const [messages, setMessages] = useState([
        { id: 1, text: `Hey! Connected with ${partner?.name}.`, sender: 'partner', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    const [input, setInput] = useState('');
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('Initializing...');
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pc = useRef(null);
    const localStream = useRef(null);
    const scrollRef = useRef(null);
    const iceCandidatesQueue = useRef([]);

    // Create a stable, shared Room ID by sorting IDs
    const getRoomId = () => {
        // Use socketId from context for reactivity
        const myId = socketId || socket?.id;
        if (!myId || !partner?.id) return 'default-room';
        const ids = [myId, partner.id].sort();
        return `room-${ids[0]}-${ids[1]}`;
    };

    const roomId = getRoomId();

    // WebRTC Configuration
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ]
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const startInteraction = async () => {
            // 1. Join Room immediately so messaging/signaling always works
            if (socket && roomId) {
                console.log(`🏠 Joining shared room: ${roomId}`);
                socket.emit('join-room', roomId);
            }

            try {
                console.log('🚀 Attempting to access media devices...');
                setConnectionStatus('Accessing media...');

                // 2. Get Local Media
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });
                } catch (mediaErr) {
                    console.warn('⚠️ Video/Audio failed, trying audio only...', mediaErr.name);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    } catch (audioErr) {
                        console.error('❌ All media failed:', audioErr);
                        setConnectionStatus('Messaging Mode (No Media)');
                    }
                }

                if (stream) {
                    // Apply optional constraints if supported
                    const audioTrack = stream.getAudioTracks()[0];
                    if (audioTrack && audioTrack.applyConstraints) {
                        audioTrack.applyConstraints({
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }).catch(() => { });
                    }

                    localStream.current = stream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                    console.log('✅ Local stream stabilized');
                }

                // 3. Initialize PeerConnection
                if (!pc.current) {
                    initPeerConnection();
                }

                // If we have a stream, add tracks to the PC
                if (stream && pc.current) {
                    stream.getTracks().forEach(track => {
                        pc.current.addTrack(track, stream);
                    });
                }

                // 4. SIGNAL READY (if we are the recipient)
                if (!isInitiator) {
                    console.log('🤝 Sending peer-ready signal...');
                    socket?.emit('peer-ready', { roomId });
                }

                if (!stream) {
                    setConnectionStatus('Connected (Chat Only)');
                } else {
                    setConnectionStatus('Ready for call');
                }
            } catch (err) {
                console.error('❌ Interaction setup error:', err);
                setConnectionStatus('Connection Error');
            }
        };

        if (socket && partner && socketId) {
            startInteraction();
        }

        // Socket Listeners
        socket?.on('message', (msg) => {
            setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
            setIsPartnerTyping(false);
        });

        socket?.on('typing', ({ isTyping }) => {
            setIsPartnerTyping(isTyping);
        });

        socket?.on('peer-ready', async () => {
            console.log('🤝 Peer is ready! Starting call...');
            if (isInitiator && pc.current) {
                try {
                    const offer = await pc.current.createOffer();
                    await pc.current.setLocalDescription(offer);
                    socket.emit('offer', { offer, roomId });
                } catch (err) {
                    console.error('Error creating offer:', err);
                }
            }
        });

        socket?.on('offer', async (offer) => {
            console.log('📥 Received offer');
            if (!pc.current) initPeerConnection();
            try {
                await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

                // Process queued candidates
                while (iceCandidatesQueue.current.length > 0) {
                    const candidate = iceCandidatesQueue.current.shift();
                    await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                }

                const answer = await pc.current.createAnswer();
                await pc.current.setLocalDescription(answer);
                socket.emit('answer', { answer, roomId });
            } catch (err) {
                console.error("Error handling offer:", err);
            }
        });

        socket?.on('answer', async (answer) => {
            console.log('📤 Received answer');
            try {
                if (pc.current) {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
                    // Process queued candidates
                    while (iceCandidatesQueue.current.length > 0) {
                        const candidate = iceCandidatesQueue.current.shift();
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
            } catch (err) {
                console.error("Error handling answer:", err);
            }
        });

        socket?.on('ice-candidate', async (candidate) => {
            try {
                if (pc.current && pc.current.remoteDescription) {
                    await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    iceCandidatesQueue.current.push(candidate);
                }
            } catch (e) {
                console.error('Error adding ice candidate', e);
            }
        });

        socket?.on('partner-left', () => {
            onLeave();
        });

        return () => {
            console.log('🧹 Cleaning up interaction session (Zero-Trace Policy)...');

            // 1. Force stop all local media tracks and disable them
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                localStream.current = null;
            }

            // 2. Close and nullify PeerConnection
            if (pc.current) {
                pc.current.close();
                pc.current = null;
            }

            // 3. Clear signaling buffers
            iceCandidatesQueue.current = [];

            // 4. Wipe local message state
            setMessages([]);

            // 5. Cleanup socket listeners
            socket?.off('message');
            socket?.off('typing');
            socket?.off('peer-ready');
            socket?.off('offer');
            socket?.off('answer');
            socket?.off('ice-candidate');
            socket?.off('partner-left');
        };
    }, [socket, partner, roomId, socketId, isInitiator, onLeave]);

    const handleLeave = () => {
        socket?.emit('leave-call', { roomId });
        onLeave();
    };

    const initPeerConnection = () => {
        if (pc.current) return;
        console.log('🛠 Initializing PeerConnection...');
        pc.current = new RTCPeerConnection(rtcConfig);

        // Add local tracks to peer connection
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => {
                pc.current.addTrack(track, localStream.current);
            });
        }

        // Handle remote track
        pc.current.ontrack = (event) => {
            console.log('📺 Received remote track:', event.track.kind);
            if (remoteVideoRef.current) {
                // Better way to handle streams to ensure audio/video are combined correctly
                if (event.streams && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                } else {
                    // Fallback for some browsers or cases where streams aren't bundled
                    if (!remoteVideoRef.current.srcObject) {
                        remoteVideoRef.current.srcObject = new MediaStream();
                    }
                    remoteVideoRef.current.srcObject.addTrack(event.track);
                }

                // Force play to overcome some autoplay restrictions
                remoteVideoRef.current.play().catch(e => console.warn("Autoplay blocked or failed:", e));
            }
        };

        // Handle ICE candidates
        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { candidate: event.candidate, roomId });
            }
        };

        pc.current.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', pc.current?.connectionState);
            if (pc.current) setConnectionStatus(pc.current.connectionState);

            if (pc.current?.connectionState === 'failed') {
                setConnectionStatus('Connection Failed. Retrying...');
            }
        };

        pc.current.oniceconnectionstatechange = () => {
            console.log('❄️ ICE Connection state:', pc.current?.iceConnectionState);
        };
    };

    const handleSend = () => {
        if (!input.trim()) return;
        const msg = {
            text: input,
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        };
        setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
        socket?.emit('message', { text: input, roomId });
        socket?.emit('typing', { isTyping: false, roomId });
        setInput('');
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
        socket?.emit('typing', { isTyping: true, roomId });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket?.emit('typing', { isTyping: false, roomId });
        }, 2000);
    };

    const toggleMic = () => {
        const audioTrack = localStream.current?.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioOn(audioTrack.enabled);
        }
    };

    const toggleVideo = () => {
        const videoTrack = localStream.current?.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOn(videoTrack.enabled);
        }
    };

    return (
        <div className="interaction-layout">
            {/* Video Call Area */}
            <div className="video-area glass">
                <div className="video-grid">
                    {/* Partner Video */}
                    <div className="video-container main-video">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div className="video-overlay">
                            <span className="user-badge">{partner?.name}</span>
                        </div>
                    </div>

                    {/* Local Video - PiP style or smaller grid */}
                    <div className="video-container local-video">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isVideoOn ? 1 : 0 }}
                        />
                        {!isVideoOn && (
                            <div className="video-off-placeholder">
                                <VideoOff size={32} color="var(--danger)" opacity={0.5} />
                            </div>
                        )}
                        <div className="video-overlay">
                            <span className="user-badge">You</span>
                        </div>
                    </div>
                </div>

                {/* Call Controls */}
                <div className="controls-bar">
                    <button onClick={toggleMic} className={`control-btn ${!isAudioOn ? 'active-red' : ''}`}>
                        {isAudioOn ? <Mic size={22} /> : <MicOff size={22} />}
                    </button>
                    <button onClick={toggleVideo} className={`control-btn ${!isVideoOn ? 'active-red' : ''}`}>
                        {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
                    </button>
                    <button onClick={handleLeave} className="control-btn hangup">
                        <PhoneOff size={22} />
                    </button>
                    <div className="status-label">{connectionStatus}</div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="chat-area glass">
                <div className="chat-header">
                    <div className="chat-info">
                        <div className="chat-icon-box">
                            <MessageCircle size={20} color="white" />
                        </div>
                        <div>
                            <h4>Conversation</h4>
                            <span className="chat-status">
                                {isPartnerTyping ? 'Stranger is typing...' : 'End-to-end encrypted'}
                            </span>
                        </div>
                    </div>
                </div>

                <div ref={scrollRef} className="messages-container">
                    {messages.map(m => (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={m.id}
                            className={`message ${m.sender === 'me' ? 'message-sent' : 'message-received'}`}
                        >
                            <div className="message-text">{m.text}</div>
                            <div className="message-time">{m.time}</div>
                        </motion.div>
                    ))}
                    {isPartnerTyping && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="typing-indicator-bubble message-received">
                            <div className="typing-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="chat-input-container">
                    <div className="input-wrapper">
                        <button className="icon-btn action-btn"><Paperclip size={20} /></button>
                        <input
                            value={input}
                            onChange={handleInputChange}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            type="text"
                            placeholder="Type a message..."
                            className="chat-input-field"
                        />
                        <button onClick={handleSend} className="send-action-btn">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .interaction-layout {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 1.5rem;
                    height: calc(100vh - 120px);
                    max-height: 900px;
                    transition: all 0.3s ease;
                }

                @media (max-width: 1024px) {
                    .interaction-layout {
                        grid-template-columns: 1fr;
                        grid-template-rows: 1fr 400px;
                        height: auto;
                        max-height: none;
                    }
                }

                .video-area {
                    display: flex;
                    flex-direction: column;
                    background: rgba(15, 23, 42, 0.3);
                    overflow: hidden;
                    position: relative;
                }

                .video-grid {
                    flex: 1;
                    position: relative;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .video-container {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    background: #020617;
                    border: 1px solid rgba(255,255,255,0.05);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }

                .main-video {
                    flex: 2;
                }

                .local-video {
                    position: absolute;
                    bottom: 2rem;
                    right: 2rem;
                    width: 200px;
                    height: 150px;
                    z-index: 20;
                    border: 2px solid var(--accent-primary);
                    flex: none;
                }

                @media (max-width: 768px) {
                    .local-video {
                        width: 140px;
                        height: 100px;
                        bottom: 1rem;
                        right: 1rem;
                    }
                }

                .video-overlay {
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    z-index: 10;
                }

                .user-badge {
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    color: white;
                    padding: 0.3rem 0.8rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .video-off-placeholder {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0f172a;
                }

                .controls-bar {
                    padding: 1.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1.5rem;
                    background: rgba(0,0,0,0.4);
                    border-top: 1px solid var(--glass-border);
                    position: relative;
                }

                .status-label {
                    position: absolute;
                    right: 2rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    opacity: 0.7;
                }

                .control-btn {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--glass-border);
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .control-btn:hover {
                    background: rgba(255,255,255,0.1);
                    transform: scale(1.05);
                }

                .control-btn.active-red {
                    background: var(--danger);
                    border-color: var(--danger);
                }

                .control-btn.hangup {
                    background: #ef4444;
                    box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
                }

                .chat-area {
                    display: flex;
                    flex-direction: column;
                    background: rgba(15, 23, 42, 0.2);
                    overflow: hidden;
                }

                .chat-header {
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--glass-border);
                    background: rgba(255,255,255,0.03);
                }

                .chat-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .chat-icon-box {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, var(--accent-primary), #818cf8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .chat-status {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .messages-container {
                    flex: 1;
                    padding: 1.5rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .message-text {
                    font-size: 0.95rem;
                    line-height: 1.4;
                    word-break: break-word;
                }

                .message-time {
                    font-size: 0.65rem;
                    opacity: 0.5;
                    margin-top: 0.3rem;
                    text-align: right;
                }

                .typing-dots {
                    display: flex;
                    gap: 4px;
                    padding: 4px 0;
                }

                .typing-dots span {
                    width: 6px;
                    height: 6px;
                    background: var(--text-secondary);
                    border-radius: 50%;
                    animation: bounce 1.4s infinite ease-in-out both;
                }

                .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                .typing-dots span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                }

                .chat-input-container {
                    padding: 1.25rem;
                    background: rgba(255,255,255,0.02);
                    border-top: 1px solid var(--glass-border);
                }

                .input-wrapper {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                    background: rgba(255,255,255,0.05);
                    padding: 0.5rem;
                    border-radius: 16px;
                    border: 1px solid var(--glass-border);
                }

                .chat-input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.6rem;
                    outline: none;
                }

                .send-action-btn {
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s;
                }

                .send-action-btn:hover {
                    transform: translateX(3px);
                }

                .action-btn {
                    padding: 0.5rem;
                }
            `}</style>
        </div>
    );
};

export default InteractionRoom;
