import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useUserContext();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl mb-6">
          Welcome to QuickSync
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Share documents and chat in real-time with your team. No login required!
        </p>
        
        <div className="bg-white shadow-md rounded-lg p-8 mb-6">
          <div className="text-xl font-semibold mb-4">Features</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 border border-gray-200 rounded-md">
              <div className="text-lg font-medium mb-2">Temporary Rooms</div>
              <p className="text-gray-600">Create or join rooms without any permanent account</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-md">
              <div className="text-lg font-medium mb-2">Real-time Chat</div>
              <p className="text-gray-600">Communicate instantly with other room members</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-md">
              <div className="text-lg font-medium mb-2">Document Sharing</div>
              <p className="text-gray-600">Share documents with everyone in the room</p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => navigate(user ? '/rooms' : '/welcome')} 
          variant="primary"
          className="mt-4"
        >
          {user ? 'Go to Rooms' : 'Get Started'}
        </Button>
      </div>
    </Layout>
  );
};

export default Home;