// server.js
// Production-ready Express + Socket.IO backend for real-time chat

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

// Environment configuration
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Socket.IO configuration with production-ready settings
const io = new Server(server, {
  cors: {
    origin: NODE_ENV === 'production' ? [CLIENT_URL] : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: NODE_ENV === 'production' ? [CLIENT_URL] : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced in-memory room storage with cleanup
const rooms = new Map();
const userSockets = new Map(); // Track socket-to-user mapping

// Cleanup function to remove empty rooms
const cleanupEmptyRooms = () => {
  for (const [roomId, room] of rooms.entries()) {
    if (!room.users || room.users.length === 0) {
      console.log(`Cleaning up empty room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Store socket reference
  userSockets.set(socket.id, { socket, connectedAt: Date.now() });

  socket.on('join_room', ({ roomId, username }) => {
    try {
      // Validate input
      if (!roomId || !username) {
        socket.emit('error', { message: 'Room ID and username are required' });
        return;
      }

      // Leave any existing rooms first
      const currentRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      currentRooms.forEach(room => socket.leave(room));

      // Join the new room
      socket.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { 
          users: [], 
          messages: [],
          createdAt: Date.now()
        });
      }

      const room = rooms.get(roomId);
      
      // Remove user from room if they were already there (reconnection case)
      room.users = room.users.filter(u => u.id !== socket.id);
      
      // Add user to room
      const user = { 
        id: socket.id, 
        username: username.trim(),
        joinedAt: Date.now()
      };
      room.users.push(user);

      // Update socket-user mapping
      const socketData = userSockets.get(socket.id);
      if (socketData) {
        socketData.username = username.trim();
        socketData.roomId = roomId;
      }

      console.log(`User ${username} joined room ${roomId}. Room has ${room.users.length} users.`);

      // Send message history to the new user
      socket.emit('message_history', room.messages);
      
      // Notify all users in the room about the new user
      io.to(roomId).emit('user_joined', { 
        username: username.trim(), 
        users: room.users 
      });

    } catch (error) {
      console.error('Error in join_room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('send_message', ({ roomId, message, username }) => {
    try {
      // Validate input
      if (!roomId || !message || !username) {
        socket.emit('error', { message: 'Room ID, message, and username are required' });
        return;
      }

      if (!rooms.has(roomId)) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const room = rooms.get(roomId);
      
      // Check if user is in the room
      const userInRoom = room.users.some(u => u.id === socket.id);
      if (!userInRoom) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      const newMessage = { 
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        message: message.trim(), 
        username: username.trim(), 
        time: new Date(),
        socketId: socket.id
      };
      
      room.messages.push(newMessage);
      
      // Limit message history to last 1000 messages per room
      if (room.messages.length > 1000) {
        room.messages = room.messages.slice(-1000);
      }

      console.log(`Message from ${username} in room ${roomId}: ${message.substring(0, 50)}...`);
      
      io.to(roomId).emit('receive_message', newMessage);

    } catch (error) {
      console.error('Error in send_message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('send_document', ({ roomId, file, username }) => {
    try {
      // Validate input
      if (!roomId || !file || !username) {
        socket.emit('error', { message: 'Room ID, file, and username are required' });
        return;
      }

      if (!rooms.has(roomId)) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const room = rooms.get(roomId);
      
      // Check if user is in the room
      const userInRoom = room.users.some(u => u.id === socket.id);
      if (!userInRoom) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      const newFileMessage = { 
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file, 
        username: username.trim(), 
        time: new Date(),
        type: 'file',
        socketId: socket.id
      };
      
      room.messages.push(newFileMessage);
      
      // Limit message history
      if (room.messages.length > 1000) {
        room.messages = room.messages.slice(-1000);
      }

      console.log(`File shared by ${username} in room ${roomId}: ${file.name}`);
      
      io.to(roomId).emit('receive_message', newFileMessage);

    } catch (error) {
      console.error('Error in send_document:', error);
      socket.emit('error', { message: 'Failed to share document' });
    }
  });

  socket.on('typing', ({ roomId, username }) => {
    try {
      if (!roomId || !username) return;
      
      socket.to(roomId).emit('user_typing', { username: username.trim() });
    } catch (error) {
      console.error('Error in typing:', error);
    }
  });

  socket.on('stop_typing', ({ roomId, username }) => {
    try {
      if (!roomId || !username) return;
      
      socket.to(roomId).emit('user_stopped_typing', { username: username.trim() });
    } catch (error) {
      console.error('Error in stop_typing:', error);
    }
  });

  socket.on('leave_room', ({ roomId, username }) => {
    try {
      handleUserLeave(socket, roomId, username);
    } catch (error) {
      console.error('Error in leave_room:', error);
    }
  });

  socket.on('disconnect', (reason) => {
    try {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      
      const socketData = userSockets.get(socket.id);
      if (socketData && socketData.roomId && socketData.username) {
        handleUserLeave(socket, socketData.roomId, socketData.username);
      }
      
      // Clean up socket reference
      userSockets.delete(socket.id);
      
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Helper function to handle user leaving
function handleUserLeave(socket, roomId, username) {
  if (!roomId || !rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  
  // Remove user from room
  const initialUserCount = room.users.length;
  room.users = room.users.filter(u => u.id !== socket.id);
  
  if (room.users.length < initialUserCount) {
    console.log(`User ${username} left room ${roomId}. Room has ${room.users.length} users.`);
    
    // Notify remaining users
    socket.to(roomId).emit('user_left', { 
      username: username?.trim() || 'Unknown user', 
      users: room.users 
    });
  }
  
  // Leave the socket room
  socket.leave(roomId);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FastSync Real-time Chat Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    rooms: rooms.size,
    connections: userSockets.size
  });
});

// API endpoint to get room info (for debugging)
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  if (!rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const room = rooms.get(roomId);
  res.json({
    roomId,
    userCount: room.users.length,
    messageCount: room.messages.length,
    createdAt: room.createdAt
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ 
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 FastSync server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🔗 Client URL: ${CLIENT_URL}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});
