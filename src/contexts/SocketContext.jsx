import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useUserContext } from './UserContext';
import swMessenger from '../utils/serviceWorkerMessenger';

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const { user, room } = useUserContext();
  const pingIntervalRef = useRef(null);
  const swRegistered = useRef(false);
  const heartbeatIntervalRef = useRef(null);

  // Initialize Service Worker connection
  useEffect(() => {
    if (swRegistered.current) {
      return; // Service worker already registered
    }
    
    console.log('Registering Service Worker');
    
    const initServiceWorker = async () => {
      try {
        await swMessenger.register();
        swRegistered.current = true;
        setIsConnected(true);
        setConnectionError(null);
        
        console.log('Service Worker registered successfully');
        
        // Set up heartbeat to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          swMessenger.sendMessage('ping')
            .catch(err => {
              console.error('Heartbeat failed:', err);
              // If ping fails, we may need to re-register the SW
              handleReconnect();
            });
        }, 30000); // Ping every 30 seconds

        // If we had a room and registered successfully, join it
        if (user && room) {
          console.log(`Registered, joining room ${room}`);
          swMessenger.sendMessage('joinRoom', { user, roomId: room }, room);
        }
        
        // Set up message handlers
        setupMessageHandlers();
        
      } catch (error) {
        console.error('Error registering service worker:', error);
        setConnectionError(`Failed to register service worker: ${error.message}`);
        setIsConnected(false);
        
        // Try to reconnect
        handleReconnect();
      }
    };

    initServiceWorker();
    
    return () => {
      // Clean up on unmount
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      // We don't disconnect the service worker since it should stay alive for other tabs
      // But we do need to leave any rooms we're in
      if (swRegistered.current && room) {
        swMessenger.sendMessage('leaveRoom', {}, room);
      }
    };
  }, []);
  // Helper function to handle reconnection
  const reconnectAttempts = useRef(0);
  const handleReconnect = () => {
    const reconnectDelay = 2000; // 2 seconds
    
    console.log(`Attempting to reconnect in ${reconnectDelay / 1000} seconds...`);
    reconnectAttempts.current += 1;
    
    setTimeout(async () => {
      try {
        // Re-register service worker
        await swMessenger.register();
        swRegistered.current = true;
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        console.log('Service Worker reconnected successfully');
        
        // If we had a room, rejoin it
        if (user && room) {
          swMessenger.sendMessage('joinRoom', { user, roomId: room }, room);
        }
        
      } catch (error) {
        console.error('Service worker reconnection failed:', error);
        setConnectionError(`Failed to reconnect: ${error.message}`);
        setIsConnected(false);
        
        // Try again with increasing delay up to 5 attempts
        if (reconnectAttempts.current < 5) {
          handleReconnect();
        }
      }
    }, reconnectDelay);
  };
  // Set up message handlers for the service worker
  const setupMessageHandlers = () => {    // Handle incoming messages
    swMessenger.on('message', (message) => {
      console.log('Received new message to display:', message);
      setMessages(prevMessages => {
        console.log('Current messages count:', prevMessages.length);
        return [...prevMessages, message];
      });
    });

    // Handle previous messages when joining a room
    swMessenger.on('previousMessages', (previousMessages) => {
      console.log('Received previous messages:', previousMessages?.length || 0);
      if (previousMessages && previousMessages.length > 0) {
        setMessages(previousMessages);
      }
    });

    // Handle room users updates
    swMessenger.on('roomUsers', (users) => {
      console.log('Room users updated:', users?.length || 0);
      setRoomUsers(users || []);
    });

    // Handle room ended notification
    swMessenger.on('roomEnded', () => {
      alert('This room has been ended by the host.');
      window.location.href = '/rooms';
    });
    
    // Handle pong response (for heartbeat)
    swMessenger.on('pong', () => {
      // Connection is working
      if (!isConnected) {
        setIsConnected(true);
        setConnectionError(null);
      }
    });
    
    // Handle document shared event
    swMessenger.on('documentShared', (documentData) => {
      // Handle shared document (implementation depends on your app's needs)
      console.log('Document shared:', documentData);
    });
  };
  // Join/leave room when user or room changes
  useEffect(() => {
    if (swRegistered.current && user && room) {
      console.log(`Joining room ${room} as ${user?.name || 'unknown'}`);
      // Ensure we have a valid user object with id and name
      if (!user.id || !user.name) {
        console.error('Invalid user object when joining room:', user);
        return;
      }
      
      // Give the service worker a moment to be fully active
      setTimeout(() => {
        swMessenger.sendMessage('joinRoom', { user, roomId: room }, room)
          .catch(err => {
            console.error('Error joining room:', err);
            // Try once more after a slight delay
            setTimeout(() => {
              swMessenger.sendMessage('joinRoom', { user, roomId: room }, room);
            }, 500);
          });
      }, 100);
      
      // Clean up when leaving room or unmounting
      return () => {
        if (swRegistered.current && room) {
          console.log(`Leaving room ${room}`);
          swMessenger.sendMessage('leaveRoom', {}, room);
        }
      };
    }
  }, [user, room]);
  // Message sending function
  const sendMessage = (text) => {
    if (swRegistered.current && user && room) {
      const messageData = {
        user: user.name,
        userId: user.id,
        text,
        timestamp: new Date().toISOString(),
      };
      
      console.log('Sending message:', messageData);
      
      swMessenger.sendMessage('message', messageData, room)
        .then(() => {
          console.log('Message sent successfully');
        })
        .catch(error => {
          console.error('Error sending message:', error);
          // Optionally handle the error by displaying a notification to the user
          setConnectionError('Failed to send message. Please try again.');
          
          // Try to reconnect
          if (!isConnected) {
            handleReconnect();
          }
        });
    } else {
      console.error('Cannot send message: Not connected, missing user, or missing room');
      if (!swRegistered.current) console.error('Service worker not registered');
      if (!user) console.error('User not defined');
      if (!room) console.error('Room not defined');
    }
  };

  // Document sharing function
  const shareDocument = (document) => {
    if (swRegistered.current && user && room) {
      const documentData = {
        user: user.name,
        userId: user.id,
        document,
        timestamp: new Date().toISOString(),
      };
      
      swMessenger.sendMessage('shareDocument', documentData, room);
    }
  };
  // Room ending function
  const endRoom = () => {
    if (swRegistered.current && room) {
      swMessenger.sendMessage('endRoom', { roomId: room }, room);
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