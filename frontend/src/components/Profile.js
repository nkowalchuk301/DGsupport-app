// src/components/Profile.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

function Profile({ user }) {
  const navigate = useNavigate();

  return (
    <div className="profile-container">
      <button onClick={() => navigate('/')} className="home-button">Back to Home</button>
      <h2>Profile</h2>
      <p>Email: {user.email}</p>
      {/* Add more profile-related information here */}
    </div>
  );
}

export default Profile;