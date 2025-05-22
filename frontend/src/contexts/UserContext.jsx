import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/api";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await authService.getUserInfo();
        setUserInfo(data);
      } catch (e) {
        setUserInfo(null);
      }
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ userInfo, setUserInfo, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext); 