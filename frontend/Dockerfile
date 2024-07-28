FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Use a simple server to serve the static files
RUN npm install -g serve
EXPOSE 5000
CMD ["serve", "-s", "build"]
