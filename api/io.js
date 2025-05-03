import { Server } from 'socket.io';

// Keep track of active rooms and their users
const rooms = new Map();
// Track active connections
const activeConnections = new Map();

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
    // Configure for better serverless performance
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,      // Longer ping timeout (60s)
    pingInterval: 20000,     // More frequent pings (20s)
    upgradeTimeout: 30000,   // Longer upgrade timeout
    maxHttpBufferSize: 1e8,  // 100 MB for file uploads
    connectTimeout: 45000,   // Longer connect timeout
    allowEIO3: true,         // Allow Engine.IO v3 compatibility
  });

  // Handle new connections
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
    socket.use(([event, ...args], next) => {
      refreshActivity();
      next();
    });
    
    // Handle heartbeat to keep connection alive
    socket.on('heartbeat', () => {
      refreshActivity();
      socket.emit('heartbeat-response', { timestamp: Date.now() });
    });
    
    // Handle joining room with improved error handling
    socket.on('joinRoom', ({ user, roomId }) => {
      try {
        console.log(`${user.name} (${socket.id}) is joining room ${roomId}`);
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
    
    // Handle leaving room with improved error handling
    socket.on('leaveRoom', ({ roomId }) => {
      try {
        console.log(`User ${socket.id} is leaving room ${roomId}`);
        handleUserLeaving(socket, roomId);
      } catch (error) {
        console.error(`Error leaving room ${roomId}:`, error);
      }
    });
    
    // Handle messages with added error handling
    socket.on('message', (message) => {
      try {
        const roomId = Array.from(socket.rooms)[1]; // First room is socket ID
        if (roomId && rooms.has(roomId)) {
          // Refresh activity timestamp
          refreshActivity();
          
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
          refreshActivity();
          
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
  
  // Improved user leaving handler
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
  
  // Set up periodic cleanup of stale connections (every 2 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleThreshold = 3 * 60 * 1000; // 3 minutes
    
    // Check for stale connections
    for (const [socketId, connection] of activeConnections.entries()) {
      if (now - connection.lastActivity > staleThreshold) {
        console.log(`Cleaning up stale connection: ${socketId}`);
        
        // Clean up any room association
        if (connection.roomId && rooms.has(connection.roomId)) {
          const room = rooms.get(connection.roomId);
          if (room.users.has(socketId)) {
            room.users.delete(socketId);
            
            // Notify other room members
            const remainingUsers = Array.from(room.users.values());
            io.to(connection.roomId).emit('roomUsers', remainingUsers);
            
            // Remove empty rooms
            if (room.users.size === 0) {
              rooms.delete(connection.roomId);
            }
          }
        }
        
        // Remove from active connections
        activeConnections.delete(socketId);
      }
    }
  }, 2 * 60 * 1000); // Run every 2 minutes
  
  // Clean up the interval if the server shuts down
  res.socket.server.on('close', () => {
    clearInterval(cleanupInterval);
  });

  // Save the io instance
  res.socket.server.io = io;
  
  console.log('Socket.IO initialized');
  res.end();
}