import { Server } from 'socket.io';

// Keep track of active rooms and their users
const rooms = new Map();

export default function handler(req, res) {
  // Add CORS headers for Socket.IO handshake
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Socket.IO server cannot be initialized multiple times
  if (res.socket.server.io) {
    console.log('Socket.IO already running');
    res.end();
    return;
  }

  console.log('Initializing Socket.IO server');
  
  // Create Socket.IO server with simplified options
  const io = new Server(res.socket.server, {
    path: '', // Empty because the path is in the API route
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Handle connections
  io.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);
    
    // Handle joining room
    socket.on('joinRoom', ({ user, roomId }) => {
      console.log(`User ${user?.name || 'unknown'} joining room ${roomId}`);
      socket.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          messages: []
        });
      }
      
      // Add user to room
      const room = rooms.get(roomId);
      const userData = {
        ...user,
        isCreator: room.users.size === 0
      };
      room.users.set(socket.id, userData);
      
      // Notify everyone about users in the room
      const usersArray = Array.from(room.users.values());
      io.to(roomId).emit('roomUsers', usersArray);
      
      // Send previous messages to the user
      socket.emit('previousMessages', room.messages);
    });
    
    // Handle messages
    socket.on('message', (message) => {
      const roomId = Array.from(socket.rooms)[1]; // First room is the socket ID
      if (roomId && rooms.has(roomId)) {
        // Store message
        const room = rooms.get(roomId);
        room.messages.push(message);
        
        // Limit to 100 messages
        if (room.messages.length > 100) {
          room.messages.shift();
        }
        
        // Broadcast message
        io.to(roomId).emit('message', message);
      }
    });
    
    // Handle document sharing
    socket.on('shareDocument', (documentData) => {
      const roomId = Array.from(socket.rooms)[1];
      if (roomId && rooms.has(roomId)) {
        // Create message for document
        const docMessage = {
          ...documentData,
          type: 'document',
          text: `Shared document: ${documentData.document.name}`
        };
        
        rooms.get(roomId).messages.push(docMessage);
        io.to(roomId).emit('message', docMessage);
      }
    });
    
    // Handle leaving room
    socket.on('leaveRoom', ({ roomId }) => {
      handleUserLeaving(socket, roomId);
    });
    
    // Handle ending room
    socket.on('endRoom', ({ roomId }) => {
      if (roomId && rooms.has(roomId)) {
        io.to(roomId).emit('roomEnded');
        rooms.delete(roomId);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          handleUserLeaving(socket, roomId);
          break;
        }
      }
    });
  });
  
  // Helper function to handle user leaving a room
  function handleUserLeaving(socket, roomId) {
    if (!roomId || !rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const user = room.users.get(socket.id);
    
    if (user) {
      // Remove user from room
      room.users.delete(socket.id);
      socket.leave(roomId);
      
      // Notify others
      const remainingUsers = Array.from(room.users.values());
      io.to(roomId).emit('roomUsers', remainingUsers);
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(roomId);
      }
    }
  }

  // Store io instance on the server
  res.socket.server.io = io;
  
  // Send status response
  res.end();
}