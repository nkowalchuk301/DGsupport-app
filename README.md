# DGsupport-app by NGK

## Overview

DGsupport-app is an application designed to direct message with clients through a Discord bot/webapp interface. The application is built with a React frontend and an Express backend, all containerized using Docker for deployment and scalability.

### Features
  - Webapp interface for users to login and speak with 'Support' (you). Support chat is handled using websocket/webhooks through a Discord bot. User login is handled by magic.link.
  - 'support-channel' is automatically created when a user direct messages support from the webapp. Within that channel a thread is created labelled with the users email.
  - Users can view and delete chat history.
  - Notifications for when Users have joined and left the chat, via express-sessions.
  - Audible notifications and Desktop notifications will be triggered for the user when using the webapp chat.
  - Archive channel will be created in Discord if users delete chat history, archiving all of the chat history.

### Framework
  - Frontend: Node React.
  - Backend: Express.
  - Docker: Docker Compose.
  - NGINX: Reverse proxy.

## Installation

To get started with DGsupport-app, follow these steps:

### 1. Clone the Repository:
```
git clone https://github.com/nkowalchuk301/DGsupport-app.git
cd DGsupport-app
```
### 2. Configuration
  - You will need to create a [Discord bot](https://discord.com/developers/docs/intro) for your Discord server and join it to that server, ensure it has proper permissions to handle channels, messages, message history, threads, etc. Note down your Discord bot's token.
  - You will need to create a [Magic.link](https://magic.link/) account to handle logins. Note down you 'Public Key'.
  - NGINX: Create an nginx.conf file in the /root directory. You need to adjust this with your settings or nothing will work.
  - Environment Variables: Create an .env file. **Place your .env in both the ./root directory and in the /frontend directory**. You need to adjust this with your settings or nothing will work.

### .env Configuration
```
DISCORD_BOT_TOKEN=[TOKEN]
DISCORD_CHANNEL_ID=[ID]
DISCORD_GUILD_ID=[ID]
//DISCORD BOT SHOULD CREATE THE CHANNELS. KEEPING THESE HERE FOR INFORMATIONAL PURPOSE.
MAGIC_SECRET_KEY=[KEY](YOU PROBABLY WONT NEED THIS)
REACT_APP_MAGIC_PUBLISH_KEY=[KEY]
REACT_APP_API_URL=https://[PUBLIC DOMAIN/IP]
REACT_APP_WS_URL=wss://[PUBLIC DOMAIN/IP]
PORT=[PORT]
SECRET_KEY=[I RECOMMEND YOU GENERATE A SHA-256 STRING/KEY]
```

## nginx.conf Configuration
```
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    server {
        listen 8080;
        server_name [DOMAIN/IP];
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name [DOMAIN/IP];

        ssl_certificate /etc/nginx/certificates/[CERTNAME].crt;
        ssl_certificate_key /etc/nginx/certificates/[CERTKEY].key;

        location / {
            proxy_pass http://frontend:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location /api/ {
            proxy_pass http://backend:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
```
### 3. Build
Ensure Docker and Docker Compose are installed on your system, then run:
```
docker-compose up --build
```
### Usage

Once the application is running, access the frontend via http://localhost:3000 (or your domain/ip that you set) and attempt login. You should recieve an email from magic.link to approve the login. Navigate 'Support' and test the chat. You should receive a notification in the Discord server that you joined your Discord bot to. You should now be able to talk back and forth via the webapp and Discord as a secure direct messaging platform.

### Contributing

Contributions are welcome! Please fork the repository and submit pull requests for any enhancements or bug fixes. I will be actively working on this project but development will be slow.

### License

This project is licensed under the MIT License.


