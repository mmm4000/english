/**
 * 查詢單字的所有釋義（多詞性）與繁體中文辭典翻譯。
 * 回傳：
 * {
 *   word: string,
 *   phonetic: string,
 *   meanings: [
 *     { partOfSpeech: '名詞', translation: '書、書籍', definition: '...', example: '...' },
 *     { partOfSpeech: '動詞', translation: '預訂、預約', definition: '...', example: '...' },
 *     ...
 *   ]
 * }
 */
export async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) throw new Error('請輸入單字');

  // 1. 並行請求 Dictionary API + Google Translate GTX
  const [dictData, transData] = await Promise.all([
    fetchDictionary(word),
    fetchGoogleTranslate(word),
  ]);

  // 2. 從 Dictionary API 提取所有 meanings（每個詞性一個）
  const englishMeanings = extractEnglishMeanings(dictData);
  const phonetic = extractPhonetic(dictData);

  // 3. 從 Google GTX 提取各詞性的中文辭典釋義
  const posTranslations = parsePosTranslations(transData);

  // 4. 整合：將英文釋義與中文辭典對應
  const meanings = mergeMeanings(englishMeanings, posTranslations, word);

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

/**
 * 從 Dictionary API 回傳中提取所有 meanings，
 * 每個 partOfSpeech 取第一個有 definition 的項目。
 */
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

/**
 * 解析 Google GTX 的 res[1]（辭典結構），
 * 回傳 { noun: ['書','書籍','本子'], verb: ['預訂','預約'], ... }
 */
function parsePosTranslations(data) {
  const map = {};
  if (!data?.[1]) return map;

  for (const group of data[1]) {
    // group[0] = 詞類英文 (noun, verb, adjective, ...)
    // group[1] = 該詞性下的中文釋義陣列
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

/**
 * 將英文釋義與中文辭典翻譯合併。
 * 若 GTX 有該詞性的辭典釋義，優先使用；
 * 否則 fallback 為空白（讓 UI 顯示「暫無中文釋義」）。
 */
function mergeMeanings(englishMeanings, posTranslations, word) {
  if (englishMeanings.length === 0) {
    // 完全查不到時，嘗試用 GTX 的直譯做一個保底項
    return [
      {
        partOfSpeech: '',
        translation: '',
        definition: '',
        example: '',
      },
    ];
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
