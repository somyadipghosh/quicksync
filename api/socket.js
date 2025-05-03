// Import Socket.IO server
import { Server } from "socket.io";

// In-memory data store (note: this will reset when the serverless function is redeployed)
const rooms = new Map();

export default function SocketHandler(req, res) {
  // Check if Socket.IO server is already running
  if (res.socket.server.io) {
    console.log("Socket.IO already running");
    res.end();
    return;
  }

  // Set up Socket.IO server with minimal configuration
  console.log("Setting up Socket.IO server");
  const io = new Server(res.socket.server);

  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

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
        isCreator: room.users.size === 0
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
          
          // Limit messages to 100
          if (room.messages.length > 100) {
            room.messages.shift();
          }
          
          // Broadcast to room
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

  // Store the Socket.IO instance
  res.socket.server.io = io;
  
  // End the response
  res.end();
}