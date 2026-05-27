/**
 * Fisher-Yates shuffle: returnt een nieuwe array, muteert het origineel niet.
 * Onbevooroordeeld in tegenstelling tot `arr.sort(() => Math.random() - 0.5)`.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const newArray = array.slice();
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
