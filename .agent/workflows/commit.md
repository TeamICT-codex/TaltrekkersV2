---
description: Hoe je wijzigingen opslaat met Git
---

# Git Commit Workflow

## Wanneer een commit maken?
- ✅ Na elke werkende feature of fix
- ✅ Voordat je aan iets nieuws begint
- ✅ Aan het einde van een werksessie

## Stappen voor een commit

### 1. Bekijk wat er gewijzigd is
// turbo
```bash
git status
```

### 2. Voeg alle wijzigingen toe
// turbo
```bash
git add -A
```

### 3. Maak de commit met een duidelijke beschrijving
```bash
git commit -m "Korte beschrijving van wat je deed"
```

**Goede commit messages:**
- "Logo toegevoegd aan header"
- "Quiz scoring verbeterd met tijdbonus"
- "Bug gefixt in flashcard flip animatie"
- "Spaced repetition geïmplementeerd"

**Slechte commit messages:**
- "update"
- "fix"
- "changes"

## Geschiedenis bekijken
// turbo
```bash
git log --oneline -10
```

## Terug naar vorige versie (als iets kapot is)
```bash
git checkout .
```
Dit zet ALLE niet-gecommitte wijzigingen terug.

## Tips
- Commit VAAK - liever te veel dan te weinig
- Test altijd of de app werkt voordat je commit
- Gebruik Nederlandse of Engelse beschrijvingen, maar wees consistent
