# Spaced Repetition — SM-2 Algorithm

## SM-2 Variables

| Field | Type | Default | Description |
|---|---|---|---|
| `repetition` | integer | `0` | Consecutive correct recalls |
| `interval` | integer (days) | `1` | Days until next review |
| `ease_factor` | float | `2.5` | Difficulty modifier, min 1.3 |
| `next_due` | ISO-8601 string | now + 1 day | Scheduled review timestamp |

## Quality Ratings

| Rating | Meaning | Effect |
|---|---|---|
| 0 | Complete blackout | Reset repetition to 0 |
| 1 | Wrong, but remembered after seeing answer | Reset repetition to 0 |
| 2 | Wrong, but the answer felt close | Reset repetition to 0 |
| 3 | Correct with serious difficulty | repetition + 1, recalculate interval |
| 4 | Correct after hesitation | repetition + 1, recalculate interval |
| 5 | Perfect recall | repetition + 1, recalculate interval |

## Algorithm

```
function sm2(card, quality):
  if quality < 3:
    card.repetition = 0
    card.interval = 1
  else:
    if card.repetition == 0:
      card.interval = 1
    else if card.repetition == 1:
      card.interval = 6
    else:
      card.interval = round(card.interval * card.ease_factor)

    card.repetition += 1

  card.ease_factor = card.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if card.ease_factor < 1.3:
    card.ease_factor = 1.3

  card.next_due = now() + card.interval days

  return card
```

## Card Schema (IndexedDB)

```js
{
  id:             string (auto-generated UUID),
  word:           string (lowercase, trimmed),
  phonetic:       string (optional),
  translation_zh: string (繁體中文翻譯, optional),
  definition_en:  string,
  example_en:     string,
  repetition:     integer,
  interval:       integer,
  ease_factor:    float,
  next_due:       string (ISO-8601)
}
```

## Index: `idx_next_due` on `next_due` for efficient "cards due today" queries.

## Rules
- A card is "due" when `next_due <= now()`.
- All math operates on the card object in place and returns it.
- Never mutate external state inside `sm2()`.
