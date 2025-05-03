import { Server } from "socket.io";

// In-memory data store
const rooms = new Map();

// Simple serverless Socket.IO handler
export default function SocketHandler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if Socket.IO is already initialized
  if (res.socket.server.io) {
    console.log("Socket.IO already running");
    res.end();
    return;
  }

  console.log("Initializing Socket.IO server");
  
  // Simplified Socket.IO server configuration
  const io = new Server(res.socket.server, {
    path: "/socket.io/",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["*"]
    },
    // Use polling only to avoid WebSocket issues in serverless
    transports: ['polling'],
  });

  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

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
    
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      
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

  // Store the Socket.IO instance on the server
  res.socket.server.io = io;
  
  // End response
  res.end();
}