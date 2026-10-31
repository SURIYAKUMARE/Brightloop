import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPendingMutations, offlineDB } from '../db';
import { syncOfflineMutations } from '../api/client';

interface ConnectivityContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<any>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('brightloop_last_sync');
    return saved ? new Date(saved) : null;
  });

  const refreshPendingCount = async () => {
    try {
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    } catch (e) {
      console.warn('Error reading pending mutation count:', e);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Automatic background sync upon reconnection
      try {
        const pending = await getPendingMutations();
        if (pending.length > 0) {
          await triggerSync();
        }
      } catch (e) {
        console.warn('Auto sync on reconnect failed:', e);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingCount();

    // Periodic check every 10 seconds for pending count
    const interval = setInterval(refreshPendingCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async () => {
    if (!navigator.onLine) {
      throw new Error('Device is offline. Reconnect to the internet to synchronize.');
    }
    setIsSyncing(true);
    try {
      const res = await syncOfflineMutations();
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('brightloop_last_sync', now.toISOString());
      await refreshPendingCount();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        lastSyncTime,
        triggerSync,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error('useConnectivity must be used within a ConnectivityProvider');
  return context;
};
