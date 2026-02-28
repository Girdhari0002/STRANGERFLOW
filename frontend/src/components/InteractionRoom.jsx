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

    // Use a ref for onLeave to prevent re-renders when the parent callback changes
    const onLeaveRef = useRef(onLeave);

    useEffect(() => {
        onLeaveRef.current = onLeave;
    }, [onLeave]);

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
            if (socket && roomId) {
                console.log(`🏠 Joining shared room: ${roomId}`);
                socket.emit('join-room', roomId);
            }

            try {
              
                setConnectionStatus('Accessing media...');

                // Get Local Media
                let stream = null;
                let hasVideo = false;
                let hasAudio = false;

                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    hasVideo = stream.getVideoTracks().length > 0;
                    hasAudio = stream.getAudioTracks().length > 0;
                    console.log(`✅ Media access granted - Video: ${hasVideo}, Audio: ${hasAudio}`);
                } catch (mediaErr) {
                    console.warn('⚠️ Video/Audio failed:', mediaErr.name, mediaErr.message);

                    if (mediaErr.name === 'NotReadableError') {
                        console.error('❌ Camera/Mic is already in use by another application');
                        setConnectionStatus('Media device in use');
                    } else if (mediaErr.name === 'NotAllowedError') {
                        console.error('❌ Permission denied for camera/microphone');
                        setConnectionStatus('Permission denied');
                    } else if (mediaErr.name === 'NotFoundError') {
                        console.error('❌ No camera/microphone found');
                        setConnectionStatus('No media devices found');
                    }

                    // Fallback: Try audio only
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            }
                        });
                        hasAudio = stream.getAudioTracks().length > 0;
                        console.log('✅ Audio-only mode activated');
                        setConnectionStatus('Audio only mode');
                        setIsVideoOn(false);
                    } catch (audioErr) {
                        console.error('❌ All media access failed:', audioErr.name, audioErr.message);
                        setConnectionStatus('Messaging Mode (No Media)');
                    }
                }

                // Store the stream
                if (stream) {
                    localStream.current = stream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                        localVideoRef.current.muted = true; // Local video muted
                    }
                    console.log('✅ Local stream attached to video element');
                }

                // Initialize PeerConnection
                if (!pc.current) {
                    initPeerConnection();
                }

                // Add tracks to PeerConnection
                if (stream && pc.current) {
                    const existingSenders = pc.current.getSenders();
                    const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);

                    stream.getTracks().forEach(track => {
                        if (!existingTrackIds.includes(track.id)) {
                            try {
                                pc.current.addTrack(track, stream);
                                console.log(`✅ Added ${track.kind} track to peer connection`);
                            } catch (e) {
                                console.error(`❌ Failed to add ${track.kind} track:`, e.message);
                            }
                        } else {
                            console.log(`⚠️ Track ${track.kind} already exists, skipping`);
                        }
                    });
                }

                // Signal Ready
                if (!isInitiator) {
                    console.log('🤝 Sending peer-ready signal...');
                    socket?.emit('peer-ready', { roomId });
                }

                // Update Status
                if (!stream) {
                    setConnectionStatus('Connected (Chat Only)');
                } else if (hasVideo && hasAudio) {
                    setConnectionStatus('Ready for call');
                } else if (hasAudio) {
                    setConnectionStatus('Audio only');
                } else {
                    setConnectionStatus('Connected (Chat Only)');
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
        const handleMessage = (msg) => {
            setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
            setIsPartnerTyping(false);
        };

        const handleTyping = ({ isTyping }) => {
            setIsPartnerTyping(isTyping);
        };

        const handlePeerReady = async () => {
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
        };

        const handleOffer = async (offer) => {
            console.log('📥 Received offer');
            if (!pc.current) initPeerConnection();
            try {
                await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

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
        };

        const handleAnswer = async (answer) => {
            console.log('📤 Received answer');
            try {
                if (pc.current) {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
                    while (iceCandidatesQueue.current.length > 0) {
                        const candidate = iceCandidatesQueue.current.shift();
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
            } catch (err) {
                console.error("Error handling answer:", err);
            }
        };

        const handleIceCandidate = async (candidate) => {
            try {
                if (pc.current && pc.current.remoteDescription) {
                    await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    iceCandidatesQueue.current.push(candidate);
                }
            } catch (e) {
                console.error('Error adding ice candidate', e);
            }
        };



        const handlePartnerLeft = () => {
            if (onLeaveRef.current) onLeaveRef.current();
        };

        socket?.on('message', handleMessage);
        socket?.on('typing', handleTyping);
        socket?.on('peer-ready', handlePeerReady);
        socket?.on('offer', handleOffer);
        socket?.on('answer', handleAnswer);
        socket?.on('ice-candidate', handleIceCandidate);
        socket?.on('partner-left', handlePartnerLeft);

        return () => {
            console.log('🧹 Cleaning up interaction session...');

            // Stop media tracks
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                localStream.current = null;
            }

            // Close PeerConnection
            if (pc.current) {
                pc.current.close();
                pc.current = null;
            }

            // Clean up listeners
            socket?.off('message', handleMessage);
            socket?.off('typing', handleTyping);
            socket?.off('peer-ready', handlePeerReady);
            socket?.off('offer', handleOffer);
            socket?.off('answer', handleAnswer);
            socket?.off('ice-candidate', handleIceCandidate);
            socket?.off('partner-left', handlePartnerLeft);
        };
    }, [socket, partner?.id, roomId, socketId, isInitiator]);

    const handleLeave = () => {
        socket?.emit('leave-call', { roomId });
        onLeave();
    };

    const initPeerConnection = () => {
        if (pc.current) {
            console.log('⚠️ PeerConnection already exists, skipping initialization');
            return;
        }

        console.log('🛠 Initializing PeerConnection...');
        pc.current = new RTCPeerConnection(rtcConfig);

        // DO NOT add tracks here - they will be added in startInteraction
        // This prevents duplicate track additions

        // Handle remote track with improved autoplay handling
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

                // Improved autoplay handling
                // Try to play, if blocked, user will need to interact
                remoteVideoRef.current.play().catch(e => {
                    if (e.name === 'NotAllowedError') {
                        console.warn('⚠️ Autoplay blocked - user interaction required');
                        setConnectionStatus('Click to enable audio/video');
                    } else if (e.name === 'AbortError') {
                        console.warn('⚠️ Playback aborted:', e.message);
                    } else {
                        console.warn('⚠️ Autoplay failed:', e.name, e.message);
                    }
                });
            }
        };

        // Handle ICE candidates
        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { candidate: event.candidate, roomId });
            }
        };

        pc.current.onconnectionstatechange = () => {
            const state = pc.current?.connectionState;
            console.log('🔗 Connection state:', state);

            if (pc.current) {
                switch (state) {
                    case 'connected':
                        setConnectionStatus('Connected');
                        break;
                    case 'connecting':
                        setConnectionStatus('Connecting...');
                        break;
                    case 'disconnected':
                        setConnectionStatus('Disconnected');
                        break;
                    case 'failed':
                        setConnectionStatus('Connection Failed');
                        break;
                    case 'closed':
                        setConnectionStatus('Connection Closed');
                        break;
                    default:
                        setConnectionStatus(state);
                }
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
                            muted={false}
                            controls={false}
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

            <style jsx>{`
                .interaction-layout {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 1.5rem;
                    height: calc(100vh - 120px);
                    max-height: 900px;
                    transition: all 0.3s ease;
                }

                /* Tablet and below - Stack vertically */
                @media (max-width: 1024px) {
                    .interaction-layout {
                        grid-template-columns: 1fr;
                        grid-template-rows: auto auto;
                        height: auto;
                        max-height: none;
                        gap: 1rem;
                    }
                }

                /* Mobile landscape and portrait */
                @media (max-width: 768px) {
                    .interaction-layout {
                        gap: 0.75rem;
                        height: auto;
                    }
                }

                /* Small mobile devices */
                @media (max-width: 480px) {
                    .interaction-layout {
                        gap: 0.5rem;
                    }
                }

                .video-area {
                    display: flex;
                    flex-direction: column;
                    background: rgba(15, 23, 42, 0.3);
                    overflow: hidden;
                    position: relative;
                    min-height: 400px;
                }

                @media (max-width: 768px) {
                    .video-area {
                        min-height: 300px;
                        height: 50vh;
                    }
                }

                @media (max-width: 480px) {
                    .video-area {
                        min-height: 250px;
                        height: 45vh;
                    }
                }

                .video-grid {
                    flex: 1;
                    position: relative;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                @media (max-width: 768px) {
                    .video-grid {
                        padding: 0.75rem;
                        gap: 0.75rem;
                    }
                }

                @media (max-width: 480px) {
                    .video-grid {
                        padding: 0.5rem;
                        gap: 0.5rem;
                    }
                }

                .video-container {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    background: #020617;
                    border: 1px solid rgba(255,255,255,0.05);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }

                @media (max-width: 768px) {
                    .video-container {
                        border-radius: 12px;
                    }
                }

                @media (max-width: 480px) {
                    .video-container {
                        border-radius: 8px;
                    }
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
                        width: 120px;
                        height: 90px;
                        bottom: 1rem;
                        right: 1rem;
                        border-width: 1.5px;
                    }
                }

                @media (max-width: 480px) {
                    .local-video {
                        width: 100px;
                        height: 75px;
                        bottom: 0.75rem;
                        right: 0.75rem;
                        border-width: 1px;
                    }
                }

                /* Extra small devices */
                @media (max-width: 360px) {
                    .local-video {
                        width: 80px;
                        height: 60px;
                        bottom: 0.5rem;
                        right: 0.5rem;
                    }
                }

                .video-overlay {
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    z-index: 10;
                }

                @media (max-width: 768px) {
                    .video-overlay {
                        top: 0.75rem;
                        left: 0.75rem;
                    }
                }

                @media (max-width: 480px) {
                    .video-overlay {
                        top: 0.5rem;
                        left: 0.5rem;
                    }
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

                @media (max-width: 768px) {
                    .user-badge {
                        padding: 0.25rem 0.6rem;
                        font-size: 0.75rem;
                        border-radius: 6px;
                    }
                }

                @media (max-width: 480px) {
                    .user-badge {
                        padding: 0.2rem 0.5rem;
                        font-size: 0.7rem;
                    }
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
                    flex-wrap: wrap;
                }

                @media (max-width: 768px) {
                    .controls-bar {
                        padding: 1rem;
                        gap: 1rem;
                    }
                }

                @media (max-width: 480px) {
                    .controls-bar {
                        padding: 0.75rem;
                        gap: 0.75rem;
                    }
                }

                .status-label {
                    position: absolute;
                    right: 2rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    opacity: 0.7;
                }

                @media (max-width: 768px) {
                    .status-label {
                        position: static;
                        width: 100%;
                        text-align: center;
                        font-size: 0.7rem;
                        margin-top: 0.5rem;
                    }
                }

                @media (max-width: 480px) {
                    .status-label {
                        font-size: 0.65rem;
                        margin-top: 0.25rem;
                    }
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
                    flex-shrink: 0;
                }

                @media (max-width: 768px) {
                    .control-btn {
                        width: 48px;
                        height: 48px;
                    }
                }

                @media (max-width: 480px) {
                    .control-btn {
                        width: 44px;
                        height: 44px;
                    }
                }

                @media (max-width: 360px) {
                    .control-btn {
                        width: 40px;
                        height: 40px;
                    }
                }

                .control-btn:hover {
                    background: rgba(255,255,255,0.1);
                    transform: scale(1.05);
                }

                @media (hover: none) {
                    .control-btn:hover {
                        transform: none;
                    }
                    .control-btn:active {
                        transform: scale(0.95);
                    }
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
                    max-height: 600px;
                }

                @media (max-width: 1024px) {
                    .chat-area {
                        max-height: 400px;
                        min-height: 350px;
                    }
                }

                @media (max-width: 768px) {
                    .chat-area {
                        max-height: 350px;
                        min-height: 300px;
                    }
                }

                @media (max-width: 480px) {
                    .chat-area {
                        max-height: 300px;
                        min-height: 250px;
                    }
                }

                .chat-header {
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--glass-border);
                    background: rgba(255,255,255,0.03);
                }

                @media (max-width: 768px) {
                    .chat-header {
                        padding: 1rem;
                    }
                }

                @media (max-width: 480px) {
                    .chat-header {
                        padding: 0.75rem;
                    }
                }

                .chat-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                @media (max-width: 480px) {
                    .chat-info {
                        gap: 0.75rem;
                    }
                }

                .chat-icon-box {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, var(--accent-primary), #818cf8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                @media (max-width: 768px) {
                    .chat-icon-box {
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                    }
                }

                @media (max-width: 480px) {
                    .chat-icon-box {
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                    }
                }

                .chat-info h4 {
                    font-size: 1rem;
                    margin: 0;
                }

                @media (max-width: 768px) {
                    .chat-info h4 {
                        font-size: 0.9rem;
                    }
                }

                @media (max-width: 480px) {
                    .chat-info h4 {
                        font-size: 0.85rem;
                    }
                }

                .chat-status {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                @media (max-width: 768px) {
                    .chat-status {
                        font-size: 0.7rem;
                    }
                }

                @media (max-width: 480px) {
                    .chat-status {
                        font-size: 0.65rem;
                    }
                }

                .messages-container {
                    flex: 1;
                    padding: 1.5rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    -webkit-overflow-scrolling: touch;
                }

                @media (max-width: 768px) {
                    .messages-container {
                        padding: 1rem;
                        gap: 0.75rem;
                    }
                }

                @media (max-width: 480px) {
                    .messages-container {
                        padding: 0.75rem;
                        gap: 0.5rem;
                    }
                }

                .message-text {
                    font-size: 0.95rem;
                    line-height: 1.4;
                    word-break: break-word;
                }

                @media (max-width: 768px) {
                    .message-text {
                        font-size: 0.9rem;
                    }
                }

                @media (max-width: 480px) {
                    .message-text {
                        font-size: 0.85rem;
                        line-height: 1.3;
                    }
                }

                .message-time {
                    font-size: 0.65rem;
                    opacity: 0.5;
                    margin-top: 0.3rem;
                    text-align: right;
                }

                @media (max-width: 480px) {
                    .message-time {
                        font-size: 0.6rem;
                        margin-top: 0.2rem;
                    }
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

                @media (max-width: 480px) {
                    .typing-dots span {
                        width: 5px;
                        height: 5px;
                    }
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

                @media (max-width: 768px) {
                    .chat-input-container {
                        padding: 1rem;
                    }
                }

                @media (max-width: 480px) {
                    .chat-input-container {
                        padding: 0.75rem;
                    }
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

                @media (max-width: 768px) {
                    .input-wrapper {
                        gap: 0.5rem;
                        padding: 0.4rem;
                        border-radius: 12px;
                    }
                }

                @media (max-width: 480px) {
                    .input-wrapper {
                        gap: 0.4rem;
                        padding: 0.3rem;
                        border-radius: 10px;
                    }
                }

                .chat-input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.6rem;
                    outline: none;
                    font-size: 0.95rem;
                }

                @media (max-width: 768px) {
                    .chat-input-field {
                        padding: 0.5rem;
                        font-size: 0.9rem;
                    }
                }

                @media (max-width: 480px) {
                    .chat-input-field {
                        padding: 0.4rem;
                        font-size: 0.85rem;
                    }
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
                    flex-shrink: 0;
                }

                @media (max-width: 768px) {
                    .send-action-btn {
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                    }
                }

                @media (max-width: 480px) {
                    .send-action-btn {
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                    }
                }

                .send-action-btn:hover {
                    transform: translateX(3px);
                }

                @media (hover: none) {
                    .send-action-btn:hover {
                        transform: none;
                    }
                    .send-action-btn:active {
                        transform: scale(0.95);
                    }
                }

                .action-btn {
                    padding: 0.5rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }

                @media (max-width: 480px) {
                    .action-btn {
                        padding: 0.3rem;
                    }
                }

                .action-btn:hover {
                    color: white;
                }
            `}</style>
        </div>
    );
};

export default InteractionRoom;
