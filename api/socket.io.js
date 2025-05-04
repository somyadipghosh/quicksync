import { Server } from "socket.io";

// In-memory data store (Note: this will be reset on server restarts with serverless)
const rooms = new Map();

export default function handler(req, res) {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
    return;
  }
  
  // Socket.io server already initialized
  if (res.socket.server.io) {
    console.log("Socket.IO instance already running");
    res.end();
    return;
  }
  
  console.log("Initializing Socket.IO server on Vercel with WebSockets");
  
  // Create a Socket.IO server instance
  const io = new Server(res.socket.server, {
    path: "/api/socket.io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true
    },
    // Use WebSocket transport with polling as fallback
    transports: ['websocket', 'polling'],
    // Don't destroy long-polling session after upgrade to WebSocket
    allowUpgrades: true,
    // Prevent proxy issues (important for Vercel)
    pingTimeout: 30000,
    pingInterval: 20000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e7, // 10MB for file sharing
  });

  // Track connection count
  let connectionCount = 0;

  // Connection handler
  io.on("connection", (socket) => {
    connectionCount++;
    const transport = socket.conn.transport.name; // websocket or polling
    console.log(`Client connected: ${socket.id} (Total: ${connectionCount}) (Transport: ${transport})`);
    
    // Handle joining room
    socket.on("joinRoom", ({ user, roomId }) => {
      console.log(`${user?.name || "Unknown user"} joining room ${roomId}`);
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          messages: []
        });
      }
      
      const room = rooms.get(roomId);
      room.users.set(socket.id, {
        ...user,
        isCreator: room.users.size === 0,
        lastActive: Date.now()
      });
      
      io.to(roomId).emit("roomUsers", Array.from(room.users.values()));
      socket.emit("previousMessages", room.messages);
    });

    // Handle chat messages
    socket.on("message", (message) => {
      const joinedRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      if (joinedRooms.length > 0) {
        const roomId = joinedRooms[0];
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId);
          room.messages.push(message);
          
          if (room.messages.length > 100) {
            room.messages.shift();
          }
          
          io.to(roomId).emit("message", message);
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
          
          const docMessage = {
            ...documentData,
            type: 'document',
            text: `Shared document: ${documentData.document?.name || 'Unnamed document'}`
          };
          
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
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          socket.leave(roomId);
          
          const remainingUsers = Array.from(room.users.values());
          io.to(roomId).emit("roomUsers", remainingUsers);
          
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      }
    });
    
    // Client custom ping to keep connection alive
    socket.on("ping", () => {
      socket.emit("pong");
    });
    
    // Handle disconnection
    socket.on("disconnect", (reason) => {
      connectionCount--;
      console.log(`Client disconnected: ${socket.id} (Reason: ${reason}) (Remaining: ${connectionCount})`);
      
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          
          const remainingUsers = Array.from(room.users.values());
          io.to(roomId).emit("roomUsers", remainingUsers);
          
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
          
          break;
        }
      }
    });
  });

  res.socket.server.io = io;
  res.status(200).end();
}