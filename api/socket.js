// api/socket.js - Vercel serverless handler for Socket.IO
import { Server } from 'socket.io';

// In-memory storage (will reset on serverless cold starts)
const rooms = new Map();

let io;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log('Setting up Socket.IO server...');
    
    io = new Server(res.socket.server, {
      path: '/api/socket.js',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.VERCEL_URL, `https://${process.env.VERCEL_URL}`]
          : '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['polling', 'websocket']
    });

    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      socket.on('join_room', ({ roomId, username }) => {
        try {
          if (!roomId || !username) {
            socket.emit('error', { message: 'Room ID and username are required' });
            return;
          }

          socket.join(roomId);
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, { 
              users: [], 
              messages: [],
              createdAt: Date.now()
            });
          }

          const room = rooms.get(roomId);
          room.users = room.users.filter(u => u.id !== socket.id);
          
          const user = { 
            id: socket.id, 
            username: username.trim(),
            joinedAt: Date.now()
          };
          room.users.push(user);

          console.log(`User ${username} joined room ${roomId}`);

          socket.emit('message_history', room.messages);
          io.to(roomId).emit('user_joined', { 
            username: username.trim(), 
            users: room.users 
          });

        } catch (error) {
          console.error('Error in join_room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      socket.on('send_message', ({ roomId, message, username }) => {
        try {
          if (!roomId || !message || !username) {
            socket.emit('error', { message: 'Room ID, message, and username are required' });
            return;
          }

          if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          const room = rooms.get(roomId);
          const userInRoom = room.users.some(u => u.id === socket.id);
          if (!userInRoom) {
            socket.emit('error', { message: 'You are not in this room' });
            return;
          }

          const newMessage = { 
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            message: message.trim(), 
            username: username.trim(), 
            time: new Date(),
            socketId: socket.id
          };
          
          room.messages.push(newMessage);
          
          if (room.messages.length > 1000) {
            room.messages = room.messages.slice(-1000);
          }

          console.log(`Message from ${username} in room ${roomId}`);
          io.to(roomId).emit('receive_message', newMessage);

        } catch (error) {
          console.error('Error in send_message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('send_document', ({ roomId, file, username }) => {
        try {
          if (!roomId || !file || !username) {
            socket.emit('error', { message: 'Room ID, file, and username are required' });
            return;
          }

          if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          const room = rooms.get(roomId);
          const userInRoom = room.users.some(u => u.id === socket.id);
          if (!userInRoom) {
            socket.emit('error', { message: 'You are not in this room' });
            return;
          }

          const newFileMessage = { 
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            file, 
            username: username.trim(), 
            time: new Date(),
            type: 'file',
            socketId: socket.id
          };
          
          room.messages.push(newFileMessage);
          
          if (room.messages.length > 1000) {
            room.messages = room.messages.slice(-1000);
          }

          console.log(`File shared by ${username} in room ${roomId}`);
          io.to(roomId).emit('receive_message', newFileMessage);

        } catch (error) {
          console.error('Error in send_document:', error);
          socket.emit('error', { message: 'Failed to share document' });
        }
      });

      socket.on('typing', ({ roomId, username }) => {
        try {
          if (!roomId || !username) return;
          socket.to(roomId).emit('user_typing', { username: username.trim() });
        } catch (error) {
          console.error('Error in typing:', error);
        }
      });

      socket.on('stop_typing', ({ roomId, username }) => {
        try {
          if (!roomId || !username) return;
          socket.to(roomId).emit('user_stopped_typing', { username: username.trim() });
        } catch (error) {
          console.error('Error in stop_typing:', error);
        }
      });

      socket.on('disconnect', (reason) => {
        try {
          console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
          
          for (const [roomId, room] of rooms.entries()) {
            const initialUserCount = room.users.length;
            room.users = room.users.filter(u => u.id !== socket.id);
            
            if (room.users.length < initialUserCount) {
              socket.to(roomId).emit('user_left', { 
                username: 'User', 
                users: room.users 
              });
            }
          }
          
        } catch (error) {
          console.error('Error in disconnect:', error);
        }
      });
    });

    res.socket.server.io = io;
  }
  
  res.end();
}
