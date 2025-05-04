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
  const reconnectTimerRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (socketRef.current) {
      return; // Socket already exists
    }
    
    console.log('Creating new Socket.IO connection');
    
    try {
      // Create socket with configuration matching server settings
      const socketInstance = io({
        path: "/socket.io/",
        transports: ['polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: false, // We'll connect manually
      });
      
      socketRef.current = socketInstance;
      setSocket(socketInstance);
      
      socketInstance.on('connect', () => {
        console.log('Socket connected successfully:', socketInstance.id);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // If we had a room and were previously disconnected, rejoin it
        if (user && room) {
          console.log(`Connected, joining room ${room}`);
          socketInstance.emit('joinRoom', { user, roomId: room });
        }
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setConnectionError(`Connection error: ${err.message}`);
        setIsConnected(false);
        
        // Handle reconnection
        handleReconnect();
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'transport close') {
          // Server disconnected us, so we need to reconnect manually
          handleReconnect();
        }
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

      // Connect the socket
      socketInstance.connect();
      
    } catch (error) {
      console.error('Error initializing socket:', error);
      setConnectionError(`Failed to initialize socket: ${error.message}`);
    }
    
    return () => {
      // Clean up on unmount
      if (socketRef.current) {
        console.log('Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Helper function to handle reconnection
  const handleReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    
    reconnectAttempts.current += 1;
    
    if (reconnectAttempts.current <= 5) {
      console.log(`Attempting reconnection #${reconnectAttempts.current} in 2 seconds...`);
      
      reconnectTimerRef.current = setTimeout(() => {
        if (socketRef.current) {
          console.log('Reconnecting...');
          socketRef.current.connect();
        }
      }, 2000);
    } else {
      console.log('Maximum reconnection attempts reached. Creating a new socket...');
      
      // Reset for a fresh connection
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
        setSocket(null);
      }
      
      // Reset reconnect counter after a longer delay
      reconnectTimerRef.current = setTimeout(() => {
        reconnectAttempts.current = 0;
        
        // Create a new socket instance
        const newSocket = io({
          path: "/socket.io/",
          transports: ['polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          autoConnect: true,
        });
        
        socketRef.current = newSocket;
        setSocket(newSocket);
        
        // Set up all event listeners again
        setupSocketListeners(newSocket);
      }, 5000);
    }
  };

  // Helper to set up event listeners for a new socket
  const setupSocketListeners = (socketInstance) => {
    socketInstance.on('connect', () => {
      console.log('Socket connected successfully:', socketInstance.id);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
      // If we had a room, join it
      if (user && room) {
        socketInstance.emit('joinRoom', { user, roomId: room });
      }
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnectionError(`Connection error: ${err.message}`);
      setIsConnected(false);
      handleReconnect();
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect' || reason === 'transport close') {
        handleReconnect();
      }
    });
    
    socketInstance.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    socketInstance.on('previousMessages', (previousMessages) => {
      setMessages(previousMessages || []);
    });
    
    socketInstance.on('roomUsers', (users) => {
      setRoomUsers(users || []);
    });
    
    socketInstance.on('roomEnded', () => {
      alert('This room has been ended by the host.');
      window.location.href = '/rooms';
    });
  };

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user && room) {
      console.log(`Joining room ${room} as ${user.name}`);
      
      // Ensure we're connected before joining
      if (!socket.connected) {
        socket.connect();
      }
      
      socket.emit('joinRoom', { user, roomId: room });
      
      // Clean up when leaving room or unmounting
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
    if (socket && user && room) {
      const messageData = {
        user: user.name,
        userId: user.id,
        text,
        timestamp: new Date().toISOString(),
      };
      
      // Make sure we're connected before sending
      if (!socket.connected) {
        socket.connect();
        
        // Wait for connection and then send
        socket.once('connect', () => {
          socket.emit('message', messageData);
        });
      } else {
        socket.emit('message', messageData);
      }
    }
  };

  // Document sharing function
  const shareDocument = (document) => {
    if (socket && user && room) {
      const documentData = {
        user: user.name,
        userId: user.id,
        document,
        timestamp: new Date().toISOString(),
      };
      
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          socket.emit('shareDocument', documentData);
        });
      } else {
        socket.emit('shareDocument', documentData);
      }
    }
  };

  // Room ending function
  const endRoom = () => {
    if (socket && room) {
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