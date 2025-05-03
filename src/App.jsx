import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import { SocketProvider } from './contexts/SocketContext';
import Home from './pages/Home';
import Welcome from './pages/Welcome';
import Rooms from './pages/Rooms';
import Room from './pages/Room';

const App = () => {
  return (
    <BrowserRouter>
      <UserProvider>
        <SocketProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </SocketProvider>
      </UserProvider>
    </BrowserRouter>
  );
};

export default App;