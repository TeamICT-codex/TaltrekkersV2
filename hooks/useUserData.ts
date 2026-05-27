import { useCallback } from 'react';
import { AllUsersData, UserData } from '../types';
import { useLocalStorage } from './useLocalStorage';

type UserDataInput = UserData | ((prev: UserData | undefined) => UserData);

/**
 * Hook voor alle CRUD-operaties op gebruikersdata.
 * Beheert de localStorage-gebaseerde `allUsersData` en biedt
 * granulaire functies aan voor sessies, avatars en gebruikers.
 */
export function useUserData() {
  const [allUsersData, setAllUsersData] = useLocalStorage<AllUsersData>('taaltrekkers-data-v2', {});

  /** Haal data op voor een specifieke gebruiker */
  const getUserData = useCallback((userName: string): UserData | undefined => {
    return allUsersData[userName.toLowerCase().trim()];
  }, [allUsersData]);

  /** Generieke updater: past een gebruiker aan via een callback */
  const updateUser = useCallback((userName: string, updater: (prev: UserData) => UserData) => {
    setAllUsersData(prevData => {
      const key = userName.toLowerCase().trim();
      const existing = prevData[key];
      if (!existing) return prevData;
      return {
        ...prevData,
        [key]: updater(existing),
      };
    });
  }, [setAllUsersData]);

  /**
   * Sla een UserData-object op. Accepteert ofwel een direct object,
   * ofwel een updater-functie die de actuele state ontvangt — onmisbaar
   * om stale state te voorkomen bij meerdere opeenvolgende updates in
   * dezelfde async flow (zie usePracticeSession.finishPractice).
   */
  const setUserData = useCallback((userName: string, input: UserDataInput) => {
    setAllUsersData(prevData => {
      const key = userName.toLowerCase().trim();
      const next = typeof input === 'function' ? input(prevData[key]) : input;
      return { ...prevData, [key]: next };
    });
  }, [setAllUsersData]);

  /** Verwijder een enkele sessie uit de geschiedenis */
  const deleteSession = useCallback((userName: string, sessionDate: string) => {
    updateUser(userName, user => ({
      ...user,
      sessionHistory: user.sessionHistory.filter(s => s.date !== sessionDate),
    }));
  }, [updateUser]);

  /** Verwijder alle data voor een gebruiker */
  const deleteUserData = useCallback((userName: string) => {
    setAllUsersData(prevData => {
      const newData = { ...prevData };
      delete newData[userName.toLowerCase().trim()];
      return newData;
    });
  }, [setAllUsersData]);

  /** Verander de avatar van een gebruiker */
  const updateAvatar = useCallback((userName: string, avatarId: string) => {
    updateUser(userName, user => ({ ...user, avatarId }));
  }, [updateUser]);

  return {
    allUsersData,
    getUserData,
    setUserData,
    updateUser,
    deleteSession,
    deleteUserData,
    updateAvatar,
  };
}
