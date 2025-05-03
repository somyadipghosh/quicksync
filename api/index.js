import http from 'http';
import { createServer } from 'http';
import SocketHandler from './socket.js';

// This file is used for local development
// In production, Vercel will use the api/socket.js file directly
const server = createServer((req, res) => {
  if (req.url === '/api/socket') {
    // Forward to our socket handler
    SocketHandler(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});