import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export const useUserContext = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [isRoomCreator, setIsRoomCreator] = useState(false);

  const setUserName = (name) => {
    setUser({ name, id: crypto.randomUUID() });
  };

  const createRoom = (roomId) => {
    setRoom(roomId);
    setIsRoomCreator(true);
  };

  const joinRoom = (roomId) => {
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