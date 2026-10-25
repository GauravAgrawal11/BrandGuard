import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config/api';

const ServerHealthContext = createContext(null);

export function ServerHealthProvider({ children }) {
  // 'checking' | 'online' | 'waking' | 'offline'
  const [status, setStatus] = useState('checking');
  const [latency, setLatency] = useState(null);
  const [wakingElapsed, setWakingElapsed] = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  const [serverData, setServerData] = useState(null);
  const [isWakingBannerDismissed, setIsWakingBannerDismissed] = useState(false);

  const wakingTimerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);

  // Ping the server endpoint
  const checkHealth = useCallback(async (isInitial = false) => {
    const startTime = performance.now();
    const controller = new AbortController();
    // 3.5s timeout for fast responsiveness - if Render is sleeping, it will abort and show waking indicator
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(`${API_BASE}/api/health/`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const duration = Math.round(performance.now() - startTime);
        setLatency(duration);
        setStatus('online');
        setServerData(data);
        setLastChecked(new Date());
        setWakingElapsed(0);
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // If request timed out (Render free tier cold start) or failed connection
      setStatus('waking');
      return false;
    }
  }, []);

  // Waking counter and aggressive polling when waking
  useEffect(() => {
    if (status === 'waking') {
      // Start seconds counter
      if (!wakingTimerRef.current) {
        wakingTimerRef.current = setInterval(() => {
          setWakingElapsed((prev) => prev + 1);
        }, 1000);
      }

      // Retry every 3 seconds to catch the moment it wakes up
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(async () => {
          const success = await checkHealth();
          if (success) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            clearInterval(wakingTimerRef.current);
            wakingTimerRef.current = null;
          }
        }, 3000);
      }
    } else {
      if (wakingTimerRef.current) {
        clearInterval(wakingTimerRef.current);
        wakingTimerRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (wakingTimerRef.current) clearInterval(wakingTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [status, checkHealth]);

  // Keep-Alive Heartbeat: Pings every 8 minutes while tab is open to prevent Render 15-minute hibernation
  useEffect(() => {
    // Initial check on mount
    checkHealth(true);

    // Keep-alive every 8 minutes (480,000ms)
    keepAliveIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkHealth();
      }
    }, 480000);

    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkHealth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkHealth]);

  const wakeServer = () => {
    setStatus('waking');
    setWakingElapsed(0);
    setIsWakingBannerDismissed(false);
    checkHealth();
  };

  return (
    <ServerHealthContext.Provider
      value={{
        status, // 'checking' | 'online' | 'waking' | 'offline'
        latency,
        wakingElapsed,
        lastChecked,
        serverData,
        isWakingBannerDismissed,
        setIsWakingBannerDismissed,
        checkHealth,
        wakeServer
      }}
    >
      {children}
    </ServerHealthContext.Provider>
  );
}

export function useServerHealth() {
  const context = useContext(ServerHealthContext);
  if (!context) {
    throw new Error('useServerHealth must be used within a ServerHealthProvider');
  }
  return context;
}
