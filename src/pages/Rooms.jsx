import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useUserContext } from '../contexts/UserContext';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import InputField from '../components/ui/InputField';

const Rooms = () => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const { user, createRoom, joinRoom } = useUserContext();
  const navigate = useNavigate();

  // Redirect if user hasn't entered a name
  React.useEffect(() => {
    if (!user) {
      navigate('/welcome');
    }
  }, [user, navigate]);
  const handleCreateRoom = () => {
    // Generate a random 4-character room code using alphanumeric characters
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newRoomId = '';
    for (let i = 0; i < 4; i++) {
      newRoomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    createRoom(newRoomId);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    
    joinRoom(roomId);
    navigate(`/room/${roomId}`);
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Room */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Create a New Room</h2>
            <p className="text-gray-600 mb-6">
              Start a new room and invite others to join. You'll be the host with the ability to end the room.
            </p>
            <Button onClick={handleCreateRoom} fullWidth>
              Create Room
            </Button>
          </div>

          {/* Join Room */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Join an Existing Room</h2>
            <p className="text-gray-600 mb-4">
              Enter the room ID to join an existing room.
            </p>
            
            <form onSubmit={handleJoinRoom}>
              <InputField
                label="Room ID"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                error={error}
                required
              />
              
              <Button
                type="submit"
                variant="secondary"
                fullWidth
                disabled={!roomId.trim()}
              >
                Join Room
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Rooms;