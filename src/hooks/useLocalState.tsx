import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';

export function useLocalState<T>(
  key: string, 
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>, () => void] {
  
  const isClearingRef = useRef(false);

  // Standardized error handler
  const handleStorageError = (operation: string, error: Error | unknown) => {
    if (error instanceof DOMException && error.code === 22) {
      console.warn(`[useLocalState] localStorage quota exceeded for key "${key}"`);
    } else {
      console.warn(`[useLocalState] ${operation} failed for key "${key}":`, error);
    }
  };

  // Safe JSON parser - avoids unsafe double casting
  const safeJsonParse = (item: string): T | null => {
    try {
      return JSON.parse(item) as T;
    } catch {
      // Fallback: treat as raw string/value
      return item as T;
    }
  };

  // Initial State
  const [state, setState] = useState<T>(() => {
    return typeof initialValue === 'function' 
      ? (initialValue as () => T)() 
      : initialValue;
  });

  // Fetch from LocalStorage on Mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        const parsed = safeJsonParse(item);
        if (parsed !== null) {
          setState(parsed);
        }
      }
    } catch (error) {
      handleStorageError('reading localStorage', error);
    }
  }, [key]);

  // Persist state changes to LocalStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isClearingRef.current) {
      isClearingRef.current = false;
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      handleStorageError('writing to localStorage', error);
    }
  }, [key, state]);

  // Sync with other browser tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        const parsed = safeJsonParse(e.newValue);
        if (parsed !== null) {
          setState(parsed);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  // Clear state and remove from localStorage
  const clearState = () => {
    if (typeof window === 'undefined') return;

    try {
      // Mark that we're clearing to skip the persist effect
      isClearingRef.current = true;
      window.localStorage.removeItem(key);
      setState(
        typeof initialValue === 'function' 
          ? (initialValue as () => T)() 
          : initialValue
      );
    } catch (error) {
      isClearingRef.current = false;
      handleStorageError('clearing localStorage', error);
    }
  };

  return [state, setState, clearState];
}