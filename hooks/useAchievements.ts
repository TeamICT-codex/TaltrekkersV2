import { useState, useCallback } from 'react';
import { UserData, WordMasteryInfo } from '../types';
import { WORD_LISTS_METADATA, loadWordList } from '../constants';

export interface CelebrationData {
  show: boolean;
  listName: string;
  type: 'practiced' | 'mastered';
  totalWords: number;
  bonusPoints: number;
}

interface AchievementResult {
  achievementId: string;
  bonusPoints: number;
}

/**
 * Hook voor het detecteren en tonen van achievements (lijst voltooid / gemeesterd).
 * Puur UI-gericht: detecteert of een achievement nieuw is en toont een celebration.
 */
export function useAchievements() {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  /**
   * Controleer of een woordenlijst net volledig geoefend of gemeesterd is.
   * Geeft een AchievementResult terug als er een nieuw achievement is, anders null.
   */
  const checkAchievements = useCallback(async (
    currentUserData: UserData,
    listId: string,
    practicedWordSet: Set<string>,
    updatedLearnedWords: Record<string, WordMasteryInfo>,
  ): Promise<AchievementResult | null> => {
    const metadata = WORD_LISTS_METADATA[listId];
    if (!metadata) return null;

    const fullWordList = await loadWordList(listId);
    if (fullWordList.length === 0) return null;

    const previouslyUnlocked = currentUserData.achievementsUnlocked || [];
    const practicedAchievementId = `${listId}-practiced`;
    const masteredAchievementId = `${listId}-mastered`;

    // Tel gemeesterde woorden (correct > 0, incorrect === 0)
    let masteredCount = 0;
    fullWordList.forEach(word => {
      const wordKey = word.toLowerCase();
      const wordInfo = updatedLearnedWords[wordKey];
      if (wordInfo && wordInfo.correct > 0 && wordInfo.incorrect === 0) {
        masteredCount++;
      }
    });

    const isFullyPracticed = practicedWordSet.size >= fullWordList.length;
    const isFullyMastered = masteredCount >= fullWordList.length;

    // Mastered heeft prioriteit boven practiced
    if (isFullyMastered && !previouslyUnlocked.includes(masteredAchievementId)) {
      setTimeout(() => {
        setCelebration({
          show: true,
          listName: listId,
          type: 'mastered',
          totalWords: fullWordList.length,
          bonusPoints: 500,
        });
      }, 500);
      return { achievementId: masteredAchievementId, bonusPoints: 500 };
    }

    if (isFullyPracticed && !previouslyUnlocked.includes(practicedAchievementId)) {
      setTimeout(() => {
        setCelebration({
          show: true,
          listName: listId,
          type: 'practiced',
          totalWords: fullWordList.length,
          bonusPoints: 100,
        });
      }, 500);
      return { achievementId: practicedAchievementId, bonusPoints: 100 };
    }

    return null;
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return {
    celebration,
    checkAchievements,
    dismissCelebration,
  };
}
