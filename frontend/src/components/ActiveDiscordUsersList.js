// DEPRECIATED, MIGHT USE THIS IN THE FUTURE

import React, { useState, useEffect } from 'react';

function ActiveDiscordUsersList() {
  const [activeUsers, setActiveUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://digitalgenesis.support/api/active-discord-users');
        if (!response.ok) {
          throw new Error('Failed to fetch active Discord users');
        }
        const users = await response.json();
        setActiveUsers(users);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching active Discord users:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchActiveUsers();
    const interval = setInterval(fetchActiveUsers, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <div>Loading active Discord users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="active-discord-users-list">
      <h3>Active Support Staff</h3>
      {activeUsers.length === 0 ? (
        <p>No active staff at the moment.</p>
      ) : (
        <ul>
          {activeUsers.map(user => (
            <li key={user}>
              <span className="status-indicator"></span>
              {user}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ActiveDiscordUsersList;