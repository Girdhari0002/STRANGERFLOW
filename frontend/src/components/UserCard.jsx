import React from 'react';
import { User, Lock } from 'lucide-react';

const UserCard = ({ user, onConnect, isAuthenticated }) => {
    // If a user is in the onlineUsers list passed from App.jsx, they are online
    const isOnline = true;
    const canConnect = isOnline && isAuthenticated;

    return (
        <div className="glass card-hover" style={{
            padding: '1.5rem',
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: isOnline ? 'var(--success)' : 'transparent'
            }} />

            <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0.5rem auto 1.25rem' }}>
                <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                    alt={user.name}
                    style={{ width: '100%', height: '100%', borderRadius: '28px', background: 'rgba(255,255,255,0.05)', objectFit: 'cover' }}
                />
                <div style={{
                    position: 'absolute', bottom: '2px', right: '2px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: isOnline ? 'var(--success)' : '#475569',
                    border: '3px solid var(--bg-card)',
                    boxShadow: isOnline ? '0 0 10px var(--success)' : 'none'
                }} />
            </div>

            <h3 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{user.name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {isOnline ? 'Available now' : 'Currently offline'}
            </p>

            <button
                onClick={onConnect}
                className="btn-primary"
                style={{
                    width: '100%',
                    padding: '0.8rem',
                    opacity: canConnect ? 1 : 0.6,
                    cursor: canConnect ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
                disabled={!canConnect}
            >
                {!isAuthenticated && <Lock size={16} />}
                {isAuthenticated ? 'Connect' : 'Sign in to Connect'}
            </button>
        </div>
    );
};

export default UserCard;
