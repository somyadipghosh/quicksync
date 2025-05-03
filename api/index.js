import http from 'http';
import { Server } from 'socket.io';
import { createServer } from 'http';

// This file is used for local development
// In production, Vercel will use the api/socket.js file directly

const server = createServer((req, res) => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  
  if (req.url === '/api/socket') {
    res.end('Socket.IO server is running');
  } else {
    res.end('API server is running');
  }
});

// Keep track of active rooms and their users
const rooms = new Map();

const io = new Server(server, {
  path: '/api/socket',
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io server events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle joining room
  socket.on('joinRoom', ({ user, roomId }) => {
    console.log(`${user.name} (${socket.id}) is joining room ${roomId}`);
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      console.log(`Creating new room: ${roomId}`);
      rooms.set(roomId, {
        users: new Map(),
        messages: [],
      });
    }
    
    // Add user to room
    const room = rooms.get(roomId);
    const userData = {
      ...user,
      isCreator: room.users.size === 0 // First user is the creator
    };
    room.users.set(socket.id, userData);
    
    // Notify everyone about the new user
    const usersArray = Array.from(room.users.values());
    console.log(`Room ${roomId} now has ${usersArray.length} users`);
    io.to(roomId).emit('roomUsers', usersArray);
    
    // Send previous messages to the user
    socket.emit('previousMessages', room.messages);
  });
  
  // Handle leaving room
  socket.on('leaveRoom', ({ roomId }) => {
    console.log(`User ${socket.id} is leaving room ${roomId}`);
    handleUserLeaving(socket, roomId);
  });
  
  // Handle messages
  socket.on('message', (message) => {
    const roomId = Array.from(socket.rooms)[1]; // First room is user's socket ID
    if (roomId && rooms.has(roomId)) {
      console.log(`Message in room ${roomId} from ${message.user}: ${message.text.substring(0, 30)}...`);
      
      // Store message
      const room = rooms.get(roomId);
      room.messages.push(message);
      
      // Cap messages at 100 per room
      if (room.messages.length > 100) {
        room.messages.shift();
      }
      
      // Broadcast message to everyone in the room
      io.to(roomId).emit('message', message);
    }
  });
  
  // Handle document sharing
  socket.on('shareDocument', (documentData) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      console.log(`Document shared in room ${roomId} from ${documentData.user}: ${documentData.document.name}`);
      
      // Create a message for this document share
      const docMessage = {
        ...documentData,
        type: 'document',
        text: `Shared document: ${documentData.document.name}`,
      };
      
      // Store and broadcast like a regular message
      rooms.get(roomId).messages.push(docMessage);
      io.to(roomId).emit('message', docMessage);
    }
  });
  
  // Handle end room (only by creator)
  socket.on('endRoom', ({ roomId }) => {
    if (roomId && rooms.has(roomId)) {
      console.log(`Room ${roomId} ended by a user`);
      io.to(roomId).emit('roomEnded');
      rooms.delete(roomId);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    // Find which room this user was in
    for (const [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
        handleUserLeaving(socket, roomId);
        break;
      }
    }
  });
});

// Helper function for user leaving
function handleUserLeaving(socket, roomId) {
  if (roomId && rooms.has(roomId)) {
    const room = rooms.get(roomId);
    const user = room.users.get(socket.id);
    
    if (user) {
      // Remove user from room
      room.users.delete(socket.id);
      socket.leave(roomId);
      
      // Notify others
      const remainingUsers = Array.from(room.users.values());
      io.to(roomId).emit('roomUsers', remainingUsers);
      console.log(`User left room ${roomId}, ${remainingUsers.length} users remain`);
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        console.log(`Room ${roomId} is now empty, deleting`);
        rooms.delete(roomId);
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});