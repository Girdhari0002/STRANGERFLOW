import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Settings, LogOut, Shield, MapPin, Camera, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5051/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        updateUser(data);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Update failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="profile-card glass"
      >
        <div className="profile-header">
          <div className="avatar-section">
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" />
              ) : (
                <User size={40} />
              )}
              <button className="edit-avatar"><Camera size={16} /></button>
            </div>
            <div className="profile-info">
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="logout-btn">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        <div className="profile-tabs">
          <button className="tab active"><User size={18} /> Account</button>
          <button className="tab"><Shield size={18} /> Security</button>
          <button className="tab"><Settings size={18} /> Preferences</button>
        </div>

        <div className="profile-content">
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`alert ${message.type}`}
            >
              {message.text}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <div className="form-input">
                  <User size={18} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <div className="form-input">
                  <Mail size={18} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Update Password</label>
                <div className="form-input">
                  <Shield size={18} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <style jsx>{`
        .profile-container {
          max-width: 900px;
          margin: 2rem auto;
          padding: 0 1rem;
        }
        .profile-card {
          border-radius: 30px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .profile-header {
          padding: 3rem;
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .avatar-section {
          display: flex;
          gap: 2rem;
          align-items: center;
        }
        .profile-avatar {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 35px;
          background: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.3);
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 35px;
          object-fit: cover;
        }
        .edit-avatar {
          position: absolute;
          bottom: -5px;
          right: -5px;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: white;
          color: black;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .profile-info h3 {
          font-size: 1.75rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
        }
        .profile-info p {
          color: var(--text-secondary);
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.75rem 1.25rem;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .logout-btn:hover {
          background: #ef4444;
          color: white;
        }
        .profile-tabs {
          display: flex;
          padding: 1rem 3rem;
          gap: 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          padding: 0.75rem 0;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab.active {
          color: white;
          border-bottom-color: var(--accent-primary);
        }
        .profile-content {
          padding: 3rem;
        }
        .alert {
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          font-size: 0.9rem;
          text-align: center;
        }
        .alert.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        .alert.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2.5rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .form-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .form-input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 1.25rem;
        }
        .form-input input {
          flex: 1;
          background: transparent;
          border: none;
          height: 54px;
          color: white;
          outline: none;
        }
        .form-input svg { color: var(--text-secondary); }
        .save-btn {
          height: 54px;
          padding: 0 2rem;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.5);
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Profile;
