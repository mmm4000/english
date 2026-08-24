# Quiz Generator — Three Modes

## Mode 1: Flashcard Flip

**UI**: Large card with `word` on front; tap/press to flip and reveal `definition_en` + `example_en`.

**Flow**:
1. User taps the card.
2. Front (word) flips to back (definition + example).
3. User self-rates: Again (0), Hard (2), Good (3), Easy (5).
4. `sm2(card, quality)` is called; card persists to IndexedDB.
5. Advance to next due card.

**Empty state**: "No cards due for review — add words first."

## Mode 2: Fill-in-the-Blank (4 choices)

**UI**: Sentence with the target word blanked out as `______`; 4 options below.

**Generation logic**:
1. Pick a due card's `example_en`.
2. Replace the card's `word` (case-insensitive, whole word only) with `______` in the sentence.
3. Select the correct word as option A.
4. Pick 3 random distractors from other cards in the deck.
5. Shuffle all 4 options.

**Scoring**:
- Correct → `sm2(card, 4)`.
- Wrong → `sm2(card, 0)`, then reveal the correct answer.

## Mode 3: Listening

**UI**: Play pronunciation audio; user types the word in an input field.

**Flow**:
1. Pick a due card.
2. Call `speechSynthesis.speak(card.word)` using Web Speech API.
3. User types their guess.
4. Compare `guess.trim().toLowerCase()` against `card.word`.
5. If match → `sm2(card, 5)`. If mismatch → `sm2(card, 0)`, show correct word.

**Repeat button**: User can tap to hear again.

## Post-Quiz
After all due cards are processed, show summary:
- Cards reviewed
- Average ease factor
- Next review date (earliest `next_due` among reviewed cards)

Persist all updated cards to IndexedDB in a single batch.
