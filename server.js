// server.js
// Express + Socket.IO backend for real-time chat


import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Simple in-memory room storage
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], messages: [] };
    }
    rooms[roomId].users.push({ id: socket.id, username });
    // Send message history to the new user
    socket.emit('message_history', rooms[roomId].messages);
    io.to(roomId).emit('user_joined', { username, users: rooms[roomId].users });
  });

  socket.on('send_message', ({ roomId, message, username }) => {
    const newMessage = { message, username, time: new Date() };
    if (rooms[roomId]) {
      rooms[roomId].messages.push(newMessage);
    }
    io.to(roomId).emit('receive_message', newMessage);
  });

  socket.on('send_document', ({ roomId, file, username }) => {
    const newFileMessage = { file, username, time: new Date() };
    if (rooms[roomId]) {
      rooms[roomId].messages.push(newFileMessage);
    }
    io.to(roomId).emit('receive_message', newFileMessage);
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('user_typing', { username });
  });

  socket.on('stop_typing', ({ roomId, username }) => {
    socket.to(roomId).emit('user_stopped_typing', { username });
  });

  socket.on('leave_room', ({ roomId, username }) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
      io.to(roomId).emit('user_left', { username, users: rooms[roomId].users });
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
        io.to(roomId).emit('user_left', { username: user.username, users: rooms[roomId].users });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Real-time chat backend is running.');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
