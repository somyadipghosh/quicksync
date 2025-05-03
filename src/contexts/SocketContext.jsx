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
    // We only initiate the socket connection once
    if (!socket) {
      // In dev, use explicit localhost:3000 (port where socket server runs), in production use relative path
      const socketUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3000';
      
      console.log(`Connecting to Socket.IO server at ${socketUrl}`);
      
      // Create socket instance but don't connect yet
      const socketInstance = io(socketUrl, {
        path: '/api/socket',
        autoConnect: false,
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000 // Increase timeout
      });

      // Debug connection issues
      socketInstance.on('connect', () => {
        console.log('Socket connected successfully with ID:', socketInstance.id);
        setIsConnected(true);
        setConnectionError(null);
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setConnectionError(`${err.message}`);
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        // Set error if it was an error disconnect
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          setConnectionError(`Disconnected: ${reason}`);
        }
      });

      // Handle incoming messages
      socketInstance.on('message', (message) => {
        console.log('Received message:', message);
        setMessages(prev => [...prev, message]);
      });

      // Handle previous messages when joining a room
      socketInstance.on('previousMessages', (previousMessages) => {
        console.log('Received previous messages:', previousMessages.length);
        setMessages(previousMessages || []);
      });

      // Handle room users updates
      socketInstance.on('roomUsers', (users) => {
        console.log('Room users updated:', users);
        setRoomUsers(users || []);
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
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user && room) {
      console.log(`Attempting to join room ${room} as ${user.name} (${user.id})`);
      
      // Connect socket if not connected
      if (!socket.connected) {
        socket.connect();
      }
      
      // Function to join room
      const joinTheRoom = () => {
        socket.emit('joinRoom', { user, roomId: room });
        console.log('Emitted joinRoom event');
      };
      
      // If already connected, join immediately
      if (socket.connected) {
        joinTheRoom();
      } else {
        // Otherwise wait for connection
        const onConnectHandler = () => {
          joinTheRoom();
          // Remove this handler after it runs once
          socket.off('connect', onConnectHandler);
        };
        socket.on('connect', onConnectHandler);
      }
    }
    
    // Cleanup when leaving room
    return () => {
      if (socket && socket.connected && room) {
        console.log(`Leaving room ${room}`);
        socket.emit('leaveRoom', { roomId: room });
      }
    };
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