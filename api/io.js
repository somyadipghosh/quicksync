import { Server } from 'socket.io';

// Keep track of active rooms and their users
const rooms = new Map();

export default function ioHandler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket.IO already running');
    res.end();
    return;
  }

  console.log('Setting up Socket.IO');
  const io = new Server(res.socket.server, {
    path: '/api/io',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    },
    // Important for Vercel serverless environment
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8 // 100 MB for file uploads
  });

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
    
    socket.on('leaveRoom', ({ roomId }) => {
      handleUserLeaving(socket, roomId);
    });
    
    socket.on('message', (message) => {
      const roomId = Array.from(socket.rooms)[1]; // First room is user's socket ID
      if (roomId && rooms.has(roomId)) {
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
    
    socket.on('shareDocument', (documentData) => {
      const roomId = Array.from(socket.rooms)[1];
      if (roomId && rooms.has(roomId)) {
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
    
    socket.on('endRoom', ({ roomId }) => {
      if (roomId && rooms.has(roomId)) {
        io.to(roomId).emit('roomEnded');
        rooms.delete(roomId);
      }
    });
    
    socket.on('disconnect', () => {
      // Find which room this user was in
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          handleUserLeaving(socket, roomId);
          break;
        }
      }
    });
  });
  
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
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  }

  // Save the io instance
  res.socket.server.io = io;
  
  console.log('Socket.IO initialized');
  res.end();
}