import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import { useSocketContext } from '../contexts/SocketContext';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import CopyButton from '../components/ui/CopyButton';

const Room = () => {
  const { roomId } = useParams();
  const { user } = useUserContext();
  const { 
    messages, 
    roomUsers, 
    typingUsers,
    sendMessage, 
    shareDocument, 
    startTyping,
    stopTyping,
    isConnected, 
    connectionError 
  } = useSocketContext();
  
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const typingTimeoutRef = useRef(null);

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
  
  // Helper to safely format message time
  const formatMessageTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
  };

  // Room invitation link
  const inviteLink = `${window.location.origin}/room/${roomId}`;
  
  // Redirect if user hasn't entered a name
  useEffect(() => {
    if (!user) {
      navigate('/welcome');
    }
  }, [user, navigate]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && sendMessage) {
      sendMessage(messageInput.trim());
      setMessageInput('');
      if (stopTyping) stopTyping(); // Stop typing when message is sent
    }
  };

  // Handle typing indicators
  const handleTyping = () => {
    if (!startTyping) return;
    
    startTyping();
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-stop typing after 3 seconds of no activity
    typingTimeoutRef.current = setTimeout(() => {
      if (stopTyping) stopTyping();
    }, 3000);
  };

  const handleStopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (stopTyping) {
      stopTyping();
    }
  };

  // Handle input change with typing indicators
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.length > 0) {
      handleTyping();
    } else {
      handleStopTyping();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !shareDocument) {
      console.log('No file selected or shareDocument not available');
      return;
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    console.log('Processing file:', file.name, file.type, formatFileSize(file.size));

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result,
      };
      console.log('File processed, sharing document...');
      shareDocument(fileData);
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      alert('Error reading file. Please try again.');
    };
    
    reader.readAsDataURL(file);
    
    // Clear the file input
    e.target.value = '';
  };

  // Redirect to welcome page if user hasn't set their name, but preserve the room ID
  useEffect(() => {
    if (!user && roomId) {
      navigate(`/welcome?room=${roomId}`);
    }
  }, [user, roomId, navigate]);

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-lg">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold">Room: {roomId}</h2>
              <CopyButton text={window.location.href} label="Share Room Link" />
            </div>
            <p className="text-sm text-gray-500">Users: {roomUsers && roomUsers.length > 0 ? roomUsers.map(u => u.username || u.name).join(', ') : 'No users'}</p>
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <span className="font-semibold">Room Link:</span> 
              <span className="text-blue-600 break-all ml-1">{window.location.href}</span>
            </div>
          </div>
          <div className="p-4 h-96 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className={`mb-4 ${msg.system ? 'text-center' : msg.username === user.name ? 'text-right' : 'text-left'}`}>
                {msg.system ? (
                  <p className="text-gray-500 italic">{msg.message}</p>
                ) : msg.file ? (
                  <div>
                    <p className={`font-bold ${msg.username === user.name ? 'text-blue-500' : 'text-green-500'}`}>{msg.username}</p>
                    <div className="mt-2 p-3 border rounded-lg bg-gray-50">
                      {msg.file.type.startsWith('image/') ? (
                        <div>
                          <img src={msg.file.data} alt={msg.file.name} className="max-w-xs rounded-lg mb-2" />
                          <p className="text-sm text-gray-600">{msg.file.name} ({formatFileSize(msg.file.size)})</p>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{getFileIcon(msg.file.type)}</span>
                          <div className="flex-1">
                            <a href={msg.file.data} download={msg.file.name} className="text-blue-500 hover:underline font-semibold">
                              {msg.file.name}
                            </a>
                            <p className="text-sm text-gray-500">{formatFileSize(msg.file.size)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatMessageTime(msg.time || msg.timestamp)}</p>
                  </div>
                ) : (
                  <div>
                    <p className={`font-bold ${msg.username === user.name ? 'text-blue-500' : 'text-green-500'}`}>{msg.username}</p>
                    <p>{msg.message || msg.text || '[No message]'}</p>
                    <p className="text-xs text-gray-400">{formatMessageTime(msg.time || msg.timestamp)}</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex">
              <input
                type="text"
                value={messageInput}
                onChange={handleInputChange}
                onBlur={handleStopTyping}
                className="flex-1 border rounded-l-lg p-2"
                placeholder="Type a message..."
                disabled={!isConnected}
              />
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="hidden" 
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer p-2 hover:bg-gray-100 border-t border-b border-r bg-white transition-colors duration-200 flex items-center justify-center"
                title="Upload file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </label>
              <Button type="submit" className="rounded-r-lg" disabled={!isConnected || !messageInput.trim()}>
                Send
              </Button>
            </form>
            
            {/* Connection status */}
            {!isConnected && (
              <div className="text-center text-red-500 text-sm mt-2">
                {connectionError || 'Disconnected - attempting to reconnect...'}
              </div>
            )}
            
            {/* Typing indicators */}
            <div className="h-5 mt-1">
              {typingUsers && typingUsers.length > 0 && (
                <p className="text-sm text-gray-500 italic">
                  {typingUsers.filter(u => u !== user?.name).join(', ')} {typingUsers.filter(u => u !== user?.name).length === 1 ? 'is' : 'are'} typing...
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