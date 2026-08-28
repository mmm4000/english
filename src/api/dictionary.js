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

  // 並行請求三個來源
  console.log(`[Lookup Debug] 2. 同時發起 Dictionary API (CORS proxy) + Datamuse + Google Translate 請求`);
  const [dictData, datamuseData, transData] = await Promise.all([
    fetchDictionary(word),
    fetchDatamuse(word),
    fetchGoogleTranslate(word),
  ]);

  // 解析各來源
  console.log(`[Lookup Debug] 3. 解析各來源結果`);
  const englishMeanings = extractEnglishMeanings(dictData);
  const phonetic = extractPhonetic(dictData) || extractDatamusePhonetic(datamuseData);
  const verbForms = extractVerbForms(dictData, word);
  const datamuseDefs = extractDatamuseDefs(datamuseData);
  console.log(`[Lookup Debug] 3-1. phonetic:`, phonetic);
  console.log(`[Lookup Debug] 3-2. verbForms:`, verbForms);
  console.log(`[Lookup Debug] 3-3. englishMeanings (Dictionary API):`, englishMeanings);
  console.log(`[Lookup Debug] 3-4. datamuseDefs (Datamuse fallback):`, datamuseDefs);

  // 解析 Google GTX 辭典結果
  console.log(`[Lookup Debug] 4. 解析 Google GTX 辭典結果`);
  const posTranslations = parsePosTranslations(transData);
  console.log(`[Lookup Debug] 4-1. parsePosTranslations 回傳:`, posTranslations);

  // 整合：以 Google GTX 詞性為骨架
  console.log(`[Lookup Debug] 5. 執行 mergeMeanings 整合 (以 GTX 詞性為骨架)`);
  const meanings = mergeMeanings(englishMeanings, datamuseDefs, posTranslations, word);
  console.log(`[Lookup Debug] 5-1. mergeMeanings 最終結果:`, meanings);

  const result = { word, phonetic, verb_forms: verbForms, meanings };
  console.log(`[Lookup Debug] 6. lookupWord 最終回傳:`, result);
  return result;
}

/* ─── Dictionary API (透過 CORS proxy) ─── */

async function fetchDictionary(word) {
  const target = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const url = `https://corsproxy.io/?url=${encodeURIComponent(target)}`;
  console.log(`[Lookup Debug] 2-A. 請求 Dictionary API (via corsproxy.io):`, url);
  try {
    const res = await fetch(url);
    console.log(`[Lookup Debug] 2-A-1. Dictionary API HTTP 狀態碼:`, res.status, res.statusText);
    if (!res.ok) {
      console.warn(`[Lookup Debug] 2-A-2. Dictionary API 回傳非 200，略過`);
      return null;
    }
    const data = await res.json();
    console.log(`[Lookup Debug] 2-A-3. Dictionary API 原始 JSON (前 500 字元):`, JSON.stringify(data).slice(0, 500));
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-A-4. Dictionary API 例外錯誤:`, err.message);
    return null;
  }
}

function extractPhonetic(data) {
  if (!data || !data[0]) {
    console.log(`[Lookup Debug] 3-A. extractPhonetic: 無 Dictionary 資料`);
    return '';
  }
  const entry = data[0];
  const result =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    '';
  console.log(`[Lookup Debug] 3-A. extractPhonetic: =>`, result);
  return result;
}

function extractEnglishMeanings(data) {
  if (!data || !data[0]) {
    console.log(`[Lookup Debug] 3-B. extractEnglishMeanings: 無 Dictionary 資料，回傳空陣列`);
    return [];
  }
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
  console.log(`[Lookup Debug] 3-B. extractEnglishMeanings: 共提取 ${results.length} 個詞性`, results);
  return results;
}

function extractVerbForms(data, word) {
  if (!data || !data[0]) {
    console.log(`[Lookup Debug] 3-D. extractVerbForms: 無 Dictionary 資料`);
    return null;
  }
  for (const entry of data) {
    for (const m of entry.meanings || []) {
      if (m.partOfSpeech !== 'verb') continue;
      const forms = {};
      for (const def of m.definitions || []) {
        if (def.forms) {
          for (const f of def.forms) {
            if (f.form && f.form !== word) {
              const label = (f.form || '').toLowerCase();
              if (label.includes('past tense')) forms.past_tense = f.form;
              else if (label.includes('past participle')) forms.past_participle = f.form;
              else if (label.includes('present participle')) forms.present_participle = f.form;
              else if (label.includes('third person singular')) forms.third = f.form;
              else if (label.includes('plural')) forms.plural = f.form;
            }
          }
        }
      }
      if (Object.keys(forms).length > 0) {
        forms.base = word;
        if (!forms.third) forms.third = word + 's';
        if (!forms.past_tense) forms.past_tense = word + 'ed';
        if (!forms.past_participle) forms.past_participle = word + 'ed';
        if (!forms.present_participle) forms.present_participle = word + 'ing';
        console.log(`[Lookup Debug] 3-D. extractVerbForms: 從 Dictionary API 提取到動詞變化`, forms);
        return forms;
      }
    }
  }
  console.log(`[Lookup Debug] 3-D. extractVerbForms: Dictionary API 無動詞變化資料`);
  return null;
}

/* ─── Datamuse API (備用英文辭典，無 CORS) ─── */

async function fetchDatamuse(word) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d`;
  console.log(`[Lookup Debug] 2-C. 請求 Datamuse API (fallback): ${url}`);
  try {
    const res = await fetch(url);
    console.log(`[Lookup Debug] 2-C-1. Datamuse HTTP 狀態碼:`, res.status, res.statusText);
    if (!res.ok) {
      console.warn(`[Lookup Debug] 2-C-2. Datamuse 回傳非 200`);
      return null;
    }
    const data = await res.json();
    console.log(`[Lookup Debug] 2-C-3. Datamuse 原始回傳:`, data);
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-C-4. Datamuse 例外錯誤:`, err.message);
    return null;
  }
}

function extractDatamusePhonetic(data) {
  if (!data || !data[0]) return '';
  return data[0].soundsLike || '';
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

function parsePosTranslations(data) {
  const map = {};
  if (!data?.[1]) {
    console.log(`[Lookup Debug] 4-A. parsePosTranslations: data[1] 不存在，回傳空物件`);
    return map;
  }

  console.log(`[Lookup Debug] 4-A. parsePosTranslations: data[1] 共 ${data[1].length} 組詞性群組`);
  for (const group of data[1]) {
    const rawPos = group[0] || '';
    const terms = group[1];
    // 判斷是否為中文 POS，若是則保留原文，否則 toLowerCase
    const pos = /[\u4e00-\u9fff]/.test(rawPos) ? rawPos : rawPos.toLowerCase();
    console.log(`[Lookup Debug] 4-A-1. 詞性群組: pos="${pos}", terms=`, terms);
    if (!pos || !Array.isArray(terms)) continue;

    const zhTerms = terms
      .filter((t) => typeof t === 'string' && t.trim())
      .slice(0, 3);
    console.log(`[Lookup Debug] 4-A-2. 篩選後 zhTerms (前3個):`, zhTerms);
    if (zhTerms.length > 0) {
      map[pos] = zhTerms;
    }
  }
  console.log(`[Lookup Debug] 4-A-3. parsePosTranslations 最終結果:`, map);
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

function mergeMeanings(englishMeanings, datamuseDefs, posTranslations, word) {
  const gtxKeys = Object.keys(posTranslations);
  console.log(`[Lookup Debug] 5-A. mergeMeanings: gtxKeys=`, gtxKeys, `englishMeanings=`, englishMeanings.length, `筆`);

  const dictByPos = {};
  for (const em of englishMeanings) {
    dictByPos[em.partOfSpeech.toLowerCase()] = em;
  }

  if (gtxKeys.length > 0) {
    console.log(`[Lookup Debug] 5-B. mergeMeanings: 以 GTX 詞性為骨架 (共 ${gtxKeys.length} 個詞性)`);
    const merged = gtxKeys.map((posKey) => {
      const zhTerms = posTranslations[posKey];
      const translation = zhTerms ? zhTerms.join('、') : '';
      const zhPosLabel = mapPos(posKey);

      const enPosKey = REVERSE_POS_MAP[posKey] || posKey.toLowerCase();
      const dictEntry = dictByPos[enPosKey] || dictByPos[posKey.toLowerCase()];
      let definition = dictEntry?.definition || '';
      let example = dictEntry?.example || '';

      if (!definition && datamuseDefs[enPosKey]) {
        definition = datamuseDefs[enPosKey];
      }

      if (!example && word) {
        example = autoGenerateExample(word, posKey);
      }

      if (!definition && translation) {
        definition = `[${zhPosLabel}] ${translation}`;
      }

      console.log(`[Lookup Debug] 5-C. posKey="${posKey}" enPosKey="${enPosKey}" => translation="${translation}", definition="${definition.slice(0, 60)}", example="${example.slice(0, 50)}"`);
      return {
        partOfSpeech: zhPosLabel,
        translation,
        definition,
        example,
      };
    });
    console.log(`[Lookup Debug] 5-D. mergeMeanings GTX 骨架整合完成，共 ${merged.length} 筆`, merged);
    return merged;
  }

  if (englishMeanings.length > 0) {
    console.log(`[Lookup Debug] 5-E. mergeMeanings: 無 GTX 詞性，退回 englishMeanings 骨架`);
    return englishMeanings.map((em) => {
      const posKey = em.partOfSpeech.toLowerCase();
      const zhTerms = posTranslations[posKey];
      const translation = zhTerms ? zhTerms.join('、') : '';
      const example = em.example || (word ? autoGenerateExample(word, posKey) : '');
      return {
        partOfSpeech: mapPos(em.partOfSpeech),
        translation,
        definition: em.definition,
        example,
      };
    });
  }

  console.log(`[Lookup Debug] 5-F. mergeMeanings: 完全無資料，產生保底項`);
  return [
    {
      partOfSpeech: '',
      translation: '',
      definition: word ? `The word "${word}"` : '',
      example: word ? `This is a ${word}.` : '',
    },
  ];
}
