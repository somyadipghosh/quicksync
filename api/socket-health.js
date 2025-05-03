// Simple health check for Socket.IO connectivity

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Check if Socket.IO is initialized
  const socketInitialized = !!res.socket.server.io;
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    socketInitialized,
    environment: process.env.NODE_ENV || 'development'
  });
}