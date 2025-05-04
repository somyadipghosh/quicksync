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
  const pingIntervalRef = useRef(null);
  const connectionMonitorRef = useRef(null);

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
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 45000, // Increased to match server
        autoConnect: false, // We'll connect manually
        withCredentials: false,
        // Additional settings to match server-side
        extraHeaders: {
          "Accept": "application/json", 
          "Content-Type": "application/json",
        },
        // Increase ping/pong timeouts to match server
        pingTimeout: 60000,
        pingInterval: 25000,
      });
      
      socketRef.current = socketInstance;
      setSocket(socketInstance);
      
      socketInstance.on('connect', () => {
        console.log('Socket connected successfully:', socketInstance.id);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Start a client-side ping to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = setInterval(() => {
          if (socketInstance.connected) {
            socketInstance.emit('ping');
            // Monitor for pong response
            const pongTimeout = setTimeout(() => {
              console.log('No pong received, connection may be unstable');
            }, 5000);
            
            socketInstance.once('pong', () => {
              clearTimeout(pongTimeout);
            });
          }
        }, 20000); // Ping every 20 seconds
        
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
        
        // Clear ping interval on disconnect
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
          // Server disconnected us or transport issue, so we need to reconnect manually
          handleReconnect();
        }
      });

      // Handle specific xhr-poll error which caused the disconnection in the screenshot
      socketInstance.io.engine.on('packet', (packet) => {
        // Monitor for error packets
        if (packet.type === 'error') {
          console.log('Error packet received:', packet.data);
        }
      });

      // Monitor for polling transport errors specifically
      socketInstance.io.engine.transport.on('error', (err) => {
        console.error('Transport error:', err);
        // Don't disconnect immediately, try to recover
        if (socketInstance.io.engine.transport.name === 'polling') {
          console.log('Polling transport error - attempting to recover');
          
          // Don't call disconnect here, the transport will try to recover
          // Just prepare for potential disconnect event
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
      
      // Set up a connection monitor to detect silent failures
      connectionMonitorRef.current = setInterval(() => {
        if (socketInstance.connected) {
          // Connection is still active according to the client, validate
          const lastActivityTime = socketInstance.io.engine.transport.pollXhr ? 
            socketInstance.io.engine.transport.pollXhr.responseText.length : 0;
          
          if (lastActivityTime === 0 && reconnectAttempts.current === 0) {
            console.log('Potential zombie connection detected - forcing reconnect');
            socketInstance.disconnect();
            setTimeout(() => {
              socketInstance.connect();
            }, 100);
          }
        }
      }, 30000);
      
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
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (connectionMonitorRef.current) {
        clearInterval(connectionMonitorRef.current);
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
          // Force close and recreate transport
          if (socketRef.current.io && socketRef.current.io.engine) {
            socketRef.current.io.engine.close();
          }
          // Reconnect
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
        
        // Create a new socket instance with updated options
        const newSocket = io({
          path: "/socket.io/",
          transports: ['polling'],
          reconnection: true, 
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 45000,
          autoConnect: true,
          withCredentials: false,
          extraHeaders: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          pingTimeout: 60000,
          pingInterval: 25000,
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
      
      // Start a client-side ping to keep connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      pingIntervalRef.current = setInterval(() => {
        if (socketInstance.connected) {
          socketInstance.emit('ping');
        }
      }, 20000); // Ping every 20 seconds
      
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
      
      // Clear ping interval on disconnect
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
        handleReconnect();
      }
    });
    
    // Monitor for polling transport errors
    socketInstance.io.engine.transport.on('error', (err) => {
      console.error('Transport error:', err);
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
    
    // Listen for pong responses
    socketInstance.on('pong', () => {
      // Connection is still alive
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