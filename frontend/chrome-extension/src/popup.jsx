import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { LogIn, LogOut, Settings, MessageCircle } from 'lucide-react';
import './popup.css';

const Popup = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chats, setChats] = useState([]);

  useEffect(() => {
    checkAuth();
    loadChats();
  }, []);

  const checkAuth = async () => {
    const result = await chrome.storage.local.get(['authToken']);
    setIsAuthenticated(!!result.authToken);
  };

  const loadChats = async () => {
    const result = await chrome.storage.local.get(['chats']);
    setChats(result.chats || []);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      await chrome.storage.local.set({
        authToken: data.access_token,
        loggedInAt: Date.now()
      });

      console.log("JWT saved:", data.access_token);

      setIsAuthenticated(true);
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await chrome.storage.local.remove(['authToken']);
    setIsAuthenticated(false);
  };

  const openWidget = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_WIDGET' });
      window.close();
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>PageSense</h1>
          <p>Sign in to continue</p>
        </div>
        
        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>PageSense</h1>
        <button className="icon-button" onClick={handleLogout}>
          <LogOut size={16} />
        </button>
      </div>
      
      <div className="popup-content">
        <button className="primary-action" onClick={openWidget}>
          <MessageCircle size={20} />
          Open Widget
        </button>
        
        <div className="chats-section">
          <h3>Recent Chats ({chats.length}/3)</h3>
          {chats.length === 0 ? (
            <p className="empty-text">No chats yet</p>
          ) : (
            <div className="chats-list">
              {chats.map((chat) => (
                <div key={chat.id} className="chat-item">
                  {chat.title || 'Untitled Chat'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Popup />);