import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export function useLocalState<T>(
  key: string, 
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  // 1. Initialize state
  const [state, setState] = useState<T>(() => {
    // Create a reusable fallback for cleaner code
    const getFallback = () => {
      return typeof initialValue === 'function' 
        ? (initialValue as () => T)() 
        : initialValue;
    };

    // Immediate SSR Safety Check
    if (typeof window === 'undefined') {
      return getFallback();
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        try {
          // Try parsing as JSON (objects, arrays, numbers, booleans)
          return JSON.parse(item) as T;
        } catch {
          // If JSON.parse fails, it's a raw string! Return it directly.
          return item as unknown as T;
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }

    // Fallback if key doesn't exist or localStorage errored out
    return getFallback();
  });

  // 2. Update localStorage whenever the state changes
  useEffect(() => {
    // Added SSR safety check here as well!
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, state]);

  // 3. Return exactly what useState returns
  return [state, setState];
}