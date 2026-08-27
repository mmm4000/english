const TATOEBA_API = 'https://tatoeba.org/en/api_v0/search';

export async function fetchTatoebaExamples(word) {
  try {
    const res = await fetch(`${TATOEBA_API}?from=eng&to=cmn&query=${encodeURIComponent(word)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    for (const r of data.results || []) {
      if (r.text && r.translations?.[0]?.length > 0) {
        results.push({
          example_en: r.text,
          example_zh: r.translations[0][0].text || '',
        });
      }
    }
    return results;
  } catch (e) {
    console.log('[Tatoeba] fetch error:', e.message);
    return [];
  }
}

export async function fetchTatoebaExample(word) {
  const results = await fetchTatoebaExamples(word);
  return results[0] || null;
}
