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
  
  // Refs for managing connection state
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = useRef(10);
  const heartbeatIntervalRef = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const lastHeartbeat = useRef(Date.now());

  // Initialize socket connection
  useEffect(() => {
    // Clean up function for intervals
    const cleanupIntervals = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    };

    // Create socket if it doesn't exist
    if (!socket) {
      console.log('Creating new Socket.IO connection');
      
      try {
        // Create socket with improved reliability config
        const socketInstance = io({
          // Default Socket.IO options - will use /socket.io path
          reconnectionAttempts: maxReconnectAttempts.current,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: true,
          forceNew: true,
          transports: ['polling', 'websocket']
        });
        
        // Connection event handlers
        socketInstance.on('connect', () => {
          console.log('Socket connected:', socketInstance.id);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
          lastHeartbeat.current = Date.now();
          
          // If we were previously in a room, rejoin it
          if (user && room) {
            console.log(`Reconnected, rejoining room ${room}`);
            socketInstance.emit('joinRoom', { user, roomId: room });
          }
        });

        socketInstance.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          setConnectionError(`Connection error: ${err.message}`);
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          
          // If the server disconnected us, try to reconnect manually
          if (reason === 'io server disconnect') {
            socketInstance.connect();
          }
        });

        // Handle server-side pings
        socketInstance.on('ping', () => {
          lastHeartbeat.current = Date.now();
          // Respond with a pong
          socketInstance.emit('pong', { timestamp: Date.now() });
        });
        
        socketInstance.on('heartbeat-response', () => {
          lastHeartbeat.current = Date.now();
        });

        // Handle incoming messages
        socketInstance.on('message', (message) => {
          setMessages(prev => [...prev, message]);
        });

        socketInstance.on('previousMessages', (previousMessages) => {
          console.log('Received previous messages:', previousMessages?.length || 0);
          setMessages(previousMessages || []);
        });

        socketInstance.on('roomUsers', (users) => {
          console.log('Room users updated:', users?.length || 0);
          setRoomUsers(users || []);
        });

        socketInstance.on('roomEnded', () => {
          alert('This room has been ended by the host.');
          window.location.href = '/rooms';
        });

        setSocket(socketInstance);
        
        // Start heartbeat interval to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (socketInstance.connected) {
            console.log('Sending heartbeat');
            socketInstance.emit('heartbeat');
            
            // Check if we've received a heartbeat recently
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.current;
            if (timeSinceLastHeartbeat > 60000) { // 1 minute
              console.log('No heartbeat received for too long, reconnecting...');
              socketInstance.disconnect().connect(); // Force reconnection
            }
          }
        }, 20000); // Send heartbeat every 20 seconds
        
        // Start connection health check interval
        reconnectIntervalRef.current = setInterval(() => {
          if (!socketInstance.connected && reconnectAttempts.current < maxReconnectAttempts.current) {
            console.log(`Connection health check - reconnecting (attempt ${reconnectAttempts.current + 1})`);
            reconnectAttempts.current++;
            socketInstance.connect();
          }
        }, 10000); // Check every 10 seconds
        
        // Clean up on unmount
        return () => {
          cleanupIntervals();
          socketInstance.disconnect();
        };
      } catch (error) {
        console.error('Error initializing socket:', error);
        setConnectionError(`Initialization error: ${error.message}`);
        return () => cleanupIntervals();
      }
    }
    
    return () => cleanupIntervals();
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user && room) {
      console.log(`Joining room ${room} as ${user.name}`);
      
      // Ensure connection before joining
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
  
  // Reconnect whenever the socket connection is lost
  useEffect(() => {
    if (socket && !isConnected && user && room) {
      const reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        if (!socket.connected && reconnectAttempts.current < maxReconnectAttempts.current) {
          socket.connect();
        }
      }, 2000);
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [socket, isConnected, user, room]);

  // Message sending function with retry
  const sendMessage = (text) => {
    if (socket && user && room) {
      const messageData = {
        user: user.name,
        userId: user.id,
        text,
        timestamp: new Date().toISOString(),
      };
      
      // Ensure connection before sending
      if (!socket.connected) {
        socket.connect();
        // Give it a moment to connect
        setTimeout(() => socket.emit('message', messageData), 500);
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
      
      // Ensure connection before sending
      if (!socket.connected) {
        socket.connect();
        setTimeout(() => socket.emit('shareDocument', documentData), 500);
      } else {
        socket.emit('shareDocument', documentData);
      }
    }
  };

  // Room ending function
  const endRoom = () => {
    if (socket && room) {
      // Ensure connection before sending
      if (!socket.connected) {
        socket.connect();
        setTimeout(() => socket.emit('endRoom', { roomId: room }), 500);
      } else {
        socket.emit('endRoom', { roomId: room });
      }
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