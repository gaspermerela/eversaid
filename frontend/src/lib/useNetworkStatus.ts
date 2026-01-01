'use client'

import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  isOnline: boolean
  isOffline: boolean
}

/**
 * Hook to track network connectivity status.
 * Uses navigator.onLine API with online/offline events.
 * SSR-safe: defaults to online on server.
 */
export function useNetworkStatus(): NetworkStatus {
  // Default to online for SSR
  const [isOnline, setIsOnline] = useState(true)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
  }, [])

  useEffect(() => {
    // Set initial state from navigator (client-side only)
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe initialization
      setIsOnline(navigator.onLine)
    }

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return {
    isOnline,
    isOffline: !isOnline,
  }
}
