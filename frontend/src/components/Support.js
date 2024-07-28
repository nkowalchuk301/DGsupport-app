import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Support({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    fetch('https://digitalgenesis.support/api/join-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).catch(error => console.error('Error sending join notification:', error));

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }
    const fetchHistory = async () => {
      try {
        const response = await fetch(`https://digitalgenesis.support/api/conversation-history?email=${encodeURIComponent(user.email)}`);
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
    const socket = new WebSocket(`wss://digitalgenesis.support/ws`);

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };
 
socket.onmessage = (event) => {
  console.log('Received WebSocket message:', event.data);
  try {
    const message = JSON.parse(event.data);
    console.log('Parsed message:', message);
    console.log('User email:', user.email);
    if (message.email === user.email && !message.text.startsWith('**') && !message.text.endsWith('**')) {
      console.log('Email match found and not a system message, updating messages');
      setMessages(prevMessages => [...prevMessages, {
        text: message.text,
        sender: message.sender,
        timestamp: message.timestamp
      }]);
      showNotification(message.text);
      playNotificationSound();
    } else {
      console.log('Email mismatch or system message, not displaying');
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
  }
};
 

    return () => {
      socket.close();
      fetch('https://digitalgenesis.support/api/leave-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      }).catch(error => console.error('Error sending leave notification:', error));
    };
  }, [user.email]);


  const showNotification = (message) => {
    console.log("Attempting to show notification");  // Debug log
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
      try {
        new Notification("New Message", { body: message });
        console.log("Notification sent");  // Debug log
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          try {
            new Notification("New Message", { body: message });
            console.log("Notification sent after permission grant");  // Debug log
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

  const handleSend = async () => {
    if (input.trim() === '') return;
    const newMessage = {
      text: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    await sendMessageToDiscord(newMessage);
    setInput('');
  };

  const sendMessageToDiscord = async (message) => {
    const response = await fetch('https://digitalgenesis.support/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, email: user.email }),
    });
    if (!response.ok) {
      console.error('Failed to send message to Discord');
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