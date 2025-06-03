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
    swMessenger.on('message', (messageData) => {
      console.log('Received new message to display:', messageData);
      // Check if the message is nested in a data property as the service worker wraps it
      const message = messageData.data || messageData;
      
      // Add directly to local UI state
      setMessages(prevMessages => {
        console.log('Current messages count:', prevMessages.length);
        console.log('Adding message with content:', message.text);
        return [...prevMessages, message];
      });
    });    // Handle previous messages when joining a room
    swMessenger.on('previousMessages', (messageData) => {
      // The data might be nested inside a data property
      const previousMessages = messageData.data || messageData;
      console.log('Received previous messages:', previousMessages?.length || 0);
      if (previousMessages && previousMessages.length > 0) {
        console.log('Setting messages to:', previousMessages);
        setMessages(previousMessages);
      } else {
        console.log('No previous messages to set');
      }
    });    // Handle room users updates
    swMessenger.on('roomUsers', (userData) => {
      // Extract users from the potential nested structure
      const users = userData.data || userData;
      console.log('Room users updated, data received:', userData);
      console.log('Room users extracted:', users);
      console.log('Room users count:', users?.length || 0);
      
      // Ensure we have a valid array
      if (users && Array.isArray(users)) {
        setRoomUsers(users);
      } else {
        console.error('Invalid room users data received:', userData);
        setRoomUsers([]);
      }
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
      // Extract data from the potential nested structure
      const doc = documentData.data || documentData;
      console.log('Document shared received:', doc);
      
      if (doc && doc.document) {
        // Show notification about the shared document
        const sender = doc.user || 'Someone';
        const fileName = doc.document.name || 'a file';
        const fileType = doc.document.type || 'unknown type';
        
        alert(`${sender} shared ${fileName} (${fileType})`);
        
        // Here you could implement additional functionality:
        // 1. Add the document to a shared documents list
        // 2. Offer a download option
        // 3. Display the content if it's viewable (like images, pdf, etc)
        
        console.log('Document data available at:', doc.document.data);
      } else {
        console.error('Invalid document data received:', documentData);
      }
    });
  };  // Join/leave room when user or room changes
  useEffect(() => {
    if (swRegistered.current && user && room) {
      console.log(`Joining room ${room} as ${user?.name || 'unknown'}`);
      
      // Ensure we have a valid user object with id and name
      if (!user.id || !user.name) {
        console.error('Invalid user object when joining room:', user);
        return;
      }
      
      // Clear current participants list when joining a new room
      setRoomUsers([]);
      
      // For debugging, check all user data for this room
      setTimeout(() => {
        console.log('Room join event - requesting current users');
        swMessenger.sendMessage('requestRoomUsers', { roomId: room }, room)
          .catch(err => console.error('Error requesting room users:', err));
      }, 1000);
        // Give the service worker a moment to be fully active
      setTimeout(() => {
        swMessenger.sendMessage('joinRoom', { user, roomId: room }, room)
          .then(() => {
            // Add ourselves to the local roomUsers state as a fallback
            console.log('Adding self to roomUsers as fallback');
            setRoomUsers(prev => {
              const userExists = prev.some(u => u.id === user.id);
              if (!userExists) {
                return [...prev, { id: user.id, name: user.name }];
              }
              return prev;
            });
          })
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
      
      // Immediately add to local messages for instant feedback
      setMessages(prevMessages => [...prevMessages, messageData]);
      
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
    console.log('shareDocument called with:', document?.name);
    
    if (swRegistered.current && user && room) {
      const documentData = {
        user: user.name,
        userId: user.id,
        document,
        timestamp: new Date().toISOString(),
      };
      
      console.log('Sending document to room:', room);
      
      swMessenger.sendMessage('shareDocument', documentData, room)
        .then(() => {
          console.log('Document shared successfully');
        })
        .catch(error => {
          console.error('Error sharing document:', error);
          setConnectionError('Failed to share document. Please try again.');
          
          // Try to reconnect if connection appears to be lost
          if (!isConnected) {
            handleReconnect();
          }
        });
    } else {
      console.error('Cannot share document: Not connected, missing user, or missing room');
      if (!swRegistered.current) console.error('Service worker not registered');
      if (!user) console.error('User not defined');
      if (!room) console.error('Room not defined');
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