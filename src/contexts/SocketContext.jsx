import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useUserContext } from './UserContext';

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const { user, room } = useUserContext();

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      // Create socket instance with minimal configuration
      const newSocket = io({
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5
      });

      // Set up event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setConnectionError(null);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setConnectionError(`Connection error: ${err.message}`);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('previousMessages', (previousMessages) => {
        console.log('Received previous messages:', previousMessages?.length || 0);
        setMessages(previousMessages || []);
      });

      newSocket.on('roomUsers', (users) => {
        console.log('Room users updated:', users?.length || 0);
        setRoomUsers(users || []);
      });

      newSocket.on('roomEnded', () => {
        alert('This room has been ended by the host.');
        window.location.href = '/rooms';
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        newSocket.disconnect();
      };
    }
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && isConnected && user && room) {
      console.log(`Joining room ${room} as ${user.name}`);
      socket.emit('joinRoom', { user, roomId: room });

      return () => {
        if (socket.connected && room) {
          console.log(`Leaving room ${room}`);
          socket.emit('leaveRoom', { roomId: room });
        }
      };
    }
  }, [socket, isConnected, user, room]);

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
      connectionError,
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