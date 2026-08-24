export function sm2(card, quality) {
  if (quality < 3) {
    card.repetition = 0;
    card.interval = 1;
  } else {
    if (card.repetition === 0) {
      card.interval = 1;
    } else if (card.repetition === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.ease_factor);
    }
    card.repetition += 1;
  }

  card.ease_factor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (card.ease_factor < 1.3) card.ease_factor = 1.3;

  const now = new Date();
  now.setDate(now.getDate() + card.interval);
  card.next_due = now.toISOString();

  return card;
}
