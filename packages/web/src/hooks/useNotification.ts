import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// useNotification
//
// A reusable hook for displaying temporary notifications with auto-dismiss.
// Replaces the repeated pattern of:
//   setNotification({ message, type });
//   setTimeout(() => setNotification(null), N);
//
// Usage:
//   const { notification, notify } = useNotification();
//   notify('Song added', 'success');        // defaults to 3000ms
//   notify('Error occurred', 'error', 5000); // custom timeout
// ---------------------------------------------------------------------------

export interface Notification {
  message: string;
  type: 'success' | 'error';
}

export type NotifyFn = (message: string, type: 'success' | 'error', ms?: number) => void;

export function useNotification() {
  const [notification, setNotification] = useState<Notification | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const notify = useCallback((message: string, type: 'success' | 'error', ms = 3000) => {
    // Clear any existing timeout to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setNotification({ message, type });

    timeoutRef.current = setTimeout(() => {
      setNotification(null);
      timeoutRef.current = null;
    }, ms);
  }, []);

  return { notification, notify };
}
