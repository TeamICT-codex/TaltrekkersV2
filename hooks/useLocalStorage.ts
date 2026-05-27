import { useState, useCallback, Dispatch, SetStateAction } from 'react';

export function useLocalStorage<T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
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

  const setValue: Dispatch<SetStateAction<T>> = useCallback((value) => {
    try {
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
  }, [key]);

  return [storedValue, setValue];
}
