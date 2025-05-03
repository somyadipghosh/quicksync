import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useUserContext } from './UserContext';

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const { user, room } = useUserContext();

  // Initialize socket connection
  useEffect(() => {
    // We only initiate the socket connection once
    if (!socket) {
      // In dev, use local URL, in production use relative path (works with Vercel)
      const socketUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3000';
      
      const socketInstance = io(socketUrl, {
        path: '/api/socket',
        autoConnect: false,
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
        console.log('Socket connected');
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket disconnected');
      });

      // Handle incoming messages
      socketInstance.on('message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      // Handle previous messages when joining a room
      socketInstance.on('previousMessages', (previousMessages) => {
        setMessages(previousMessages);
      });

      // Handle room users updates
      socketInstance.on('roomUsers', (users) => {
        setRoomUsers(users);
      });

      // Handle room ended by creator
      socketInstance.on('roomEnded', () => {
        alert('This room has been ended by the host.');
        window.location.href = '/rooms'; // Force navigate to rooms page
      });

      setSocket(socketInstance);
    }

    // Cleanup socket connection on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user) {
      if (room) {
        // Join room
        socket.connect();
        socket.emit('joinRoom', { user, roomId: room });
      } else if (isConnected) {
        // Leave room and disconnect when navigating away
        socket.emit('leaveRoom', { roomId: room });
        socket.disconnect();
      }
    }
  }, [socket, user, room]);

  const sendMessage = (text) => {
    if (socket && isConnected && user && room) {
      const messageData = {
        user: user.name,
        userId: user.id,
        text,
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('message', messageData);
    }
  };

  const shareDocument = (document) => {
    if (socket && isConnected && user && room) {
      const documentData = {
        user: user.name,
        userId: user.id,
        document,
        timestamp: new Date().toISOString(),
      };
      
      socket.emit('shareDocument', documentData);
    }
  };

  const endRoom = () => {
    if (socket && isConnected && room) {
      socket.emit('endRoom', { roomId: room });
    }
  };

  return (
    <SocketContext.Provider value={{ 
      isConnected, 
      messages, 
      roomUsers, 
      sendMessage,
      shareDocument,
      endRoom
    }}>
      {children}
    </SocketContext.Provider>
  );
};