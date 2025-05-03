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

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = () => {
      shareDocument({
        name: file.name,
        type: file.type,
        size: file.size,
        data: fileReader.result,
      });
    };
    fileReader.readAsDataURL(file);
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

  if (!user || !room) return null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Room header */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Room: {roomId}</h2>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-sm text-gray-500">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </p>
              </div>
              {connectionError && (
                <p className="text-xs text-red-500 mt-1">
                  Error: {connectionError}. Make sure the socket server is running.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => setShowUserList(!showUserList)}
              >
                Participants ({roomUsers.length || 1})
              </Button>
              {isRoomCreator ? (
                <Button variant="danger" onClick={handleEndRoom}>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User list (only shown when toggled) */}
          {showUserList && (
            <div className="lg:col-span-1 bg-white shadow-sm rounded-lg p-4 h-[70vh] overflow-y-auto">
              <h3 className="font-bold mb-4">Participants</h3>
              <ul>
                {/* Current user always shown at top */}
                <li className="py-2 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{user.name} (You)</span>
                    {isRoomCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Host</span>}
                  </div>
                </li>
                
                {/* Other users in the room */}
                {roomUsers.length > 0 ? 
                  roomUsers
                    .filter(roomUser => roomUser.id !== user.id)
                    .map((roomUser, index) => (
                      <li key={index} className="py-2 border-b border-gray-100">
                        <span className="font-medium">{roomUser.name}</span>
                        {roomUser.isCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Host</span>}
                      </li>
                    ))
                  : 
                  <li className="py-2 text-gray-500 text-sm italic">
                    No other participants yet
                  </li>
                }
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
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div 
                      key={index}
                      className={`flex ${msg.userId === user.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[75%] rounded-lg px-4 py-2 ${
                          msg.userId === user.id 
                            ? 'bg-blue-500 text-white rounded-br-none' 
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {msg.userId !== user.id && (
                          <div className="text-xs font-medium mb-1">
                            {msg.user}
                          </div>
                        )}
                        {msg.type === 'document' ? (
                          <div>
                            <div className="font-medium">{msg.text}</div>
                            <a 
                              href={msg.document.data} 
                              download={msg.document.name}
                              className="text-sm underline"
                            >
                              Download ({Math.round(msg.document.size / 1024)} KB)
                            </a>
                          </div>
                        ) : (
                          <div>{msg.text}</div>
                        )}
                        <div className="text-xs opacity-70 text-right mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
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
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type a message..."
                />
                
                <div className="relative">
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    Attach
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={!messageInput.trim()}
                >
                  Send
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Room;