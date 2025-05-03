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

  // Initialize socket connection
  useEffect(() => {
    // Only create socket if it doesn't exist
    if (!socket) {
      console.log('Creating new Socket.IO connection');
      
      try {
        // Create socket with simplified polling-only config
        const socketInstance = io({
          // Use polling only to match server config and avoid websocket errors
          transports: ['polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000
        });
        
        socketInstance.on('connect', () => {
          console.log('Socket connected successfully:', socketInstance.id);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
          
          // If we had a room and were previously disconnected, rejoin it
          if (user && room) {
            console.log(`Reconnected, rejoining room ${room}`);
            socketInstance.emit('joinRoom', { user, roomId: room });
          }
        });

        socketInstance.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          setConnectionError(`Connection error: ${err.message}`);
          
          // Increment reconnect attempts
          reconnectAttempts.current += 1;
          
          // After too many failures, try a full reconnection
          if (reconnectAttempts.current > 5) {
            console.log('Multiple reconnection failures, trying fresh connection');
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            
            reconnectTimerRef.current = setTimeout(() => {
              socketInstance.disconnect();
              socketInstance.connect();
            }, 2000);
          }
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          
          // Try to reconnect manually if server closed the connection
          if (reason === 'io server disconnect') {
            socketInstance.connect();
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

        setSocket(socketInstance);
      } catch (error) {
        console.error('Error initializing socket:', error);
        setConnectionError(`Failed to initialize socket: ${error.message}`);
      }
    }
    
    return () => {
      // Clean up on unmount
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

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
        
        // Give it a moment to connect
        setTimeout(() => {
          socket.emit('message', messageData);
        }, 500);
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
      
      socket.emit('shareDocument', documentData);
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