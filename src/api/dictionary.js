import { getVerbForms } from '../utils/conjugations.js';

/**
 * 查詢單字的所有釋義（多詞性）與繁體中文辭典翻譯。
 * 回傳：
 * {
 *   word: string,
 *   phonetic: string,
 *   verb_forms: { base, third, past_tense, past_participle, present_participle } | null,
 *   meanings: [
 *     { partOfSpeech: '名詞', translation: '書、書籍', definition: '...', example: '...' },
 *   ]
 * }
 */
export async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  console.log(`[Lookup Debug] 1. 開始查詢單字: "${word}"`);
  if (!word) throw new Error('請輸入單字');

  // 並行請求 Datamuse + Google Translate
  console.log(`[Lookup Debug] 2. 同時發起 Datamuse + Google Translate 請求`);
  const [datamuseData, transData] = await Promise.all([
    fetchDatamuse(word),
    fetchGoogleTranslate(word),
  ]);

  // 音標：Datamuse IPA 優先，Wiktionary 備用
  console.log(`[Lookup Debug] 3. 取得音標`);
  let phonetic = extractDatamuseIPA(datamuseData);
  if (!phonetic) {
    phonetic = await fetchWiktionaryPhonetic(word);
  }
  console.log(`[Lookup Debug] 3-1. 最終 phonetic:`, phonetic);

  // 動詞變化：使用本地規則推導
  console.log(`[Lookup Debug] 4. 推導動詞變化`);
  const hasVerbPOS = hasVerbInGTX(transData);
  const verbForms = hasVerbPOS ? getVerbForms(word) : null;
  console.log(`[Lookup Debug] 4-1. hasVerbPOS:`, hasVerbPOS, `verbForms:`, verbForms);

  // Datamuse 英文定義
  const datamuseDefs = extractDatamuseDefs(datamuseData);
  console.log(`[Lookup Debug] 5. datamuseDefs:`, datamuseDefs);

  // Google GTX 辭典
  console.log(`[Lookup Debug] 6. 解析 Google GTX 辭典結果`);
  const posTranslations = parsePosTranslations(transData);
  console.log(`[Lookup Debug] 6-1. parsePosTranslations 回傳:`, posTranslations);

  // 整合
  console.log(`[Lookup Debug] 7. 執行 mergeMeanings 整合`);
  const meanings = mergeMeanings(datamuseDefs, posTranslations, word);
  console.log(`[Lookup Debug] 7-1. mergeMeanings 最終結果:`, meanings);

  const result = { word, phonetic, verb_forms: verbForms, meanings };
  console.log(`[Lookup Debug] 8. lookupWord 最終回傳:`, result);
  return result;
}

/* ─── Datamuse API (主要來源，無 CORS) ─── */

async function fetchDatamuse(word) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r,d,p&ipa=1&max=1`;
  console.log(`[Lookup Debug] 2-A. 請求 Datamuse API: ${url}`);
  try {
    const res = await fetch(url);
    console.log(`[Lookup Debug] 2-A-1. Datamuse HTTP 狀態碼:`, res.status, res.statusText);
    if (!res.ok) return null;
    const data = await res.json();
    console.log(`[Lookup Debug] 2-A-2. Datamuse 原始回傳:`, data);
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-A-3. Datamuse 例外錯誤:`, err.message);
    return null;
  }
}

function extractDatamuseIPA(data) {
  if (!data || !data[0]) return '';
  const item = data[0];
  // 從 tags 中提取 ipa_pron
  if (item.tags) {
    for (const tag of item.tags) {
      if (typeof tag === 'string' && tag.startsWith('ipa_pron:')) {
        const ipa = tag.slice(9);
        return ipa ? `/${ipa}/` : '';
      }
    }
  }
  // 備用：pronunciation
  if (item.pronunciation) {
    return `/${item.pronunciation}/`;
  }
  return '';
}

function extractDatamuseDefs(data) {
  if (!data || !data[0] || !data[0].defs) return {};
  const map = {};
  for (const item of data) {
    if (!item.defs) continue;
    for (const d of item.defs) {
      const pos = (d.pos || '').toLowerCase();
      const def = d.def || '';
      if (!pos || !def) continue;
      if (!map[pos]) map[pos] = def;
    }
  }
  console.log(`[Lookup Debug] 3-C. extractDatamuseDefs:`, map);
  return map;
}

/* ─── Wiktionary REST API (音標備用，無 CORS) ─── */

async function fetchWiktionaryPhonetic(word) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  console.log(`[Lookup Debug] 3-B. 請求 Wiktionary (音標備用): ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`[Lookup Debug] 3-B-1. Wiktionary 回傳非 200`);
      return '';
    }
    const data = await res.json();
    // 從 html 中提取 IPA：找到 /.../ 模式
    const html = data?.en?.[0]?.definitions?.[0]?.definition || '';
    const ipaMatch = html.match(/\/[^/]+\/|[^\s]*[ˈˌ][^\s]*/);
    if (ipaMatch) {
      const ipa = ipaMatch[0];
      console.log(`[Lookup Debug] 3-B-2. Wiktionary 提取到音標:`, ipa);
      return ipa.startsWith('/') ? ipa : `/${ipa}/`;
    }
    console.log(`[Lookup Debug] 3-B-3. Wiktionary 無音標資料`);
  } catch (err) {
    console.error(`[Lookup Debug] 3-B-4. Wiktionary 例外錯誤:`, err.message);
  }
  return '';
}

/* ─── Google Translate GTX ─── */

async function fetchGoogleTranslate(word) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
  console.log(`[Lookup Debug] 2-B. 請求 Google Translate GTX: ${url}`);
  try {
    const res = await fetch(url);
    console.log(`[Lookup Debug] 2-B-1. Google Translate HTTP 狀態碼:`, res.status, res.statusText);
    if (!res.ok) {
      console.warn(`[Lookup Debug] 2-B-2. Google Translate 回傳非 200，略過`);
      return null;
    }
    const data = await res.json();
    console.log(`[Lookup Debug] 2-B-3. Google Translate 原始 JSON (前 800 字元):`, JSON.stringify(data).slice(0, 800));
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-B-4. Google Translate 例外錯誤:`, err);
    return null;
  }
}

function hasVerbInGTX(data) {
  if (!data?.[1]) return false;
  return data[1].some(g => (g[0] || '').toLowerCase() === '動詞' || (g[0] || '').toLowerCase() === 'verb');
}

function parsePosTranslations(data) {
  const map = {};
  if (!data?.[1]) {
    console.log(`[Lookup Debug] 6-A. parsePosTranslations: data[1] 不存在，回傳空物件`);
    return map;
  }

  console.log(`[Lookup Debug] 6-A. parsePosTranslations: data[1] 共 ${data[1].length} 組詞性群組`);
  for (const group of data[1]) {
    const rawPos = group[0] || '';
    const terms = group[1];
    const pos = /[\u4e00-\u9fff]/.test(rawPos) ? rawPos : rawPos.toLowerCase();
    console.log(`[Lookup Debug] 6-A-1. 詞性群組: pos="${pos}", terms=`, terms);
    if (!pos || !Array.isArray(terms)) continue;

    const zhTerms = terms
      .filter((t) => typeof t === 'string' && t.trim())
      .slice(0, 3);
    console.log(`[Lookup Debug] 6-A-2. 篩選後 zhTerms (前3個):`, zhTerms);
    if (zhTerms.length > 0) {
      map[pos] = zhTerms;
    }
  }
  console.log(`[Lookup Debug] 6-A-3. parsePosTranslations 最終結果:`, map);
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

const REVERSE_POS_MAP = {};
for (const [en, zh] of Object.entries(POS_MAP)) {
  REVERSE_POS_MAP[zh] = en;
}

function mapPos(pos) {
  const lower = (pos || '').toLowerCase();
  return POS_MAP[lower] || pos;
}

/* ─── 整合：以 Google GTX 詞性為骨架 ─── */

function autoGenerateExample(word, posKey) {
  const pos = (posKey || '').toLowerCase();
  if (pos === 'noun' || pos === '名詞') return `This is a useful ${word}.`;
  if (pos === 'verb' || pos === '動詞') return `I need to ${word} it tomorrow.`;
  if (pos === 'adjective' || pos === '形容詞') return `It is very ${word}.`;
  if (pos === 'adverb' || pos === '副詞') return `She did it very ${word}.`;
  return `The word "${word}" is important.`;
}

function mergeMeanings(datamuseDefs, posTranslations, word) {
  const gtxKeys = Object.keys(posTranslations);
  console.log(`[Lookup Debug] 7-A. mergeMeanings: gtxKeys=`, gtxKeys);

  if (gtxKeys.length > 0) {
    console.log(`[Lookup Debug] 7-B. mergeMeanings: 以 GTX 詞性為骨架 (共 ${gtxKeys.length} 個詞性)`);
    const merged = gtxKeys.map((posKey) => {
      const zhTerms = posTranslations[posKey];
      const translation = zhTerms ? zhTerms.join('、') : '';
      const zhPosLabel = mapPos(posKey);

      // Datamuse 英文定義
      const enPosKey = REVERSE_POS_MAP[posKey] || posKey.toLowerCase();
      let definition = datamuseDefs[enPosKey] || '';

      const example = word ? autoGenerateExample(word, posKey) : '';

      if (!definition && translation) {
        definition = `[${zhPosLabel}] ${translation}`;
      }

      console.log(`[Lookup Debug] 7-C. posKey="${posKey}" => translation="${translation}", definition="${definition.slice(0, 60)}"`);
      return {
        partOfSpeech: zhPosLabel,
        translation,
        definition,
        example,
      };
    });
    console.log(`[Lookup Debug] 7-D. mergeMeanings 完成，共 ${merged.length} 筆`, merged);
    return merged;
  }

  console.log(`[Lookup Debug] 7-E. mergeMeanings: 無 GTX 資料，產生保底項`);
  return [
    {
      partOfSpeech: '',
      translation: '',
      definition: word ? `The word "${word}"` : '',
      example: word ? `This is a ${word}.` : '',
    },
  ];
}
