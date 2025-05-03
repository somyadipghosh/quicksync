// This is a Next.js API route that will act as an entry point for Socket.IO in Vercel
import ioHandler from './io';

// Route handler that processes socket requests
export default async function handler(req, res) {
  // Add additional headers for CORS and WebSocket compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // For GET or POST requests, run the Socket.IO handler
  if (req.method === 'GET' || req.method === 'POST') {
    return ioHandler(req, res);
  }

  // For any other method, return a 405 Method Not Allowed
  res.status(405).end();
}