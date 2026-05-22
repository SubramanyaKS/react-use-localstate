import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export function useLocalState<T>(
  key: string, 
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  
  // Initial State
  const [state, setState] = useState<T>(() => {
    return typeof initialValue === 'function' 
      ? (initialValue as () => T)() 
      : initialValue;
  });

  // Fetch from LocalStorage on Mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        try {
          setState(JSON.parse(item) as T);
        } catch {
          setState(item as unknown as T);
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Persist state changes to LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, state]);

  // Sync with other browser tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch {
          setState(e.newValue as unknown as T);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setState];
}