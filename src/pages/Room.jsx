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
  };
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !isConnected) return;
    
    console.log('File selected:', file.name, file.type, file.size);
    
    try {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        console.log('File loaded successfully, sharing document...');
        shareDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          data: fileReader.result,
        });
      };
      fileReader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Failed to read the selected file. Please try again.');
      };
      fileReader.readAsDataURL(file);
    } catch (error) {
      console.error('Exception while handling file upload:', error);
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
                  Participants ({Array.isArray(roomUsers) && roomUsers.length > 0 ? roomUsers.length : 1})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log('Manually refreshing participants');
                    if (isConnected && room) {
                      navigator.serviceWorker.controller?.postMessage({
                        type: 'requestRoomUsers',
                        roomId: room
                      });
                    }
                  }}
                  title="Refresh participants list"
                >
                  ↻
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
                  roomUsers
                    .filter(roomUser => 
                      // Ensure we have valid data and filter out current user
                      roomUser && roomUser.id && roomUser.id !== user.id
                    )
                    .map((roomUser, index) => (
                      <li key={`user-${roomUser.id}-${index}`} className="py-2 border-b border-gray-100">
                        <span className="font-medium">{roomUser.name || "Unknown User"}</span>
                        {roomUser.isCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Host</span>}
                      </li>
                    ))
                ) : (
                  <li className="py-2 text-gray-500 text-sm italic">
                    No other participants yet
                  </li>
                )}
                
                {/* Add refresh button to manually refresh participant list */}
                <li className="mt-2 py-2">
                  <button 
                    onClick={() => {
                      if (isConnected) {
                        // Request room users update
                        console.log('Manually requesting room users update');
                        // Access the SocketContext functions directly
                        navigator.serviceWorker.controller?.postMessage({
                          type: 'requestRoomUsers',
                          roomId
                        });
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
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto h-[60vh]">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 pt-10">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    console.log('Rendering message:', msg);
                    // Extract the message properly, handling potential nesting
                    const message = msg.data || msg;
                    return (
                      <div 
                        key={index}
                        className={`flex ${message.userId === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
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
                            <div>
                              <div className="font-medium">{message.text}</div>
                              <a 
                                href={message.document.data} 
                                download={message.document.name}
                                className="text-sm underline"
                              >
                                Download ({Math.round(message.document.size / 1024)} KB)
                              </a>
                            </div>
                          ) : (
                            <div>{message.text}</div>
                          )}
                          <div className="text-xs opacity-70 text-right mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">                <input
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