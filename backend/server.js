const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { processTypeformWebhook, sendTypeformResponseToDiscord } = require('./typeformWebhook');
require('dotenv').config();

let webSocketClients = [];
const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors({ origin: 'https://digitalgenesis.support' }));

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

client.login(process.env.DISCORD_BOT_TOKEN);

const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const wss = new WebSocketServer({ noServer: true });

async function sendJoinNotification(thread, email) {
  await thread.send(`**${email} has joined the chat**`);
}

async function sendLeaveNotification(thread, email) {
  await thread.send(`**${email} has left the chat**`);
}

async function getActiveDiscordUsers(guild) {
  const activeUsers = [];
  const members = await guild.members.fetch();
  
  members.forEach(member => {
    if (member.presence?.status === 'online' && !member.user.bot) {
      activeUsers.push(member.nickname || member.user.username);
    }
  });
  
  return activeUsers;
}


wss.on('connection', (ws) => {
  webSocketClients.push(ws);
  ws.on('close', () => {
    webSocketClients = webSocketClients.filter(client => client !== ws);
  });
});

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
    if (!guild) return res.status(404).send('Guild not found');
    
    const channelName = 'support-chat';
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (!channel) return res.status(404).send('Channel not found');
    
    const thread = channel.threads.cache.find(t => t.name === email);
    if (!thread) return res.status(404).send('Thread not found');
    
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
  console.log('User leaving chat:', email);
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return res.status(404).send('Guild not found');
    
    const channelName = 'support-chat';
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (!channel) return res.status(404).send('Channel not found');
    
    const thread = channel.threads.cache.find(t => t.name === email);
    if (thread) {
      await sendLeaveNotification(thread, email);
      console.log('Leave notification sent for:', email);
    }
    
    res.status(200).send('Leave notification sent');
  } catch (error) {
    console.error('Error sending leave notification:', error);
    res.status(500).send('Failed to send leave notification');
  }
});

app.post('/api/join-chat', async (req, res) => {
  const { email } = req.body;
  console.log('User joining chat:', email);
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
    if (!thread) {
      thread = await channel.threads.create({
        name: email,
        autoArchiveDuration: 1440,
        reason: 'New support conversation'
      });
    }
    
    await sendJoinNotification(thread, email);
    console.log('Join notification sent for:', email);
    
    res.status(200).send('Join notification sent');
  } catch (error) {
    console.error('Error sending join notification:', error);
    res.status(500).send('Failed to send join notification');
  }
});

app.get('/api/active-discord-users', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return res.status(404).send('Guild not found');
    
    const activeUsers = await getActiveDiscordUsers(guild);
    res.json(activeUsers);
  } catch (error) {
    console.error('Error fetching active Discord users:', error);
    res.status(500).send('Failed to fetch active Discord users');
  }
});

app.post('/api/typeform-webhook', (req, res) => {
  console.log('Received webhook:', req.body);
  res.status(200).send('Webhook received');
});

app.get('/', (req, res) => res.send('Backend server is running!'));