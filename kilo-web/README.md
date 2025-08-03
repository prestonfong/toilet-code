# Kilo Web

A web version of Kilo Code that runs on Node.js/Express, hosting a React UI for demonstration purposes.

## Features

- 🚀 Express.js web server on port 5000
- ⚛️ React UI with modern styling and interactivity
- 🔌 WebSocket real-time communication
- 🛠️ RESTful API endpoints (placeholder implementations)
- 📊 Health monitoring and status display
- 💬 Message echo system for testing

## Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
npm install

# Install UI dependencies (runs automatically via postinstall)
# Or manually: cd ui && npm install
```

### 2. Build the UI

```bash
npm run build
```

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:5000`

## Development

### Start in Development Mode

```bash
# Start server with nodemon (auto-restart on changes)
npm run dev

# In another terminal, start UI development server
cd ui
npm run dev
```

The UI development server runs on `http://localhost:3000` and proxies API requests to the main server.

### Project Structure

```
kilo-web/
├── server.js              # Main Express server
├── src/
│   └── routes/
│       └── api.js         # API routes
├── ui/                    # React application
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   └── utils/
│   │       └── webClient.ts  # Web client (replaces VS Code API)
│   └── dist/             # Built UI files (served by Express)
└── package.json
```

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/files` - List files (placeholder)
- `POST /api/files` - Create file (placeholder)
- `PUT /api/files/:filename` - Update file (placeholder)
- `DELETE /api/files/:filename` - Delete file (placeholder)
- `POST /api/execute` - Execute command (placeholder)
- `GET /api/extensions` - List extensions (placeholder)

## WebSocket Communication

The server provides WebSocket communication for real-time features. The client automatically connects and handles:

- Request/response messaging
- Broadcast messages
- Automatic reconnection

## UI Features

The React UI includes:

- **Connection Status** - Shows real-time connection status to the server
- **Health Monitoring** - Displays server health and timestamp
- **WebSocket Testing** - Send test messages via WebSocket
- **API Testing** - Test API endpoints with response display
- **Modern Styling** - Clean, responsive design

## Next Steps

This is a foundational demonstration. Future development could include:

1. **File System Integration** - Real file operations
2. **Code Editor** - Monaco Editor integration  
3. **Terminal** - Web-based terminal
4. **Extensions** - Plugin system
5. **Authentication** - User management
6. **Full Kilo Code Features** - Complete feature parity

## Contributing

1. Make changes to server code in `server.js` or `src/`
2. Make changes to UI in `ui/src/`
3. Build UI with `npm run build`
4. Test with `npm start`

## License

MIT