import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';

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

// Connection status store for useSyncExternalStore
type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';
let connectionStatus: ConnectionStatus = 'disconnected';
const statusListeners = new Set<() => void>();

function setStatus(status: ConnectionStatus) {
  if (connectionStatus !== status) {
    connectionStatus = status;
    for (const listener of statusListeners) listener();
  }
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatus() {
  return connectionStatus;
}

export function useSocket(): Socket {
  if (!_socket) {
    _socket = io({
      withCredentials: true,
      // Start with long-polling; Socket.io will upgrade to WebSocket once
      // connected. This ordering is more reliable when WebSocket upgrades
      // through Vite's proxy fail (e.g. in Docker dev environments).
      transports: ['polling', 'websocket'],
    });

    _socket.on('connect', () => setStatus('connected'));
    _socket.on('disconnect', () => setStatus('disconnected'));
    _socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));

    // Set initial status
    if (_socket.connected) {
      setStatus('connected');
    }
  }
  return _socket;
}

export function useConnectionStatus(): ConnectionStatus {
  // Ensure socket is initialized
  useSocket();
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus);
}

export function disposeSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
