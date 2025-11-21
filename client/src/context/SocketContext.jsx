
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthContext } from '../hooks/useAuth.js';

const SocketContext = createContext(undefined);

/**
 * @function useSocket
 * @description Hook exposing the socket context.
 * @returns {{ socket: import('socket.io-client').Socket|null, isConnected: boolean }}
 */
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketContextProvider');
  }
  return context;
};

/**
 * @component SocketContextProvider
 * @description Establishes a Socket.io connection and shares it via context.
 * @param {{ children: React.ReactNode }} props - React props.
 * @returns {JSX.Element}
 */
export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { authUser, isLoading } = useAuthContext();

  useEffect(() => {
    // Don't connect if still loading auth state
    if (isLoading) {
      return;
    }

    // Connect socket (now works for both authenticated and guest users)
    console.log('Initializing socket connection');
    const socketUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:5000';
    console.log('Socket URL:', socketUrl);
    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
      autoConnect: true
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error.message);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after all attempts');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('connect_error');
      socketInstance.off('reconnect');
      socketInstance.off('reconnect_error');
      socketInstance.off('reconnect_failed');
      socketInstance.disconnect();
    };
  }, [isLoading]); // Only re-run when loading state changes

  const contextValue = {
    socket,
    isConnected
  };

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
};
