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
  const lastPingTime = useRef(Date.now());

  // Initialize socket connection
  useEffect(() => {
    // We only initiate the socket connection once
    if (!socket) {
      console.log('Initializing socket connection...');
      
      try {
        // Create a socket instance with correct configuration
        const socketInstance = io({
          path: '/api/socket-handler',
          autoConnect: true,
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 60000,
          forceNew: true
        });

        console.log('Socket instance created with path: /api/socket-handler');
        
        // Debug connection events
        socketInstance.on('connect', () => {
          console.log('Socket connected successfully with ID:', socketInstance.id);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
          lastPingTime.current = Date.now();
        });

        socketInstance.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message, 'Attempt:', reconnectAttempts.current);
          setConnectionError(`${err.message}`);
          reconnectAttempts.current += 1;
          
          // Always use polling if we have multiple failures
          if (reconnectAttempts.current > 3) {
            console.log('Multiple reconnection failures, switching to polling only...');
            socketInstance.io.opts.transports = ['polling'];
          }
        });

        // Handle pong responses to track connection health
        socketInstance.io.engine.on('pong', () => {
          lastPingTime.current = Date.now();
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          
          if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect manually
            console.log('Server disconnected us, attempting to reconnect...');
            setTimeout(() => socketInstance.connect(), 3000);
          }
          
          if (reason === 'ping timeout' || reason === 'transport close' || reason === 'transport error') {
            // Connection issues, try to reconnect with polling only
            console.log('Connection timeout/transport issue, switching to polling...');
            socketInstance.io.opts.transports = ['polling'];
            setTimeout(() => socketInstance.connect(), 2000);
          }
        });

        // Handle incoming messages
        socketInstance.on('message', (message) => {
          setMessages(prev => [...prev, message]);
        });

        // Handle previous messages when joining a room
        socketInstance.on('previousMessages', (previousMessages) => {
          console.log('Received previous messages:', previousMessages?.length);
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
        
        // Set up a more aggressive ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (socketInstance && socketInstance.connected) {
            console.log('Sending ping to keep connection alive');
            
            // Ping the server via our own endpoint (always works even when socket is struggling)
            fetch(`${window.location.origin}/api/ping`)
              .then(res => res.json())
              .catch(() => {}); // Ignore errors
              
            // Check if the connection seems stale (no pong in 30 seconds)
            const timeSinceLastPong = Date.now() - lastPingTime.current;
            if (timeSinceLastPong > 30000 && isConnected) {
              console.log('Connection may be stale, attempting reconnection...');
              socketInstance.disconnect().connect(); // Force reconnection cycle
            }
          }
        }, 15000); // Every 15 seconds
        
        return () => {
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
          
          if (socketInstance) {
            console.log('Cleaning up socket connection');
            socketInstance.disconnect();
          }
        };
      } catch (error) {
        console.error('Error initializing socket:', error);
      }
    }
  }, []);

  // Join/leave room when user or room changes
  useEffect(() => {
    if (socket && user && room) {
      console.log(`Attempting to join room ${room} as ${user.name}`);
      
      // Ensure connection and join room with retries
      const joinWithRetry = (retries = 0) => {
        if (socket.connected) {
          socket.emit('joinRoom', { user, roomId: room });
          console.log('Emitted joinRoom event');
        } else if (retries < 5) {
          console.log(`Socket not connected, retrying join... (${retries + 1}/5)`);
          socket.connect();
          setTimeout(() => joinWithRetry(retries + 1), 2000);
        }
      };
      
      joinWithRetry();
      
      // Set up reconnect handler
      const handleReconnect = () => {
        console.log('Reconnected, rejoining room...');
        socket.emit('joinRoom', { user, roomId: room });
      };
      
      socket.on('reconnect', handleReconnect);
      
      // Cleanup when leaving room
      return () => {
        socket.off('reconnect', handleReconnect);
        
        if (socket.connected && room) {
          console.log(`Leaving room ${room}`);
          socket.emit('leaveRoom', { roomId: room });
        }
      };
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