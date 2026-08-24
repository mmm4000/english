# Mobile PWA Design — Manifest, Speech, Layout

## PWA manifest.json

```json
{
  "name": "English Vocabulary Trainer",
  "short_name": "VocabTrainer",
  "description": "Spaced-repetition vocabulary trainer with quizzes",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Rules
- `background_color` and `theme_color` must match the app's dark mode palette.
- `display: "standalone"` removes browser chrome for app-like feel.
- `orientation: "portrait"` prevents rotation on phones.

## Web Speech API — Pronunciation

```js
function speak(text, lang = 'en-US') {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}
```

### Rules
- Always `cancel()` before a new `speak()` call to prevent queuing.
- `rate: 0.9` is slightly slower than natural — better for learners.
- Wrap in a `try/catch` with a user-visible fallback (e.g., a "play" button grays out if API unavailable).
- Use `lang = 'en-US'` by default.

## Mobile Touch-Responsive Layout

### Breakpoints
| Range | Target |
|---|---|
| < 640px | Phone (primary target) |
| 640–1024px | Tablet |
| > 1024px | Desktop |

### Touch Targets
- Minimum touch target: `44px × 44px`.
- Use `rem` or `em` for spacing, not `px`.
- Generous padding on buttons: `padding: 1rem 2rem`.

### Layout Rules
- Single-column layout on phones.
- Bottom navigation bar for mobile (fixed bottom).
- Cards use full-width with 16px horizontal padding.
- Font size: base 16px, headings scale up with `clamp()`.
- Safe area insets: `env(safe-area-inset-bottom)` for notch/edge.
