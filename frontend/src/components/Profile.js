// In Profile.js

import React from 'react';
import { useNavigate } from 'react-router-dom';

function Profile({ user }) {
  const navigate = useNavigate();
  const apiUrl = process.env.REACT_APP_API_URL;

  const handleDeleteChatHistory = async () => {
    if (window.confirm('Are you sure you want to delete your chat history? This action cannot be undone.')) {
      try {
        await fetch(`${apiUrl}/delete-chat-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
          credentials: 'include'
        });
        alert('Chat history has been deleted.');
      } catch (error) {
        console.error('Error deleting chat history:', error);
        alert('Failed to delete chat history. Please try again.');
      }
    }
  };

  return (
    <div className="profile-container">
      <button onClick={() => navigate('/')} className="home-button">Back to Home</button>
      <h2>Profile</h2>
      <p>Email: {user.email}</p>
      <button onClick={handleDeleteChatHistory} className="delete-history-button">Delete Chat History</button>
    </div>
  );
}

export default Profile;