import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// useSocket
//
// Returns the shared Socket.io client connection. A module-level singleton
// is used deliberately — there should only ever be one WebSocket connection
// for the whole app, and a per-hook instance causes a race condition in
// React StrictMode:
//
//   1. Hook runs during render → creates socket, stores in ref
//   2. StrictMode unmounts the component → cleanup disconnects + nulls ref
//   3. Re-render fires before the next effect → ref is null → crash
//
// A module-level socket sidesteps this entirely. The socket is created once
// on first import and reused across all renders and remounts. Socket.io
// handles reconnection automatically if the connection drops.
// ---------------------------------------------------------------------------

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io({
      withCredentials: true,
      // Try WebSocket first; fall back to long-polling if the WS upgrade
      // fails (e.g. during dev when Vite's proxy hasn't fully warmed up).
      transports: ['websocket', 'polling'],
    });
  }
  return _socket;
}

export function useSocket(): Socket {
  const socket = getSocket();

  useEffect(() => {
    const onConnect = () => console.log('🔌  Socket.io connected:', socket.id);
    const onDisconnect = (reason: string) =>
      console.log('🔌  Socket.io disconnected:', reason);
    const onConnectError = (err: Error) =>
      console.warn('🔌  Socket.io connection error:', err.message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      // Do NOT call socket.disconnect() or null _socket here.
      // The singleton must survive StrictMode's unmount/remount cycle,
      // and other components (e.g. future useSocket callers) may still need it.
    };
  }, [socket]);

  return socket;
}
