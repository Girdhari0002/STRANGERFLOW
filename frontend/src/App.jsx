import React, { useState, useEffect } from 'react';
import { Search, User, Users, Bell, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SocketProvider, useSocket } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import UserCard from './components/UserCard';
import InteractionRoom from './components/InteractionRoom';
import Auth from './components/Auth';
import Profile from './components/Profile';

const AppContent = () => {
  const { socket, socketId, onlineUsers } = useSocket();
  const { user, loading } = useAuth();
  const [view, setView] = useState('home');
  const [activePartner, setActivePartner] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);

  // Filter out ourself from the list
  const otherUsers = onlineUsers.filter(u => u.id !== socketId);

  // Add listener for google auth success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      // If token is in URL, fetch user profile and login
      const fetchUser = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const userData = await res.json();
          if (res.ok) {
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', token);
            window.location.href = '/'; // Clear URL
          }
        } catch (err) {
          console.error('Google Auth Fetch failed', err);
        }
      };
      fetchUser();
    }
  }, []);

  const handleLeave = React.useCallback(() => {
    setView('home');
    setActivePartner(null);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (caller) => {
      console.log('Incoming call from:', caller);

      // Only accept incoming calls if user is authenticated
      if (!user) {
        console.log('Rejecting call - user not authenticated');
        // Optionally notify the caller that the call was rejected
        socket.emit('call-rejected', { to: caller.from, reason: 'not-authenticated' });
        return;
      }

      setActivePartner({
        id: caller.from,
        name: caller.name,
        avatar: caller.avatar
      });
      setIsInitiator(false); // We are receiving, so we aren't initiator
      setView('chat');
    });

    return () => socket.off('incoming-call');
  }, [socket, user]);

  const handleConnect = (stranger) => {
    // Check if user is authenticated before allowing connection
    if (!user) {
      // Redirect to auth page if not logged in
      setView('auth');
      return;
    }

    setActivePartner(stranger);
    setIsInitiator(true); // We clicked, so we are initiator
    setView('chat');
    // Notify the partner they are being called
    socket?.emit('call-user', { to: stranger.id });
  };

  return (
    <div className="app-container">
      <Navbar currentView={view} setView={setView} user={user} />

      <main className="container">
        <AnimatePresence mode="wait">
          {view === 'auth' ? (
            <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Auth onAuthSuccess={() => setView('home')} />
            </motion.div>
          ) : view === 'profile' ? (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Profile />
            </motion.div>
          ) : view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="hero-section" style={{ textAlign: 'center', margin: '4rem 0 3rem' }}>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--accent-primary)',
                    padding: '0.4rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                  }}
                >
                  <Globe size={14} /> {otherUsers.length} strangers online
                </motion.div>

                <h1 style={{
                  fontSize: '3.5rem',
                  fontWeight: 800,
                  letterSpacing: '-1.5px',
                  marginBottom: '1rem',
                  background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Connect with Mindful <span style={{ color: 'var(--accent-primary)', WebkitTextFillColor: 'initial' }}>Strangers.</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                  Private, real-time 1-on-1 video and chat interactions for deep conversations and knowledge sharing.
                </p>
              </div>

              <div className="action-row" style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
                <div className="search-bar glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 1.5rem' }}>
                  <Search size={20} color="var(--text-secondary)" />
                  <input type="text" placeholder="Search by name or interests..." style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', height: '60px', outline: 'none' }} />
                </div>
                <button className="glass btn-secondary" style={{ width: '60px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </button>
              </div>

              <div className="user-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {otherUsers.map(stranger => (
                  <UserCard
                    key={stranger.id}
                    user={stranger}
                    onConnect={() => handleConnect(stranger)}
                    isAuthenticated={!!user}
                  />
                ))}
                {otherUsers.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No strangers online right now. Open another tab to connect!
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <InteractionRoom
                partner={activePartner}
                socket={socket}
                isInitiator={isInitiator}
                onLeave={handleLeave}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const Navbar = ({ currentView, setView, user }) => (
  <nav className="main-nav">
    <div className="nav-container glass">
      <div className="nav-left" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
        <div className="logo-box">
          <Users size={22} color="white" />
        </div>
        <span className="logo-text">STRANGER<span style={{ fontWeight: 400, opacity: 0.6 }}>FLOW</span></span>
      </div>

      <div className="nav-right">
        <div className="nav-actions">
          <button className="nav-icon-btn"><Bell size={20} /></button>
          <button className="nav-icon-btn"><Search size={20} /></button>

          {user ? (
            <div className="user-profile" onClick={() => setView('profile')} style={{ cursor: 'pointer' }}>
              <div className="profile-img">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                ) : (
                  <User size={18} />
                )}
              </div>
              <span className="user-name-nav">{user.name.split(' ')[0]}</span>
            </div>
          ) : (
            <button className="signin-nav-btn" onClick={() => setView('auth')}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>

    <style jsx>{`
      .main-nav {
        padding: 1.5rem 2rem 0;
        max-width: 1400px;
        margin: 0 auto;
      }

      @media (max-width: 768px) {
        .main-nav {
          padding: 1rem 1rem 0;
        }
      }

      @media (max-width: 480px) {
        .main-nav {
          padding: 0.75rem 0.75rem 0;
        }
      }

      .nav-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1.5rem;
        border-radius: 20px;
      }

      @media (max-width: 768px) {
        .nav-container {
          padding: 0.6rem 1rem;
          border-radius: 16px;
        }
      }

      @media (max-width: 480px) {
        .nav-container {
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
        }
      }

      .nav-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      @media (max-width: 480px) {
        .nav-left {
          gap: 0.5rem;
        }
      }

      .logo-box {
        background: var(--accent-primary);
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }

      @media (max-width: 768px) {
        .logo-box {
          width: 34px;
          height: 34px;
          border-radius: 8px;
        }
      }

      @media (max-width: 480px) {
        .logo-box {
          width: 30px;
          height: 30px;
        }
      }

      .logo-text {
        font-family: 'Outfit', sans-serif;
        font-weight: 700;
        font-size: 1.3rem;
        letter-spacing: -0.5px;
      }

      @media (max-width: 768px) {
        .logo-text {
          font-size: 1.1rem;
        }
      }

      @media (max-width: 480px) {
        .logo-text {
          font-size: 1rem;
        }
      }

      @media (max-width: 360px) {
        .logo-text {
          font-size: 0.9rem;
        }
      }

      .nav-actions {
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }

      @media (max-width: 768px) {
        .nav-actions {
          gap: 0.75rem;
        }
      }

      @media (max-width: 480px) {
        .nav-actions {
          gap: 0.5rem;
        }
      }

      .nav-icon-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: color 0.2s;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      @media (max-width: 768px) {
        .nav-icon-btn {
          padding: 0.4rem;
        }
      }

      @media (max-width: 480px) {
        .nav-icon-btn {
          padding: 0.3rem;
          display: none;
        }
      }

      .nav-icon-btn:hover {
        color: white;
      }

      .user-profile {
        padding-left: 1.25rem;
        border-left: 1px solid var(--glass-border);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s;
      }

      @media (max-width: 768px) {
        .user-profile {
          padding-left: 0.75rem;
          gap: 8px;
        }
      }

      @media (max-width: 480px) {
        .user-profile {
          padding-left: 0.5rem;
          gap: 6px;
        }
      }

      .user-profile:hover .user-name-nav {
        color: var(--accent-primary);
      }

      .profile-img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--glass-border);
        overflow: hidden;
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .profile-img {
          width: 32px;
          height: 32px;
        }
      }

      @media (max-width: 480px) {
        .profile-img {
          width: 28px;
          height: 28px;
        }
      }

      .user-name-nav {
        font-size: 0.9rem;
        font-weight: 600;
        color: white;
      }

      @media (max-width: 768px) {
        .user-name-nav {
          font-size: 0.85rem;
        }
      }

      @media (max-width: 480px) {
        .user-name-nav {
          font-size: 0.8rem;
        }
      }

      @media (max-width: 360px) {
        .user-name-nav {
          display: none;
        }
      }

      .signin-nav-btn {
        background: var(--accent-primary);
        color: white;
        border: none;
        padding: 0.6rem 1.25rem;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
      }

      @media (max-width: 768px) {
        .signin-nav-btn {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          border-radius: 10px;
        }
      }

      @media (max-width: 480px) {
        .signin-nav-btn {
          padding: 0.4rem 0.75rem;
          font-size: 0.8rem;
          border-radius: 8px;
        }
      }

      .signin-nav-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.1);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
      }

      @media (hover: none) {
        .signin-nav-btn:hover {
          transform: none;
        }
        .signin-nav-btn:active {
          transform: scale(0.95);
        }
      }
    `}</style>
  </nav>
);

const App = () => (
  <AuthProvider>
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  </AuthProvider>
);

export default App;
