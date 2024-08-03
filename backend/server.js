const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
const cors = require('cors');
const { WebSocketServer } = require('ws');
require('dotenv').config();

let webSocketClients = [];
const app = express();
const port = process.env.PORT || 5000;
const activeSessions = new Map();

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(cors({
  origin: 'https://digitalgenesis.support',
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: 'true'
}));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 3600000 // 1 hour
  }
}));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ]
});

client.once('ready', () => console.log('Discord bot is ready!'));

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
});

const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const wss = new WebSocketServer({ noServer: true });

async function notifyDiscord(email, action) {
  const guild = await client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (!guild) return console.error('Guild not found');

  const channel = await guild.channels.cache.find(ch => ch.name === 'support-chat');
  if (!channel) return console.error('Channel not found');

  let thread = channel.threads.cache.find(t => t.name === email);
  if (!thread) {
    thread = await channel.threads.create({
      name: email,
      autoArchiveDuration: 1440,
      reason: 'New support conversation'
    });
  }

  const message = `**${email} has ${action === 'join' ? 'joined' : 'left'} the chat**`;
  await thread.send(message);
  console.log(`${action} message sent for ${email}`);
}

wss.on('connection', (ws) => {
  webSocketClients.push(ws);
  ws.on('close', () => {
    webSocketClients = webSocketClients.filter(client => client !== ws);
  });
});

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [email, lastActive] of activeSessions.entries()) {
    if (now - lastActive > 30 * 60 * 1000) { // 30 minutes
      activeSessions.delete(email);
      notifyDiscord(email, 'leave').catch(console.error);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleSessions, 5 * 60 * 1000);

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.isThread()) {
    console.log('Received message in thread:', message.content);
    const thread = message.channel;
    const email = thread.name;
    console.log('Thread name (email):', email);
    const payload = JSON.stringify({
      email: email,
      text: message.content,
      sender: 'bot',
      timestamp: message.createdAt.toISOString()
    });
    console.log('Preparing to send WebSocket payload:', payload);
    webSocketClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
        console.log('Sent WebSocket message to client');
      }
    });
  }
});

app.post('/api/send-message', async (req, res) => {
  const { text, email } = req.body;
  console.log('Creating/using thread for email:', email);
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return res.status(404).send('Guild not found');
    
    const channelName = 'support-chat';
    let channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (!channel) {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
          },
        ],
      });
    }
    
    let thread = channel.threads.cache.find(t => t.name === email);
    let isNewThread = false;
    if (!thread) {
      thread = await channel.threads.create({
        name: email,
        autoArchiveDuration: 1440,
        reason: 'New support conversation'
      });
      isNewThread = true;
    }
    
    if (isNewThread) {
      await sendJoinNotification(thread, email);
    }
    
    await thread.send(text);
    console.log('Message sent to thread:', email);
    res.status(200).send('Message sent');
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Failed to send message');
  }
});

app.get('/api/conversation-history', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send('Email is required');
  console.log('Fetching history for email:', email);
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('Guild not found');
      return res.status(404).send('Guild not found');
    }

    const channelName = 'support-chat';
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (!channel) {
      console.error('Channel not found');
      return res.status(404).send('Channel not found');
    }

    const thread = channel.threads.cache.find(t => t.name === email);
    if (!thread) {
      console.error('Thread not found');
      return res.status(404).send('Thread not found');
    }

    const messages = await thread.messages.fetch({ limit: 100 });

    const formattedMessages = messages
      .filter(msg => !msg.content.startsWith('**') && !msg.content.endsWith('**')) // Filter out system messages
      .map(msg => ({
        sender: msg.author.bot ? 'bot' : 'user',
        text: msg.content,
        timestamp: msg.createdAt.toISOString()
      }))
      .reverse();
    console.log('Fetched messages:', formattedMessages.length);
    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).send('Failed to fetch conversation history');
  }
});

app.post('/api/leave-chat', async (req, res) => {
  const { email } = req.body;
  
  if (activeSessions.has(email)) {
    activeSessions.delete(email);
    await notifyDiscord(email, 'leave');
    req.session.destroy(err => {
      if (err) {
        console.error('Failed to destroy session:', err);
        return res.status(500).send('Failed to end session');
      }
      res.send('Leave notification sent and session ended');
    });
  } else {
    res.status(400).send('No active session for this email');
  }
});

app.post('/api/join-chat', async (req, res) => {
  const { email } = req.body;
  
  if (!activeSessions.has(email)) {
    activeSessions.set(email, Date.now());
    await notifyDiscord(email, 'join');
    console.log('Session started for:', email);
  } else {
    activeSessions.set(email, Date.now());
    console.log('Session refreshed for:', email);
  }
  
  req.session.email = email;
  res.status(200).send('Join notification processed');
});

app.get('/', (req, res) => res.send('Backend server is running!'));
