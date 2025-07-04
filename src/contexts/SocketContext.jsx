import React, { createContext, useMemo, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useUserContext } from './UserContext';

export const SocketContext = createContext(null);

export const useSocketContext = () => useContext(SocketContext);

// Get server URL from environment or fallback to localhost
const getServerUrl = () => {
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
  }
  return 'http://localhost:5000';
};

export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => io(getServerUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    forceNew: false
  }), []);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const { user, room, isRoomCreator } = useUserContext();
  
  // Refs for cleanup and state management
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Socket connection management
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const handleDisconnect = (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setRoomUsers([]);
      
      // Set appropriate error message based on disconnect reason
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server');
      } else if (reason === 'transport close' || reason === 'transport error') {
        setConnectionError('Connection lost - attempting to reconnect...');
      }
    };

    const handleConnectError = (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      setConnectionError(`Connection failed: ${error.message}`);
    };

    const handleReconnect = (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleReconnectError = (error) => {
      console.error('Reconnection failed:', error);
      setConnectionError('Reconnection failed. Please refresh the page.');
    };

    // Attach socket event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_error', handleReconnectError);

    // Initial connection check
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
    };
  }, [socket]);
  // Message handlers
  useEffect(() => {
    const handleReceiveMessage = (messageData) => {
      console.log('Received message:', messageData);
      
      setMessages(prevMessages => {
        const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
        
        // Check for duplicates by ID
        if (messageData.id && currentMessages.some(msg => msg.id === messageData.id)) {
          return currentMessages;
        }
        
        return [...currentMessages, messageData];
      });
    };

    const handleMessageHistory = (history) => {
      console.log('Received message history:', history.length);
      setMessages(Array.isArray(history) ? history : []);
    };

    const handleUserJoined = ({ username, users }) => {
      console.log(`User ${username} joined. Total users:`, users.length);
      setRoomUsers(Array.isArray(users) ? users : []);
    };

    const handleUserLeft = ({ username, users }) => {
      console.log(`User ${username} left. Total users:`, users.length);
      setRoomUsers(Array.isArray(users) ? users : []);
    };

    const handleUserTyping = ({ username }) => {
      setTypingUsers(prev => {
        if (!prev.includes(username)) {
          return [...prev, username];
        }
        return prev;
      });
    };

    const handleUserStoppedTyping = ({ username }) => {
      setTypingUsers(prev => prev.filter(user => user !== username));
    };

    // Attach message event listeners
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_history', handleMessageHistory);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_history', handleMessageHistory);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
    };
  }, [socket]);  // Room management
  useEffect(() => {
    if (!socket || !isConnected || !user?.id || !user?.name || !room) {
      return;
    }

    console.log(`Joining room ${room} as ${user.name}`);

    // Join the room
    socket.emit('join_room', {
      roomId: room,
      username: user.name
    });

    // Clear state when joining new room
    setMessages([]);
    setRoomUsers([]);
    setTypingUsers([]);

    // Leave room on cleanup
    return () => {
      if (socket && room) {
        console.log(`Leaving room ${room}`);
        socket.emit('leave_room', {
          roomId: room,
          username: user.name
        });
      }
    };
  }, [socket, isConnected, user, room]);

  // Helper function to generate unique message IDs
  const generateMessageId = useCallback(() => {
    return `msg_${user?.id || 'unknown'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, [user?.id]);

  // Message sending function
  const sendMessage = useCallback((text) => {
    if (!socket || !isConnected || !user?.name || !room || !text.trim()) {
      console.error('Cannot send message: Missing requirements');
      return;
    }

    const messageData = {
      roomId: room,
      message: text.trim(),
      username: user.name
    };

    console.log('Sending message:', messageData);
    socket.emit('send_message', messageData);
  }, [socket, isConnected, user?.name, room]);

  // Document sharing function
  const shareDocument = useCallback((document) => {
    if (!socket || !isConnected || !user?.name || !room || !document) {
      console.error('Cannot share document: Missing requirements');
      return;
    }

    console.log('Sharing document:', document.name);
    
    socket.emit('send_document', {
      roomId: room,
      file: document,
      username: user.name
    });
  }, [socket, isConnected, user?.name, room]);

  // Typing indicators
  const startTyping = useCallback(() => {
    if (!socket || !isConnected || !user?.name || !room || isTypingRef.current) {
      return;
    }

    isTypingRef.current = true;
    socket.emit('typing', {
      roomId: room,
      username: user.name
    });

    // Auto-stop typing after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [socket, isConnected, user?.name, room]);

  const stopTyping = useCallback(() => {
    if (!socket || !isConnected || !user?.name || !room || !isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    socket.emit('stop_typing', {
      roomId: room,
      username: user.name
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [socket, isConnected, user?.name, room]);

  // Room ending function (for room creators)
  const endRoom = useCallback(() => {
    if (!socket || !isConnected || !room || !isRoomCreator) {
      console.error('Cannot end room: Missing requirements or not room creator');
      return;
    }

    socket.emit('end_room', { roomId: room });
  }, [socket, isConnected, room, isRoomCreator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  return (
    <SocketContext.Provider value={{ 
      isConnected, 
      connectionError,
      messages, 
      roomUsers,
      typingUsers,
      sendMessage,
      shareDocument,
      endRoom,
      startTyping,
      stopTyping,
      socket
    }}>
      {children}
    </SocketContext.Provider>
  );
};