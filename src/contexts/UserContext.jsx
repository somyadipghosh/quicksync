import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const useUserContext = () => useContext(UserContext);

// Helper functions for localStorage
const loadUserData = () => {
  try {
    const userData = localStorage.getItem('fastsync_user');
    return userData ? JSON.parse(userData) : null;
  } catch (err) {
    console.error("Error loading user data from localStorage:", err);
    return null;
  }
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(loadUserData);
  const [room, setRoom] = useState(null);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  
  // Persist user data to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('fastsync_user', JSON.stringify(user));
    }
  }, [user]);

  const setUserName = (name) => {
    // If user already exists, update the name but keep the same ID
    if (user && user.id) {
      setUser({ ...user, name });
    } else {
      // Otherwise create a new user with a unique ID
      setUser({ name, id: crypto.randomUUID() });
    }
  };

  const createRoom = (roomId) => {
    setRoom(roomId);
    setIsRoomCreator(true);
  };

  const joinRoom = (roomId) => {
    console.log(`UserContext: Joining room ${roomId}`);
    setRoom(roomId);
    setIsRoomCreator(false);
  };

  const leaveRoom = () => {
    setRoom(null);
    setIsRoomCreator(false);
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      setUserName, 
      room, 
      isRoomCreator, 
      createRoom, 
      joinRoom, 
      leaveRoom 
    }}>
      {children}
    </UserContext.Provider>
  );
};