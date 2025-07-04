import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import Layout from '../components/layout/Layout';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

const Welcome = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { setUserName, joinRoom } = useUserContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    
    console.log(`Setting user name: ${name}`);
    setUserName(name);
    
    // If there's a room ID in the URL, join that room and redirect
    if (roomId) {
      console.log(`Joining room from URL: ${roomId}`);
      joinRoom(roomId); // Set the room in UserContext
      navigate(`/room/${roomId}`);
    } else {
      console.log('No room ID, redirecting to rooms page');
      navigate('/rooms');
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome to FastSync</h2>
        <p className="text-gray-600 mb-6 text-center">
          {roomId 
            ? `Enter your name to join the room and start chatting!`
            : `Enter your name to get started. No login required!`
          }
        </p>
        
        {roomId && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Joining Room:</span> {roomId}
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <InputField
            label="Your Name"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            error={error}
            required
          />
          
          <Button
            type="submit"
            fullWidth
            disabled={!name.trim()}
          >
            {roomId ? 'Join Room' : 'Continue'}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default Welcome;