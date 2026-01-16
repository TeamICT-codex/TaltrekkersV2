// FIX: Import Dispatch and SetStateAction types directly from React to avoid needing the full React namespace.
import { useState, Dispatch, SetStateAction } from 'react';

// FIX: Update the return type to use the directly imported types.
export function useLocalStorage<T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // This function now correctly handles the initial read from localStorage.
    // The useEffect that previously did this was redundant.
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    try {
      // Wrap the entire logic in the updater function form of the state setter.
      // This ensures we always have the latest state (`prevStoredValue`) to work with,
      // preventing stale state bugs when the new value is a function.
      setStoredValue(prevStoredValue => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        
        return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}