import { Server } from "socket.io";

// In-memory data store (note: this will reset when the serverless function is redeployed)
const rooms = new Map();

export default function SocketHandler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if Socket.IO server is already running
  if (res.socket.server.io) {
    console.log("Socket.IO already running");
    res.end();
    return;
  }

  // Set up Socket.IO server with configurations optimized for Vercel
  console.log("Setting up Socket.IO server");
  const io = new Server(res.socket.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    // These settings help with Vercel serverless environment
    transports: ['polling', 'websocket'], // Start with polling for reliability
    allowEIO3: true, // Allow Engine.IO 3 compatibility
    pingTimeout: 60000, // Longer ping timeout (60s)
    pingInterval: 25000, // More frequent pings
    maxHttpBufferSize: 1e6, // 1 MB max payload
    path: '/socket.io/', // Use default path
    connectTimeout: 45000 // Longer connect timeout
  });

  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send periodic pings to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("ping", { timestamp: Date.now() });
      }
    }, 25000);

    // Handle joining room
    socket.on("joinRoom", ({ user, roomId }) => {
      console.log(`${user?.name || "Unknown user"} joining room ${roomId}`);
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
      room.users.set(socket.id, {
        ...user,
        isCreator: room.users.size === 0,
        lastActive: Date.now()
      });
      
      // Broadcast updated user list
      io.to(roomId).emit("roomUsers", Array.from(room.users.values()));
      
      // Send previous messages
      socket.emit("previousMessages", room.messages);
    });

    // Handle chat messages
    socket.on("message", (message) => {
      // Get the room ID this socket is in
      const joinedRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      if (joinedRooms.length > 0) {
        const roomId = joinedRooms[0];
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId);
          room.messages.push(message);
          
          // Update user's last activity time
          if (room.users.has(socket.id)) {
            room.users.get(socket.id).lastActive = Date.now();
          }
          
          // Limit messages to 100
          if (room.messages.length > 100) {
            room.messages.shift();
          }
          
          // Broadcast to room
          io.to(roomId).emit("message", message);
        }
      }
    });

    // Handle heartbeat to keep connection alive
    socket.on("heartbeat", () => {
      socket.emit("heartbeat-response", { timestamp: Date.now() });

      // Update user's last active timestamp if in a room
      const joinedRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      if (joinedRooms.length > 0) {
        const roomId = joinedRooms[0];
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId);
          if (room.users.has(socket.id)) {
            room.users.get(socket.id).lastActive = Date.now();
          }
        }
      }
    });

    // Handle document sharing
    socket.on("shareDocument", (documentData) => {
      const joinedRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      if (joinedRooms.length > 0) {
        const roomId = joinedRooms[0];
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId);
          
          // Create a message for document sharing
          const docMessage = {
            ...documentData,
            type: 'document',
            text: `Shared document: ${documentData.document?.name || 'Unnamed document'}`
          };
          
          // Store and broadcast
          room.messages.push(docMessage);
          io.to(roomId).emit("message", docMessage);
        }
      }
    });
    
    // Handle ending a room
    socket.on("endRoom", ({ roomId }) => {
      if (rooms.has(roomId)) {
        io.to(roomId).emit("roomEnded");
        rooms.delete(roomId);
      }
    });

    // Handle leaving room
    socket.on("leaveRoom", ({ roomId }) => {
      handleUserLeaving(socket, roomId);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      clearInterval(pingInterval);
      
      // Find which room this socket was in
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          handleUserLeaving(socket, roomId);
          break;
        }
      }
    });
  });

  // Helper function to handle a user leaving a room
  function handleUserLeaving(socket, roomId) {
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    if (room.users.has(socket.id)) {
      // Remove user
      room.users.delete(socket.id);
      socket.leave(roomId);
      
      // Send updated user list
      const remainingUsers = Array.from(room.users.values());
      io.to(roomId).emit("roomUsers", remainingUsers);
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(roomId);
      }
    }
  }

  // Set up periodic cleanup of inactive users and empty rooms (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    
    for (const [roomId, room] of rooms.entries()) {
      // Check for inactive users
      for (const [socketId, userData] of room.users.entries()) {
        if (now - (userData.lastActive || 0) > inactiveThreshold) {
          console.log(`Removing inactive user ${socketId} from room ${roomId}`);
          room.users.delete(socketId);
          
          // Notify others
          const remainingUsers = Array.from(room.users.values());
          io.to(roomId).emit("roomUsers", remainingUsers);
        }
      }
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        console.log(`Removing empty room ${roomId}`);
        rooms.delete(roomId);
      }
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  // Clean up the interval when the server closes
  res.socket.server.on('close', () => {
    clearInterval(cleanupInterval);
  });

  // Store the Socket.IO instance
  res.socket.server.io = io;
  
  // End the response
  res.end();
}