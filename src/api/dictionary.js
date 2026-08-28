/**
 * 查詢單字的所有釋義（多詞性）與繁體中文辭典翻譯。
 * 回傳：
 * {
 *   word: string,
 *   phonetic: string,
 *   meanings: [
 *     { partOfSpeech: '名詞', translation: '書、書籍', definition: '...', example: '...' },
 *     { partOfSpeech: '動詞', translation: '預訂、預約', definition: '...', example: '...' },
 *   ]
 * }
 */
export async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) throw new Error('請輸入單字');

  const [dictData, transData] = await Promise.all([
    fetchDictionary(word),
    fetchGoogleTranslate(word),
  ]);

  const englishMeanings = extractEnglishMeanings(dictData);
  const phonetic = extractPhonetic(dictData);
  const posTranslations = parsePosTranslations(transData);
  const meanings = mergeMeanings(englishMeanings, posTranslations);

  return { word, phonetic, meanings };
}

/* ─── Dictionary API ─── */

async function fetchDictionary(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Dictionary API 請求失敗:', err);
    return null;
  }
}

function extractPhonetic(data) {
  if (!data || !data[0]) return '';
  const entry = data[0];
  return (
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    ''
  );
}

function extractEnglishMeanings(data) {
  if (!data || !data[0]) return [];
  const results = [];
  const seen = new Set();

  for (const entry of data) {
    for (const m of entry.meanings || []) {
      const pos = m.partOfSpeech || '';
      if (!pos || seen.has(pos)) continue;
      seen.add(pos);

      const def = m.definitions?.[0];
      if (!def) continue;

      results.push({
        partOfSpeech: pos,
        definition: def.definition || '',
        example: def.example || '',
      });
    }
  }
  return results;
}

/* ─── Google Translate GTX ─── */

async function fetchGoogleTranslate(word) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Google Translate 請求失敗:', err);
    return null;
  }
}

function parsePosTranslations(data) {
  const map = {};
  if (!data?.[1]) return map;

  for (const group of data[1]) {
    const pos = (group[0] || '').toLowerCase();
    const terms = group[1];
    if (!pos || !Array.isArray(terms)) continue;

    const zhTerms = terms
      .filter((t) => typeof t === 'string' && t.trim())
      .slice(0, 3);
    if (zhTerms.length > 0) {
      map[pos] = zhTerms;
    }
  }
  return map;
}

/* ─── POS 對照表 ─── */

const POS_MAP = {
  noun: '名詞',
  verb: '動詞',
  adjective: '形容詞',
  adverb: '副詞',
  pronoun: '代名詞',
  preposition: '介系詞',
  conjunction: '連接詞',
  interjection: '感嘆詞',
  determiner: '限定詞',
  article: '冠詞',
  'phrasal verb': '片語動詞',
  idiom: '成語',
  suffix: '字尾',
  prefix: '字首',
};

function mapPos(pos) {
  return POS_MAP[pos.toLowerCase()] || pos;
}

/* ─── 整合 ─── */

function mergeMeanings(englishMeanings, posTranslations) {
  if (englishMeanings.length === 0) {
    return [{ partOfSpeech: '', translation: '', definition: '', example: '' }];
  }

  return englishMeanings.map((em) => {
    const posKey = em.partOfSpeech.toLowerCase();
    const zhTerms = posTranslations[posKey];
    const translation = zhTerms ? zhTerms.join('、') : '';

    return {
      partOfSpeech: mapPos(em.partOfSpeech),
      translation,
      definition: em.definition,
      example: em.example,
    };
  });
}
