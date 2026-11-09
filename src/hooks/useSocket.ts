import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

let globalSocket: Socket | null = null;

export const useSocket = (event: string, callback: () => void) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL);
    }

    const handler = () => {
      callbackRef.current();
    };

    globalSocket.on(event, handler);

    return () => {
      globalSocket?.off(event, handler);
    };
  }, [event]);
};
