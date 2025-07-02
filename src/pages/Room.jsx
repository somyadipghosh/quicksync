import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import { useSocketContext } from '../contexts/SocketContext';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import CopyButton from '../components/ui/CopyButton';

const Room = () => {
  const { roomId } = useParams();
  const { user, room, isRoomCreator, leaveRoom } = useUserContext();
  const { messages, roomUsers, sendMessage, shareDocument, isConnected, connectionError, endRoom } = useSocketContext();
  const [messageInput, setMessageInput] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  
  // Helper function to format file size
  const formatFileSize = (sizeInBytes) => {
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${Math.round(sizeInBytes / 1024)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Helper function to get file type icon class
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return '📷';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('doc') || fileType.includes('word')) return '📝';
    if (fileType.includes('xls') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('ppt') || fileType.includes('presentation')) return '📊';
    if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️';
    return '📁';
  };
  
  // Room invitation link
  const inviteLink = `${window.location.origin}/room/${roomId}`;
  
  // Redirect if user hasn't entered a name
  useEffect(() => {
    if (!user) {
      navigate('/welcome');
    }
  }, [user, navigate]);
  // Handle reconnection attempts
  useEffect(() => {
    if (connectionError && !reconnecting) {
      setReconnecting(true);
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);
      return () => clearTimeout(timer);
    }
    
    if (isConnected && reconnecting) {
      setReconnecting(false);
    }
  }, [isConnected, connectionError, reconnecting]);
  
  // Debug room users and ensure we have valid data
  useEffect(() => {
    console.log('Current room users:', roomUsers);
    
    // If we don't have any room users but we're connected, add ourselves
    if (isConnected && user && (!roomUsers || roomUsers.length === 0)) {
      console.log('No room users found, adding self as fallback');
      // We'll use the internal state as a fallback if roomUsers is empty
    }
  }, [roomUsers, user, isConnected]);
  
  // Scroll to bottom of messages and debug message array
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    console.log('Current messages array:', messages);
  }, [messages]);
  
  // Single function to handle message sending
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && isConnected) {
      sendMessage(messageInput.trim());
      setMessageInput('');
      console.log('Message sent:', messageInput.trim());
    }
  };
  
  // Handle Enter key press but ensure it doesn't get triggered multiple times
  const handleKeyDown = (e) => {
    // Only handle Enter key when not submitting the form
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Don't call sendMessage directly, call the form submit handler
      // This prevents duplicate messages
      handleSendMessage(e);
    }
  };  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !isConnected) return;
    
    // Validate file size (limit to 5MB to be safe)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      alert(`File size (${formatFileSize(file.size)}) exceeds the maximum allowed (${formatFileSize(MAX_SIZE)})`);
      return;
    }
    
    console.log('File selected:', file.name, file.type, file.size);
    
    try {
      // Show loading state
      const loadingMessage = `Uploading ${file.name}...`;
      setMessageInput(loadingMessage);
      
      const fileReader = new FileReader();
      
      fileReader.onload = () => {
        console.log('File loaded successfully, sharing document...');
        // Clear loading message
        setMessageInput('');
        
        // Share the document with all required metadata
        shareDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          data: fileReader.result,
        });
      };
      
      fileReader.onerror = (error) => {
        console.error('Error reading file:', error);
        setMessageInput('');
        alert('Failed to read the selected file. Please try again.');
      };
      
      // Start reading the file
      fileReader.readAsDataURL(file);
    } catch (error) {
      console.error('Exception while handling file upload:', error);
      setMessageInput('');
      alert('Something went wrong while processing the file. Please try again.');
    }
  };

  const handleEndRoom = () => {
    if (window.confirm('Are you sure you want to end this room for all participants?')) {
      endRoom();
      leaveRoom();
      navigate('/rooms');
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate('/rooms');
  };

  // Force a manual reconnect by refreshing the page
  const handleManualReconnect = () => {
    setReconnecting(true);
    window.location.reload();
  };

  if (!user || !room) return null;
    // For debugging message and user state
  console.log('Rendering Room with messages:', messages);
  console.log('Current room users:', roomUsers);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Room header */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Room: {roomId}</h2>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : reconnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                <p className="text-sm text-gray-500">
                  {isConnected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
                </p>
                {!isConnected && !reconnecting && (
                  <button 
                    onClick={handleManualReconnect} 
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                  >
                    Reconnect
                  </button>
                )}
              </div>
              {connectionError && (
                <p className="text-xs text-red-500 mt-1">
                  {reconnecting ? 'Attempting to reconnect...' : `Error: ${connectionError}`}
                </p>
              )}
            </div>            <div className="flex gap-2">
              <div className="flex space-x-1">
                <Button 
                  variant="secondary" 
                  onClick={() => setShowUserList(!showUserList)}
                >
                  Participants ({roomUsers ? [...new Set(roomUsers.map(u => u.userId || u.id?.split('_')[0] || u.id))].length : 1})
                </Button>                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log('Manually refreshing participants');
                    if (isConnected) {
                      try {
                        if (!navigator.serviceWorker.controller) {
                          console.error('Service worker controller not available');
                          return;
                        }
                        navigator.serviceWorker.controller.postMessage({
                          type: 'requestRoomUsers',
                          roomId: roomId // Use roomId from useParams instead of room object
                        });
                      } catch (error) {
                        console.error('Error requesting room users:', error);
                      }
                    }
                  }}
                  title="Refresh participants list"
                >
                  ↻
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const timestamp = new Date().toLocaleTimeString();
                    const testMessage = `Test message from ${user.name} at ${timestamp}`;
                    console.log('Sending test message:', testMessage);
                    if (isConnected) {
                      sendMessage(testMessage);
                    }
                  }}
                  title="Send test message"
                  className="bg-green-100 hover:bg-green-200"
                >
                  Test
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log('=== DEBUG INFO ===');
                    console.log('Current user:', user);
                    console.log('Room ID:', roomId);
                    console.log('Room users:', roomUsers);
                    console.log('Messages:', messages);
                    console.log('Is connected:', isConnected);
                    console.log('Service worker controller:', navigator.serviceWorker.controller);
                    console.log('LocalStorage keys:', Object.keys(localStorage).filter(k => k.includes('quicksync')));
                    
                    // Check localStorage content
                    const quicksyncKeys = Object.keys(localStorage).filter(k => k.includes('quicksync'));
                    quicksyncKeys.forEach(key => {
                      try {
                        const value = JSON.parse(localStorage.getItem(key));
                        console.log(`LocalStorage[${key}]:`, value);
                      } catch (e) {
                        console.log(`LocalStorage[${key}]: ${localStorage.getItem(key)}`);
                      }
                    });
                    
                    console.log('==================');
                  }}
                  title="Show debug info"
                  className="bg-yellow-100 hover:bg-yellow-200"
                >
                  Debug
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log('Manually triggering cross-browser sync check...');
                    
                    // Manually trigger a test message broadcast
                    const testMessage = {
                      id: `test_${Date.now()}`,
                      user: user.name,
                      userId: user.id,
                      text: `Cross-browser test from ${user.name} at ${new Date().toLocaleTimeString()}`,
                      timestamp: new Date().toISOString(),
                    };
                    
                    // Store directly in localStorage for testing
                    const storageKey = `quicksync_broadcast_${roomId}_${Date.now()}_test`;
                    localStorage.setItem(storageKey, JSON.stringify({
                      type: 'crossBrowserMessage',
                      roomId: roomId,
                      eventName: 'message',
                      data: testMessage,
                      timestamp: Date.now(),
                      sourceUser: user.id
                    }));
                    
                    console.log('Test cross-browser message stored in localStorage');
                  }}
                  title="Test cross-browser sync"
                  className="bg-purple-100 hover:bg-purple-200"
                >
                  Cross-Test
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log('Requesting service worker debug info...');
                    if (navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'debug',
                        roomId: roomId
                      });
                      
                      // Listen for debug response
                      const handleDebugResponse = (event) => {
                        if (event.data && event.data.type === 'debugResponse') {
                          console.log('=== SERVICE WORKER DEBUG RESPONSE ===');
                          console.log('SW Debug Data:', event.data.data);
                          console.log('=====================================');
                          navigator.serviceWorker.removeEventListener('message', handleDebugResponse);
                        }
                      };
                      navigator.serviceWorker.addEventListener('message', handleDebugResponse);
                    } else {
                      console.error('No service worker controller available');
                    }
                  }}
                  title="Debug service worker state"
                  className="bg-orange-100 hover:bg-orange-200"
                >
                  SW Debug
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    console.log('Force updating service worker...');
                    try {
                      // Unregister current SW
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      for (let registration of registrations) {
                        await registration.unregister();
                      }
                      console.log('Service worker unregistered');
                      
                      // Force reload to get new SW
                      window.location.reload();
                    } catch (error) {
                      console.error('Error updating service worker:', error);
                    }
                  }}
                  title="Force service worker update"
                  className="bg-red-100 hover:bg-red-200"
                >
                  SW Update
                </Button>
              </div>
              {isRoomCreator ? (
                <Button variant="danger" onClick={handleEndRoom} disabled={!isConnected}>
                  End Room
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleLeaveRoom}>
                  Leave Room
                </Button>
              )}
            </div>
          </div>

          {/* Invitation section */}
          <div className="bg-blue-50 rounded-md p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-800">Invite others to join this room:</p>
              <p className="text-xs text-blue-700 truncate max-w-md">{inviteLink}</p>
            </div>
            <CopyButton text={inviteLink} label="Copy Link" />
          </div>
        </div>

        {/* Connection error banner with manual reconnect option */}
        {connectionError && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {reconnecting 
                      ? 'Connection lost. Attempting to reconnect...' 
                      : 'Having trouble connecting to the room. This might be due to network issues or server limitations in the free tier.'
                    }
                  </p>
                </div>
              </div>
              {!reconnecting && (
                <Button
                  variant="secondary"
                  onClick={handleManualReconnect}
                  className="text-xs ml-4"
                >
                  Try Reconnecting
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User list (only shown when toggled) */}
          {showUserList && (
            <div className="lg:col-span-1 bg-white shadow-sm rounded-lg p-4 h-[70vh] overflow-y-auto">
              <h3 className="font-bold mb-4">Participants</h3>
              <ul>                {/* Current user always shown at top */}
                <li className="py-2 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{user.name} (You)</span>
                    {isRoomCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Host</span>}
                  </div>
                </li>
                
                {/* Show others already in the room */}
                {Array.isArray(roomUsers) && roomUsers.length > 0 ? (
                  // First, deduplicate by base userId (extract from composite IDs like "userId_clientId")
                  // Then filter out the current user
                  [...new Map(roomUsers.map(item => {
                    const baseUserId = item.userId || item.id?.split('_')[0] || item.id;
                    return [baseUserId, item];
                  })).values()]
                    .filter(roomUser => {
                      const baseUserId = roomUser.userId || roomUser.id?.split('_')[0] || roomUser.id;
                      return baseUserId !== user.id;
                    })
                    .map((roomUser) => {
                      const baseUserId = roomUser.userId || roomUser.id?.split('_')[0] || roomUser.id;
                      return (
                        <li key={`user-${baseUserId}`} className="py-2 border-b border-gray-100">
                          <span className="font-medium">{roomUser.name.split(' (')[0] || "Unknown User"}</span>
                          {roomUser.isCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Host</span>}
                        </li>
                      );
                    })
                ) : (
                  <li className="py-2 text-gray-500 text-sm italic">
                    No other participants yet
                  </li>
                )}
                
                {/* Add refresh button to manually refresh participant list */}                <li className="mt-2 py-2">
                  <button 
                    onClick={() => {
                      if (isConnected) {
                        // Request room users update
                        console.log('Manually requesting room users update');
                        // Access the SocketContext functions directly
                        try {
                          navigator.serviceWorker.controller?.postMessage({
                            type: 'requestRoomUsers',
                            roomId: roomId
                          });
                        } catch (error) {
                          console.error('Error requesting room users:', error);
                        }
                      }
                    }}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Refresh Participants List
                  </button>
                </li>
              </ul>
            </div>
          )}

          {/* Chat area */}
          <div className={`${showUserList ? 'lg:col-span-3' : 'lg:col-span-4'} flex flex-col bg-white shadow-sm rounded-lg`}>
            {/* Messages */}            <div className="flex-1 p-4 overflow-y-auto h-[60vh]">
              {Array.isArray(messages) && messages.length === 0 ? (
                <div className="text-center text-gray-500 pt-10">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Process and render messages */}
                  {Array.isArray(messages) && messages
                    .filter(msg => {
                      // Deduplicate messages by ID
                      const message = msg.data || msg;
                      if (!message.id) return true;
                      
                      // Check if we've already seen this message ID
                      const isDuplicate = messages.some((m, i) => {
                        const otherMsg = m.data || m;
                        return otherMsg.id === message.id && messages.indexOf(m) < messages.indexOf(msg);
                      });
                      
                      return !isDuplicate;
                    })
                    .map((msg, index) => {
                      const message = msg.data || msg;
                      return (
                        <div 
                          key={message.id || index}
                          className={`flex ${message.userId === user.id ? 'justify-end' : 'justify-start'}`}
                        >                          <div 
                            className={`max-w-[75%] rounded-lg px-4 py-2 ${
                              message.userId === user.id 
                                ? 'bg-blue-500 text-white rounded-br-none' 
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}
                          >
                            {message.userId !== user.id && (
                              <div className="text-xs font-medium mb-1">
                                {message.user}
                              </div>
                            )}
                            
                            {message.type === 'document' ? (
                              <div className="document-message">
                                <div className="font-medium mb-1">{message.text}</div>
                                
                                {/* Preview for image files */}
                                {message.document.type && message.document.type.startsWith('image/') && (
                                  <div className="mb-2">
                                    <img 
                                      src={message.document.data}
                                      alt={message.document.name}
                                      className="max-w-full rounded max-h-64 object-contain"
                                    />
                                  </div>
                                )}
                                
                                <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded p-2">
                                  <div className="mr-3 text-blue-500 text-xl">
                                    {getFileIcon(message.document.type || '')}
                                  </div>
                                  
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold truncate">{message.document.name}</div>
                                    <div className="text-xs text-gray-500">
                                      {message.document.type || 'Unknown type'} • {formatFileSize(message.document.size)}
                                    </div>
                                  </div>
                                  
                                  <a 
                                    href={message.document.data} 
                                    download={message.document.name}
                                    className="ml-2 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div>{message.text}</div>
                            )}
                            
                            <div className="text-xs opacity-70 text-right mt-1">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      );                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type a message..."
                  disabled={!isConnected}
                />
                  <div className="relative">
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      const fileInput = document.getElementById('file-upload');
                      if (fileInput) {
                        fileInput.value = ''; // Clear previous selection
                        fileInput.click();
                      } else {
                        console.error('File input element not found');
                      }
                    }}
                    disabled={!isConnected}
                  >
                    Attach
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="*/*" // Accept all file types
                    disabled={!isConnected}
                  />
                </div>
                
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    console.log('Sending test message');
                    if (isConnected) {
                      sendMessage(`Test message from ${user.name} at ${new Date().toLocaleTimeString()}`);
                    }
                  }}
                  disabled={!isConnected}
                  title="Send a test message"
                >
                  Test
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={!messageInput.trim() || !isConnected}
                >
                  Send
                </Button>
              </form>
              {!isConnected && (
                <p className="text-xs text-red-500 mt-2">
                  You are currently disconnected. Messages cannot be sent until connection is restored.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Room;