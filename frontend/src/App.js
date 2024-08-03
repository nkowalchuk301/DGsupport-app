// src/App.js

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import magic from './magic';
import './App.css';
import Support from './components/Support';
import Profile from './components/Profile';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const apiUrl = process.env.REACT_APP_API_URL;
  const wsUrl = process.env.REACT_APP_WS_URL;

  useEffect(() => {
    magic.user.isLoggedIn().then(isLoggedIn => {
      if (isLoggedIn) {
        magic.user.getMetadata().then(userData => {
          setUser(userData);
        });
      }
      setIsLoading(false);
    });
  }, []);


  useEffect(() => {
    if (user) {
      const sendHeartbeat = () => {
        fetch(`${apiUrl}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
          credentials: 'include'
        }).catch(error => console.error('Error sending heartbeat:', error));
      };
  
      fetch(`${apiUrl}/join-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
        credentials: 'include'
      }).catch(error => console.error('Error sending join notification:', error));
  
      // Set up heartbeat interval
      const heartbeatInterval = setInterval(sendHeartbeat, 30000); // Every 60 seconds
  
      return () => {
        clearInterval(heartbeatInterval);
      };
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await magic.auth.loginWithMagicLink({ email });
      const userData = await magic.user.getMetadata();
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await magic.user.logout();
      await fetch(`${apiUrl}/end-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/" />
              ) : (
                <div>
                  <h1>Login</h1>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                  <button onClick={handleLogin}>Login</button>
                </div>
              )
            }
          />
          <Route
            path="/"
            element={
              user ? (
                <HomePage user={user} handleLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/support"
            element={
              user ? <Support user={user} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/profile"
            element={
              user ? <Profile user={user} /> : <Navigate to="/login" />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function HomePage({ user, handleLogout }) {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <h1>Digital Genesis Support Chat</h1>
      <h2>Welcome, {user.email}</h2>
      <nav className="vertical-menu">
        <button onClick={() => navigate('/support')}>Support</button>
        <button onClick={() => navigate('/profile')}>Profile</button>
        <button onClick={handleLogout}>Logout</button>
      </nav>
    </div>
  );
}

export default App;
