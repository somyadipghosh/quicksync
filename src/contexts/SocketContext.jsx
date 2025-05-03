import { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const reconnectAttempts = useRef(0);
  const pingIntervalRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      console.log('Creating new socket connection...');
      
      try {
        // Use a simple configuration that works in both development and production
        const socketInstance = io(window.location.origin, {
          path: '/api/socket-handler',
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000
        });
        
        socketInstance.on('connect', () => {
          console.log('Socket connected with ID:', socketInstance.id);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
        });

        socketInstance.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          setConnectionError(`Connection error: ${err.message}`);
          reconnectAttempts.current += 1;
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        });

        // Handle incoming messages
        socketInstance.on('message', (message) => {
          setMessages(prev => [...prev, message]);
        });

        // Handle previous messages when joining a room
        socketInstance.on('previousMessages', (previousMessages) => {
          console.log('Received previous messages:', previousMessages?.length || 0);
          setMessages(previousMessages || []);
        });

        // Handle room users updates
        socketInstance.on('roomUsers', (users) => {
          console.log('Room users updated:', users?.length || 0);
          setRoomUsers(users || []);
        });

        // Handle room ended by creator
        socketInstance.on('roomEnded', () => {
          alert('This room has been ended by the host.');
          window.location.href = '/rooms';
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('Error initializing socket:', error);
        setConnectionError(`Initialization error: ${error.message}`);
      }
      
      return () => {
        if (socket) {
          console.log('Cleaning up socket connection');
          socket.disconnect();
        }
      };
    }
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user && room) {
      console.log(`Joining room ${room} as ${user.name}`);
      
      // Join the room
      socket.emit('joinRoom', { user, roomId: room });
      
      // Clean up when leaving room
      return () => {
        if (socket.connected && room) {
          console.log(`Leaving room ${room}`);
          socket.emit('leaveRoom', { roomId: room });
        }
      };
    }
  }, [socket, user, room]);

  // Message sending function
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

  // Document sharing function
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

  // Room ending function
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