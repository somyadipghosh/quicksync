import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useUserContext } from './UserContext';
import swMessenger from '../utils/serviceWorkerMessenger';

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const { user, room, isRoomCreator } = useUserContext();
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
          // Send ping to check connection
          swMessenger.sendMessage('ping')
            .catch(err => {
              console.error('Heartbeat failed:', err);
              // If ping fails, we may need to re-register the SW
              handleReconnect();
            });
          
          // Also send more detailed heartbeat with user info if in a room          // This helps recover from page refreshes and reconnections
          if (user && room) {
            swMessenger.sendMessage('heartbeat', {
              userId: user.id,
              name: user.name,
              roomId: room,
              isCreator: isRoomCreator || false, // Default to false if undefined
              rejoin: true
            }).catch(err => console.error('Detailed heartbeat failed:', err));
          }
        }, 20000); // Every 20 seconds

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
      
      // Clean up cross-browser sync
      if (crossBrowserIntervalRef.current) {
        clearInterval(crossBrowserIntervalRef.current);
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
  
  // Cross-browser communication state
  const crossBrowserIntervalRef = useRef(null);
  const lastStorageCheckRef = useRef(Date.now());
  const STORAGE_KEY_PREFIX = 'quicksync_';
  
  // Cross-browser communication functions
  const handleCrossBrowserMessage = (eventName, data) => {
    console.log(`[CrossBrowser] Handling message: ${eventName}`, data);
    
    switch (eventName) {
      case 'message':
        // Add message from another browser
        if (data && data.userId !== user?.id) {
          setMessages(prevMessages => {
            const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
            
            // Check for duplicates
            if (data.id && currentMessages.some(msg => (msg.data || msg).id === data.id)) {
              return currentMessages;
            }
            
            console.log('[CrossBrowser] Adding message from another browser:', data.text);
            return [...currentMessages, data];
          });
        }
        break;
        
      case 'roomUsers':
        // Update room users from another browser
        if (Array.isArray(data)) {
          console.log('[CrossBrowser] Updating room users from another browser:', data);
          setRoomUsers(data);
        }
        break;
        
      default:
        console.log(`[CrossBrowser] Unknown event: ${eventName}`);
        break;
    }
  };
  
  const pollCrossBrowserMessages = () => {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(STORAGE_KEY_PREFIX + 'broadcast_') && 
        !key.includes('processed_')
      );
      
      for (const key of keys) {
        try {
          const message = JSON.parse(localStorage.getItem(key));
          
          // Only process messages newer than our last check
          if (message.timestamp > lastStorageCheckRef.current) {
            console.log(`[CrossBrowser] Processing message: ${message.eventName} for room ${message.roomId}`);
            
            // Check if this message is for our current room
            if (message.roomId === room) {
              // Handle the cross-browser message
              handleCrossBrowserMessage(message.eventName, message.data);
            }
            
            // Mark message as processed
            localStorage.setItem(`${key}_processed_${Date.now()}`, 'true');
          }
          
          // Remove processed message
          localStorage.removeItem(key);
        } catch (e) {
          console.error('[CrossBrowser] Error processing message:', e);
          localStorage.removeItem(key);
        }
      }
      
      lastStorageCheckRef.current = Date.now();
    } catch (error) {
      console.error('[CrossBrowser] Error polling messages:', error);
    }
  };
  
  const broadcastCrossBrowser = (roomId, eventName, data) => {
    try {
      const message = {
        type: 'crossBrowserMessage',
        roomId: roomId,
        eventName: eventName,
        data: data,
        timestamp: Date.now(),
        sourceUser: user?.id
      };
      
      const storageKey = `${STORAGE_KEY_PREFIX}broadcast_${roomId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(storageKey, JSON.stringify(message));
      
      console.log(`[CrossBrowser] Broadcast message stored: ${eventName} for room ${roomId}`);
      
      // Clean up old messages
      const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_KEY_PREFIX + 'broadcast_'));
      const now = Date.now();
      keys.forEach(key => {
        try {
          const msg = JSON.parse(localStorage.getItem(key));
          if (now - msg.timestamp > 30000) { // 30 seconds old
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[CrossBrowser] Failed to broadcast message:', error);
    }
  };
  
  // Setup cross-browser polling when user and room are available
  useEffect(() => {
    if (user && room) {
      console.log('[CrossBrowser] Starting polling for room:', room);
      
      // Start polling for cross-browser messages
      crossBrowserIntervalRef.current = setInterval(pollCrossBrowserMessages, 2000); // Every 2 seconds
      
      return () => {
        if (crossBrowserIntervalRef.current) {
          clearInterval(crossBrowserIntervalRef.current);
          crossBrowserIntervalRef.current = null;
        }
      };
    }
  }, [user, room]);

  // Helper function to handle reconnection
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
  };  // Set up message handlers for the service worker
  const setupMessageHandlers = () => {    // Handle incoming messages
    swMessenger.on('message', (messageData) => {
      console.log('Received new message to display:', messageData);
      // Check if the message is nested in a data property as the service worker wraps it
      const message = messageData.data || messageData;
      
      console.log('Message details:', {
        messageUserId: message.userId,
        currentUserId: user?.id,
        messageText: message.text,
        isEcho: message.isEcho,
        messageId: message.id
      });
      
      // Don't add if it's an echo message (our own message being sent back to us)
      if (message.isEcho === true) {
        console.log('Ignoring echo message (already displayed):', message.text);
        return;
      }
      
      // For messages from other users, always add them
      // For our own messages, only add if we haven't already added them locally
      const isFromSelf = message.userId === user?.id;
      
      if (isFromSelf) {
        console.log('Received our own message from server, checking if already displayed');
        // Check if we already have this message locally
        setMessages(prevMessages => {
          const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
          const alreadyExists = message.id && currentMessages.some(existingMsg => {
            const msgId = existingMsg && existingMsg.id ? existingMsg.id : undefined;
            return msgId === message.id;
          });
          
          if (alreadyExists) {
            console.log('Our own message already exists locally, skipping');
            return currentMessages;
          } else {
            console.log('Adding our own message from server (missed locally)');
            return [...currentMessages, message];
          }
        });
        return;
      }
      
      // For messages from other users, always add them
      console.log('Adding message from another user:', message.text);
      setMessages(prevMessages => {
        // Ensure prevMessages is an array
        const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
        
        // If this message has an ID, check if we already have it
        if (message.id) {
          const isDuplicate = currentMessages.some(existingMsg => {
            const msgId = existingMsg && existingMsg.id ? existingMsg.id : undefined;
            return msgId === message.id;
          });
          
          if (isDuplicate) {
            console.log('Ignoring duplicate message with ID:', message.id);
            return currentMessages;
          }
        }
        
        console.log('Current messages count:', currentMessages.length);
        console.log('Adding message from another user:', message.text);
        return [...currentMessages, message];
      });
    });    // Handle previous messages when joining a room
    swMessenger.on('previousMessages', (messageData) => {
      // The data might be nested inside a data property
      const previousMessages = messageData.data || messageData;
      console.log('Received previous messages:', previousMessages?.length || 0);
      if (previousMessages && Array.isArray(previousMessages) && previousMessages.length > 0) {
        console.log('Setting messages to:', previousMessages);
        setMessages(previousMessages);
      } else {
        console.log('No previous messages to set');
        setMessages([]);
      }
    });    // Handle room users updates
    swMessenger.on('roomUsers', (userData) => {
      try {
        // Extract users from the potential nested structure
        const users = userData?.data || userData;
        console.log('Room users updated, data received:', userData);
        console.log('Room users extracted:', users);
        console.log('Room users count:', users?.length || 0);
        
        // Ensure we have a valid array
        if (users && Array.isArray(users)) {
          // Trust the service worker's user list - it already includes all users in the room
          // including the current user. The Room component handles deduplication and display logic.
          console.log('Setting room users from service worker:', users);
          setRoomUsers(users);
          
          // Also broadcast to other browsers via localStorage
          if (room) {
            broadcastCrossBrowser(room, 'roomUsers', users);
          }
        } else {
          console.error('Invalid room users data received:', userData);
          // Set empty array if invalid data
          setRoomUsers([]);
        }
      } catch (error) {
        console.error('Exception in room users handler:', error);
        // Set empty array if there's an error - don't add current user manually
        // The service worker should handle user management
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
    });    // Handle document shared event
    swMessenger.on('documentShared', (documentData) => {
      // Extract data from the potential nested structure
      const doc = documentData.data || documentData;
      console.log('Document shared received:', doc);
      
      if (doc && doc.document) {
        // Show notification about the shared document
        const sender = doc.user || 'Someone';
        const fileName = doc.document.name || 'a file';
        const fileType = doc.document.type || 'unknown type';
        
        // Don't show alert for our own documents (we already know we shared it)
        // Also check for isEcho flag
        if (doc.userId !== user?.id && !doc.isEcho) {
          // Alert user about the shared document from others
          alert(`${sender} shared ${fileName} (${fileType})`);
        }
        
        // Create a message object for the document
        const documentMessage = {
          id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          userId: doc.userId,
          user: doc.user,
          type: 'document',
          text: `Shared a file: ${fileName}`,
          document: doc.document,
          timestamp: doc.timestamp || new Date().toISOString()
        };
        
        // Only add to chat if it's from another user (not self)
        // We've already added our own documents for instant feedback
        if (doc.userId !== user?.id && !doc.isEcho) {
          setMessages(prevMessages => {
            // Ensure prevMessages is an array
            const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
            
            // Check for duplicate documents by ID
            if (doc.id) {
              const isDuplicate = currentMessages.some(existingMsg => {
                const msgId = existingMsg && existingMsg.id ? existingMsg.id : undefined;
                return msgId === doc.id;
              });
              
              if (isDuplicate) {
                console.log('Ignoring duplicate document with ID:', doc.id);
                return currentMessages;
              }
            }
            
            console.log('Document from another user added to messages:', documentMessage);
            return [...currentMessages, documentMessage];
          });
        } else {
          console.log('Ignoring document from self or echo (already displayed)');
        }
        
        console.log('Document data available at:', doc.document.data);
      } else {
        console.error('Invalid document data received:', documentData);
      }
    });

    // Handle join room success confirmation
    swMessenger.on('joinRoomSuccess', (data) => {
      console.log('Successfully joined room:', data);
      // This is just a confirmation message, no action needed
      // The roomUsers and previousMessages events will handle the actual data
    });
  };  // Join/leave room when user or room changes
  useEffect(() => {
    if (swRegistered.current && user && room) {
      console.log(`[SocketContext] Joining room ${room} as ${user?.name || 'unknown'} (ID: ${user?.id})`);
      
      // Ensure we have a valid user object with id and name
      if (!user.id || !user.name) {
        console.error('[SocketContext] Invalid user object when joining room:', user);
        return;
      }
        
      // Clear current participants list and messages when joining a new room
      setRoomUsers([]);
      setMessages([]);
      
      // Track join success status
      let joinSuccessful = false;
      
      // Function to add ourselves to the room users list as a fallback
      const ensureSelfInRoomUsers = () => {
        console.log('Ensuring self is in roomUsers list');
        setRoomUsers(prev => {
          const userExists = prev.some(u => u.id === user.id);
          if (!userExists) {
            console.log('Adding self to roomUsers as not found in current list');            return [...prev, { 
              id: user.id, 
              name: user.name, 
              isCreator: isRoomCreator || false // Default to false if undefined
            }];
          }
          return prev;
        });
      };

      // Give the service worker a moment to be fully active
      setTimeout(() => {        // Include isRoomCreator flag in the user object
        const enhancedUser = { ...user, isRoomCreator: isRoomCreator || false };
        
        console.log('Joining room with user data:', enhancedUser);
        
        swMessenger.sendMessage('joinRoom', { user: enhancedUser, roomId: room }, room)
          .then(() => {
            joinSuccessful = true;
            console.log('Joined room successfully, waiting for room users update');
              // Request room users immediately
            try {
              swMessenger.sendMessage('requestRoomUsers', { roomId: room }, room)
                .catch(err => console.error('Error requesting room users:', err));
              
              // Add ourselves as fallback
              ensureSelfInRoomUsers();
            } catch (error) {
              console.error('Exception requesting room users:', error);
              // Still ensure we see ourselves
              ensureSelfInRoomUsers();
            }
          })
          .catch(err => {
            console.error('Error joining room:', err);
            // Try once more after a slight delay
            setTimeout(() => {
              swMessenger.sendMessage('joinRoom', { user: enhancedUser, roomId: room }, room)
                .then(() => {
                  joinSuccessful = true;
                  // Add ourselves as fallback if the retry was successful
                  ensureSelfInRoomUsers();
                })
                .catch(error => {
                  console.error('Second attempt to join room failed:', error);
                  // Even if SW failed, ensure we see ourselves in the UI
                  ensureSelfInRoomUsers();
                });
            }, 500);
          });
      }, 100);
        // Periodically check & request room users to ensure the list stays updated
      const roomUsersInterval = setInterval(() => {
        if (joinSuccessful && room) {
          console.log('Periodic room users refresh');
          try {
            swMessenger.sendMessage('requestRoomUsers', { roomId: room }, room)
              .catch(err => console.error('Error in periodic room users request:', err));
            
            // Make sure we're still in the list
            ensureSelfInRoomUsers();
          } catch (error) {
            console.error('Exception in periodic room users refresh:', error);
          }
        }
      }, 10000); // Every 10 seconds
      
      return () => {
        if (roomUsersInterval) clearInterval(roomUsersInterval);
        if (swRegistered.current && room) {
          console.log(`Leaving room ${room}`);
          swMessenger.sendMessage('leaveRoom', {}, room);
        }
      };
      
      // Clean up when leaving room or unmounting
      return () => {
        if (swRegistered.current && room) {
          console.log(`Leaving room ${room}`);
          swMessenger.sendMessage('leaveRoom', {}, room);
        }
      };
    }
  }, [user, room]);  // Helper function to generate unique IDs
  const generateUniqueId = (prefix = 'msg') => {
    return `${prefix}_${user?.id || 'unknown'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };
  // Message sending function
  const sendMessage = (text) => {
    if (swRegistered.current && user && room) {
      // Create a unique message ID to help with deduplication
      const messageId = generateUniqueId('msg');
      
      const messageData = {
        id: messageId, // Add unique ID to each message
        user: user.name,
        userId: user.id,
        text,
        timestamp: new Date().toISOString(),
      };
      
      console.log('Sending message:', messageData);
      
      // Immediately add to local messages for instant feedback
      setMessages(prevMessages => {
        // Ensure prevMessages is an array
        const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
        return [...currentMessages, messageData];
      });
      
      swMessenger.sendMessage('message', messageData, room)
        .then(() => {
          console.log('Message sent successfully');
          
          // Also broadcast to other browsers via localStorage
          broadcastCrossBrowser(room, 'message', messageData);
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
  };  // Document sharing function
  const shareDocument = (document) => {
    console.log('shareDocument called with:', document?.name);
    
    if (swRegistered.current && user && room) {
      // Create a unique document ID to help with deduplication
      const docId = generateUniqueId('doc');
      
      // Create a document message with the type field for proper rendering
      const documentData = {
        id: docId, // Add unique ID to each document message
        user: user.name,
        userId: user.id,
        type: 'document', // This is critical for rendering correctly
        text: `Shared a file: ${document.name}`,
        document,
        timestamp: new Date().toISOString(),
      };
      
      console.log('Sending document to room:', room);
      
      // Immediately add to local messages for instant feedback
      setMessages(prevMessages => {
        // Ensure prevMessages is an array
        const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
        return [...currentMessages, documentData];
      });
      
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