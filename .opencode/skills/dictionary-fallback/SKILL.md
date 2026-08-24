# Dictionary Fallback — Lookup Strategy

## Primary Source

**Free Dictionary API** (no key required), proxied via Vite dev server to avoid CORS:
```
GET /api/dict/{word}   →  proxy to  https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```

The Vite `server.proxy` rewrites `/api/dict/*` to the upstream API. In production, call the upstream URL directly or deploy your own proxy.

## Response Parsing

Extract from each entry in the response array:

| Field | Path | Required |
|---|---|---|
| phonetic | `entry.phonetic` or first matching `entry.phonetics[].text` | No |
| definition_en | first `meaning.definitions[].definition` found | Yes |
| example_en | first `meaning.definitions[].example` found across all meanings | No |

**Example search**: iterate all `entry.meanings[].definitions[]` to find the first definition with a non-empty `example` field. Do not stop at `meanings[0]`.

## Translation Source

**MyMemory Translation API** (no key required), proxied via Vite:
```
GET /api/translate/get?q={word}&langpair=en|zh-TW
```
Extract `responseData.translatedText` → `translation_zh`.

## Fallback Order

1. **Primary**: Free Dictionary API + MyMemory translation — parse phonetic, definition, example, Chinese translation.
2. **Manual fallback**: If API returns 404 or network error, show a form letting the user type phonetic, translation_zh, definition, and example by hand.

## Rules
- Always `encodeURIComponent(word)` before building the URL.
- Use `/api/dict/` proxy path in dev; never call the upstream URL from client code.
- Wrap lookup in `try/catch/finally`: `finally` must clear loading state; `catch` must show a toast and reveal the manual form.
- On HTTP 404: treat as "not found", trigger manual fallback.
- Never hardcode definitions — always fetch or let the user provide.
- Use the first `meaning` (first part of speech) from the API response.
