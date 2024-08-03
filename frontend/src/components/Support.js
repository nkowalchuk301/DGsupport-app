import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Support({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);
  const apiUrl = process.env.REACT_APP_API_URL;
  const wsUrl = process.env.REACT_APP_WS_URL;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    fetch(`${apiUrl}/join-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
      credentials: 'include'
    }).catch(error => console.error('Error sending join notification:', error));

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }

    const fetchHistory = async () => {
      try {
        const response = await fetch(`${apiUrl}/conversation-history?email=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const history = await response.json();
          setMessages(history);
        } else {
          console.error('Failed to fetch conversation history');
        }
      } catch (error) {
        console.error('Error fetching conversation history:', error);
      }
    };

    fetchHistory();

    audioRef.current = new Audio('/notification.mp3');
    const socket = new WebSocket(`${wsUrl}`);

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.email === user.email && !message.text.startsWith('**') && !message.text.endsWith('**')) {
          setMessages(prevMessages => [...prevMessages, {
            text: message.text,
            sender: message.sender,
            timestamp: message.timestamp
          }]);
          showNotification(message.text);
          playNotificationSound();
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, [user.email, apiUrl, wsUrl]);

  const showNotification = (message) => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
      try {
        new Notification("New Message", { body: message });
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          try {
            new Notification("New Message", { body: message });
          } catch (error) {
            console.error("Error creating notification after permission grant:", error);
          }
        }
      });
    }
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => console.error('Error playing audio:', error));
    }
  };

  const handleEndChatSession = async () => {
    try {
      await fetch(`${apiUrl}/end-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
        credentials: 'include'
      });
      navigate('/');
    } catch (error) {
      console.error('Error ending chat session:', error);
    }
  };

  const handleDeleteChatHistory = async () => {
    if (window.confirm('Are you sure you want to delete your chat history? This action cannot be undone.')) {
      try {
        await fetch(`${apiUrl}/delete-chat-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
          credentials: 'include'
        });
        setMessages([]);
      } catch (error) {
        console.error('Error deleting chat history:', error);
      }
    }
  };

  const handleSend = async () => {
    if (input.trim() === '') return;
    const newMessage = {
      text: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    await sendMessageToDiscord(newMessage);
    setInput('');
  };

const sendMessageToDiscord = async (message) => {
  try {
    const response = await fetch(`${apiUrl}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, email: user.email }),
    });
    if (!response.ok) {
      throw new Error('Failed to send message to Discord');
    }
    setMessages(prevMessages => [...prevMessages, message]);
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
};

  return (
    <div className="support-container">
      <div className="button-container">
      <button onClick={() => navigate('/')} className="home-button">Back to Home</button>
      </div>
      <div className="support-content">
        <div className="chat-container">
          <div className="messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.sender}`}>
                <div className="message-label">{message.sender === 'user' ? 'You' : 'Support'}</div>
                <div className="message-content">{message.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message"
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Support;
