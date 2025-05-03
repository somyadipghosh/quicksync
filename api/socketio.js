import { Server as ServerIO } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// This is a custom server file for Vercel
// It integrates Socket.IO with Next.js in a way that works in serverless environments

// Keeping the same rooms structure
const rooms = new Map();

export default function ioHandler(req, res) {
  if (!res.socket.server.io) {
    console.log('*First use, starting socket.io');

    const httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
      if (pathname === '/api/socket') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
        });
        res.end('Socket server is running');
      }
    });

    // Set up Socket.IO server with configurations for Vercel
    const io = new ServerIO(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      transports: ['polling', 'websocket'],
      cors: {
        origin: '*',
      },
    });

    // Same Socket.IO event handlers as in socket.js
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
      
      socket.on('joinRoom', ({ user, roomId }) => {
        console.log(`${user.name} joining room ${roomId}`);
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            users: new Map(),
            messages: [],
          });
        }
        
        const room = rooms.get(roomId);
        const userData = {
          ...user, 
          isCreator: room.users.size === 0
        };
        room.users.set(socket.id, userData);
        
        const usersArray = Array.from(room.users.values());
        io.to(roomId).emit('roomUsers', usersArray);
        
        socket.emit('previousMessages', room.messages);
      });
      
      // ...all the other event handlers from socket.js...
      socket.on('leaveRoom', ({ roomId }) => {
        handleUserLeaving(socket, roomId);
      });
      
      socket.on('message', (message) => {
        const roomId = Array.from(socket.rooms)[1];
        if (roomId && rooms.has(roomId)) {
          const room = rooms.get(roomId);
          room.messages.push(message);
          
          if (room.messages.length > 100) {
            room.messages.shift();
          }
          
          io.to(roomId).emit('message', message);
        }
      });
      
      socket.on('shareDocument', (documentData) => {
        const roomId = Array.from(socket.rooms)[1];
        if (roomId && rooms.has(roomId)) {
          const docMessage = {
            ...documentData,
            type: 'document',
            text: `Shared document: ${documentData.document.name}`,
          };
          
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
          room.users.delete(socket.id);
          socket.leave(roomId);
          
          const remainingUsers = Array.from(room.users.values());
          io.to(roomId).emit('roomUsers', remainingUsers);
          
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      }
    }

    // Save the Socket.IO instance
    res.socket.server.io = io;
  }

  res.end();
}