import { Server } from 'socket.io';

// Keep track of active rooms and their users
const rooms = new Map();

// This is a serverless function that will be deployed to Vercel
export default function SocketHandler(req, res) {
  // Socket.io server cannot be initialized multiple times, so check if it exists first
  if (!res.socket.server.io) {
    console.log('Socket is initializing...');
    
    // Initialize socket server
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    // Socket.io server events
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
      
      // Handle joining room
      socket.on('joinRoom', ({ user, roomId }) => {
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            users: new Map(),
            messages: [],
          });
        }
        
        // Add user to room
        const room = rooms.get(roomId);
        room.users.set(socket.id, user);
        
        // Notify everyone about the new user
        io.to(roomId).emit('roomUsers', Array.from(room.users.values()));
        
        // Send previous messages to the user
        socket.emit('previousMessages', room.messages);
        
        console.log(`${user.name} joined room: ${roomId}`);
      });
      
      // Handle leaving room
      socket.on('leaveRoom', ({ roomId }) => {
        handleUserLeaving(socket, roomId);
      });
      
      // Handle messages
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
      
      // Handle document sharing
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
      
      // Handle end room (only by creator)
      socket.on('endRoom', ({ roomId }) => {
        if (roomId && rooms.has(roomId)) {
          io.to(roomId).emit('roomEnded');
          rooms.delete(roomId);
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        // Find which room this user was in
        for (const [roomId, room] of rooms.entries()) {
          if (room.users.has(socket.id)) {
            handleUserLeaving(socket, roomId);
            break;
          }
        }
        
        console.log(`User disconnected: ${socket.id}`);
      });
    });
    
    // Save the io instance
    res.socket.server.io = io;
  }
  
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
        io.to(roomId).emit('roomUsers', Array.from(room.users.values()));
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
        
        console.log(`${user.name} left room: ${roomId}`);
      }
    }
  }
  
  // Return a response to acknowledge the socket connection
  res.end();
}