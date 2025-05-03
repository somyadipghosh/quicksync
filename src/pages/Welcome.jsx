import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import Layout from '../components/layout/Layout';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

const Welcome = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { setUserName } = useUserContext();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    
    setUserName(name);
    navigate('/rooms');
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome to QuickSync</h2>
        <p className="text-gray-600 mb-6 text-center">
          Enter your name to get started. No login required!
        </p>
        
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
            Continue
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default Welcome;