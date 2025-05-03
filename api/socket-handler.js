import { Server } from 'socket.io';

// Keep track of active rooms and their users
const rooms = new Map();
// Track active connections
const activeConnections = new Map();

// Handler function for socket.io in Vercel
export default async function handler(req, res) {
  // Required CORS headers for Socket.IO handshake
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if Socket.IO server is already initialized
  if (res.socket.server.io) {
    console.log('Socket.IO already running');
    res.end();
    return;
  }

  try {
    console.log('Setting up Socket.IO server in socket-handler.js');
    
    // Create new Socket.IO server
    const io = new Server(res.socket.server, {
      path: '', // Important: Use empty string since path is part of the API route
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      // Serverless optimized settings
      transports: ['polling', 'websocket'],
      pingTimeout: 30000,
      pingInterval: 25000,
      connectTimeout: 30000,
    });

    // Handle socket connections
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
      activeConnections.set(socket.id, { 
        connected: true, 
        lastActivity: Date.now(),
        roomId: null
      });
      
      // Track socket activity
      const refreshActivity = () => {
        if (activeConnections.has(socket.id)) {
          activeConnections.get(socket.id).lastActivity = Date.now();
        }
      };
      
      // Update activity on each incoming event
      socket.onAny(() => {
        refreshActivity();
      });
      
      // Handle heartbeat to keep connection alive
      socket.on('heartbeat', () => {
        refreshActivity();
        socket.emit('heartbeat-response', { timestamp: Date.now() });
      });
      
      // Handle joining room with improved error handling
      socket.on('joinRoom', ({ user, roomId }) => {
        try {
          console.log(`${user?.name || 'Unknown user'} (${socket.id}) is joining room ${roomId}`);
          socket.join(roomId);
          
          if (activeConnections.has(socket.id)) {
            activeConnections.get(socket.id).roomId = roomId;
          }
          
          // Initialize room if it doesn't exist
          if (!rooms.has(roomId)) {
            rooms.set(roomId, {
              users: new Map(),
              messages: [],
            });
          }
          
          // Add user to room
          const room = rooms.get(roomId);
          const userData = {
            ...user, 
            isCreator: room.users.size === 0, // First user is the creator
            lastSeen: Date.now()
          };
          room.users.set(socket.id, userData);
          
          // Notify everyone about the new user
          const usersArray = Array.from(room.users.values());
          io.to(roomId).emit('roomUsers', usersArray);
          
          // Send previous messages to the user
          socket.emit('previousMessages', room.messages);
          
          // Acknowledge successful join
          socket.emit('joinedRoom', { success: true, roomId });
        } catch (error) {
          console.error(`Error joining room ${roomId}:`, error);
          socket.emit('joinedRoom', { success: false, error: error.message });
        }
      });
      
      // Handle other events
      socket.on('leaveRoom', ({ roomId }) => {
        try {
          console.log(`User ${socket.id} is leaving room ${roomId}`);
          handleUserLeaving(socket, roomId);
        } catch (error) {
          console.error(`Error leaving room ${roomId}:`, error);
        }
      });
      
      socket.on('message', (message) => {
        try {
          const roomId = Array.from(socket.rooms)[1]; // First room is socket ID
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
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      socket.on('shareDocument', (documentData) => {
        try {
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
        } catch (error) {
          console.error('Error handling document share:', error);
        }
      });
      
      socket.on('endRoom', ({ roomId }) => {
        try {
          if (roomId && rooms.has(roomId)) {
            io.to(roomId).emit('roomEnded');
            rooms.delete(roomId);
          }
        } catch (error) {
          console.error('Error ending room:', error);
        }
      });
      
      // Handle disconnection with cleanup
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.id} disconnected: ${reason}`);
        
        try {
          // Remove from active connections
          const connection = activeConnections.get(socket.id);
          if (connection && connection.roomId) {
            handleUserLeaving(socket, connection.roomId);
          }
          activeConnections.delete(socket.id);
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
    
    // Helper function for user leaving
    function handleUserLeaving(socket, roomId) {
      if (!roomId || !rooms.has(roomId)) return;
      
      const room = rooms.get(roomId);
      const user = room.users.get(socket.id);
      
      if (user) {
        // Remove user from room
        room.users.delete(socket.id);
        socket.leave(roomId);
        
        // Update user's connection record
        if (activeConnections.has(socket.id)) {
          activeConnections.get(socket.id).roomId = null;
        }
        
        // Notify others
        const remainingUsers = Array.from(room.users.values());
        io.to(roomId).emit('roomUsers', remainingUsers);
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    }

    // Save the io instance
    res.socket.server.io = io;
    console.log('Socket.IO initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Socket.IO:', error);
    res.status(500).json({ error: 'Failed to initialize Socket.IO' });
    return;
  }
  
  res.status(200).json({ success: true });
}