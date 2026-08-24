# AGENTS.md

## Stack
- Vanilla JS (ES modules) + Vite 5 + idb (IndexedDB wrapper)
- PWA with Web Speech API for pronunciation
- SM-2 spaced repetition for scheduling

## Commands
- `npm install` — install deps (idb, vite)
- `npm run dev` — dev server on 0.0.0.0:5173
- `npm run build` — production build to `dist/`
- `npm run preview` — preview built app

## Key files
- `src/db/scheduler.js` — SM-2 algorithm (`sm2(card, quality)`)
- `src/db/index.js` — IndexedDB CRUD (openDB, getAllCards, addCard, updateCard, deleteCard, getCard)
- `src/main.js` — full UI: home, add word (dictionary API lookup), 3 quiz modes
- `.opencode/skills/` — skill definitions (spaced-repetition, dictionary-fallback, quiz-generator, mobile-pwa-design)

## Conventions
- All card fields: id (UUID), word, phonetic, translation_zh, definition_en, example_en, repetition, interval, ease_factor, next_due (ISO-8601)
- Quality ratings: 0–2 = fail (reset), 3–5 = pass (advance)
- Dictionary lookup: Free Dictionary API → `/api/dict` proxy; MyMemory translation → `/api/translate` proxy; manual fallback on 404
- No frameworks — plain DOM manipulation via innerHTML
- Single-file UI in `src/main.js` (intentionally monolithic for simplicity)
