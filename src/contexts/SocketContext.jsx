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

  useEffect(() => {
    // For demo purposes using a mock server (would need an actual backend in production)
    const socketInstance = io('https://mock-socket-server.example', {
      autoConnect: false,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socketInstance.on('roomUsers', (users) => {
      setRoomUsers(users);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && user && room) {
      // For demo, we simulate connection
      setIsConnected(true);
      
      // In a real app, you'd connect and join the room
      /*
      socket.connect();
      socket.emit('joinRoom', { user, roomId: room });
      */
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
      
      // In a real app with a server:
      // socket.emit('message', messageData);
      
      // For demo, we'll just update the state directly
      setMessages(prev => [...prev, messageData]);
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
      
      // In a real app:
      // socket.emit('shareDocument', documentData);
      
      // For demo:
      setMessages(prev => [...prev, {
        ...documentData,
        type: 'document',
        text: `Shared document: ${document.name}`,
      }]);
    }
  };

  return (
    <SocketContext.Provider value={{ 
      isConnected, 
      messages, 
      roomUsers, 
      sendMessage,
      shareDocument
    }}>
      {children}
    </SocketContext.Provider>
  );
};