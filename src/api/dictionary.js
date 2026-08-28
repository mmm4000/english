import { getVerbForms } from '../utils/conjugations.js';

/**
 * 查詢單字的所有釋義（多詞性）與繁體中文辭典翻譯。
 * 回傳：
 * {
 *   word: string,
 *   phonetic: string,
 *   verb_forms: { base, third, past_tense, past_participle, present_participle } | null,
 *   meanings: [
 *     { partOfSpeech: '名詞', translation: '書、書籍', definition: '...', example: '...', example_zh: '...' },
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

  // 音標
  console.log(`[Lookup Debug] 3. 取得音標`);
  let phonetic = extractDatamuseIPA(datamuseData);
  if (!phonetic) phonetic = await fetchWiktionaryPhonetic(word);
  console.log(`[Lookup Debug] 3-1. 最終 phonetic:`, phonetic);

  // 動詞變化
  console.log(`[Lookup Debug] 4. 推導動詞變化`);
  const hasVerbPOS = hasVerbInGTX(transData);
  const verbForms = hasVerbPOS ? getVerbForms(word) : null;
  console.log(`[Lookup Debug] 4-1. verbForms:`, verbForms);

  // Datamuse 英文定義
  const datamuseDefs = extractDatamuseDefs(datamuseData);
  console.log(`[Lookup Debug] 5. datamuseDefs:`, datamuseDefs);

  // 核心直譯（Google GTX res[0][0][0]，如 "run" -> "跑"）
  const coreTranslation = transData?.[0]?.[0]?.[0] || '';
  console.log(`[Lookup Debug] 6-0. coreTranslation:`, coreTranslation);

  // GTX 辭典
  console.log(`[Lookup Debug] 6. 解析 Google GTX 辭典結果`);
  const posTranslations = parsePosTranslations(transData);
  console.log(`[Lookup Debug] 6-1. posTranslations:`, posTranslations);

  // 整合 meanings
  console.log(`[Lookup Debug] 7. 執行 mergeMeanings 整合`);
  const meanings = mergeMeanings(datamuseDefs, posTranslations, word);
  console.log(`[Lookup Debug] 7-1. mergeMeanings (整合前):`, meanings);

  // 為每個 meaning 生成語境例句 + 中文翻譯
  console.log(`[Lookup Debug] 8. 為每個 meaning 補充例句`);
  await attachExamplesToMeanings(meanings, word, verbForms);
  console.log(`[Lookup Debug] 8-1. 最終 meanings:`, meanings);

  const result = { word, phonetic, verb_forms: verbForms, meanings };
  console.log(`[Lookup Debug] 9. lookupWord 最終回傳:`, result);
  return result;
}

/* ─── 高品質動態語境例句生成器 ─── */

export function getSmartSentence(word, pos, verbForms) {
  const lowerWord = (word || '').toLowerCase();

  // 優先使用內建自然搭配例句（完全符合母語者 collocations）
  const curatedExamples = COLLOCATIONS[lowerWord];
  if (curatedExamples) {
    const cleanPos = (pos || '').toLowerCase();
    let posKey = 'other';
    if (cleanPos.includes('動') || cleanPos.includes('verb')) posKey = 'verb';
    else if (cleanPos.includes('名') || cleanPos.includes('noun')) posKey = 'noun';
    else if (cleanPos.includes('形') || cleanPos.includes('adj')) posKey = 'adjective';
    else if (cleanPos.includes('副') || cleanPos.includes('adv')) posKey = 'adverb';

    const list = curatedExamples[posKey] || curatedExamples.verb || curatedExamples.noun || [];
    if (list.length > 0) {
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  // 後備：通用模板例句
  const past = verbForms?.past_tense || `${word}ed`;
  const ing = verbForms?.present_participle || `${word}ing`;
  const third = verbForms?.third || `${word}s`;

  const pool = {
    verb: [
      `They decided to ${word} every morning before going to work.`,
      `She needs to ${word} the details before the meeting starts.`,
      `We will ${word} all necessary support for this project.`,
      `The company is planning to ${word} a new approach next quarter.`,
      `You should ${word} carefully before making any final decisions.`,
      `He used to ${word} every day when he was younger.`,
      `Can you ${word} the problem so we can move forward?`,
      `I want to ${word} this opportunity to thank everyone involved.`,
    ],
    noun: [
      `Regular ${word} has a very positive impact on overall health.`,
      `The overall ${word} was completed much faster than we expected.`,
      `We made good use of the available ${word} to solve the problem.`,
      `This ${word} is essential for understanding the bigger picture.`,
      `The professor discussed the importance of ${word} in modern society.`,
      `She wrote an article about the role of ${word} in everyday life.`,
      `Every ${word} has its own unique characteristics and advantages.`,
      `The quality of the ${word} exceeded all our expectations.`,
    ],
    adjective: [
      `The result was surprisingly ${word} compared to what we anticipated.`,
      `She maintained a ${word} attitude throughout the entire process.`,
      `This ${word} approach has proven to be very effective in practice.`,
      `The team found the ${word} aspects of the project particularly challenging.`,
      `It is important to stay ${word} when facing unexpected obstacles.`,
      `The ${word} conditions made it difficult to complete the work on time.`,
    ],
    adverb: [
      `She completed the entire report ${word} and submitted it before the deadline.`,
      `The team worked ${word} to finish the project before the tight deadline.`,
      `He spoke ${word} during the presentation, impressing all the audience members.`,
      `The experiment was conducted ${word} following strict scientific protocols.`,
      `They ${word} agreed to proceed with the proposed plan.`,
      `The changes were ${word} implemented across all departments.`,
    ],
    other: [
      `Understanding the correct usage of "${word}" will significantly improve your English skills.`,
      `The teacher explained the meaning of "${word}" with several helpful real-world examples.`,
      `Learning to use "${word}" appropriately is essential for effective language communication.`,
      `This is a practical example showing how to properly use "${word}" in daily communication.`,
    ],
  };

  const cleanPos = (pos || '').toLowerCase();
  let list;
  if (cleanPos.includes('動') || cleanPos.includes('verb')) list = pool.verb;
  else if (cleanPos.includes('名') || cleanPos.includes('noun')) list = pool.noun;
  else if (cleanPos.includes('形') || cleanPos.includes('adj')) list = pool.adjective;
  else if (cleanPos.includes('副') || cleanPos.includes('adv')) list = pool.adverb;
  else list = pool.other;

  return list[Math.floor(Math.random() * list.length)];
}

/* ─── 例句翻譯 ─── */

export async function translateSentence(enText) {
  if (!enText) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(enText)}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    return data?.[0]?.[0]?.[0] || '';
  } catch (_) {
    return '';
  }
}

/* ─── 例句綁定 ─── */

async function attachExamplesToMeanings(meanings, word, verbForms) {
  const translatePromises = meanings.map(async (m) => {
    if (m.example) return;
    const enSentence = getSmartSentence(word, m.partOfSpeech, verbForms);
    m.example = enSentence;
    m.example_zh = await translateSentence(enSentence);
  });
  await Promise.all(translatePromises);
}

/* ─── Datamuse API ─── */

async function fetchDatamuse(word) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r,d,p&ipa=1&max=1`;
  console.log(`[Lookup Debug] 2-A. 請求 Datamuse API: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    console.log(`[Lookup Debug] 2-A-1. Datamuse 回傳:`, data);
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-A-2. Datamuse 例外錯誤:`, err.message);
    return null;
  }
}

function extractDatamuseIPA(data) {
  if (!data || !data[0]) return '';
  const item = data[0];
  if (item.tags) {
    for (const tag of item.tags) {
      if (typeof tag === 'string' && tag.startsWith('ipa_pron:')) {
        const ipa = tag.slice(9);
        return ipa ? `/${ipa}/` : '';
      }
    }
  }
  if (item.pronunciation) return `/${item.pronunciation}/`;
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
  return map;
}

/* ─── Wiktionary REST API ─── */

async function fetchWiktionaryPhonetic(word) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    const html = data?.en?.[0]?.definitions?.[0]?.definition || '';
    const ipaMatch = html.match(/\/[^/]+\/|[^\s]*[ˈˌ][^\s]*/);
    if (ipaMatch) {
      const ipa = ipaMatch[0];
      return ipa.startsWith('/') ? ipa : `/${ipa}/`;
    }
  } catch (_) {}
  return '';
}

/* ─── Google Translate GTX ─── */

async function fetchGoogleTranslate(word) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
  console.log(`[Lookup Debug] 2-B. 請求 Google Translate GTX: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    console.log(`[Lookup Debug] 2-B-1. Google Translate 回傳 JSON (前 800 字元):`, JSON.stringify(data).slice(0, 800));
    return data;
  } catch (err) {
    console.error(`[Lookup Debug] 2-B-2. Google Translate 例外錯誤:`, err);
    return null;
  }
}

function hasVerbInGTX(data) {
  if (!data?.[1]) return false;
  return data[1].some(g => {
    const p = (g[0] || '').toLowerCase();
    return p === '動詞' || p === 'verb';
  });
}

/* ─── 詞性優先級排序 ─── */

const POS_PRIORITY = {
  '動詞': 1, 'verb': 1,
  '名詞': 2, 'noun': 2,
  '形容詞': 3, 'adjective': 3, 'adj': 3,
  '副詞': 4, 'adverb': 4, 'adv': 4,
  '代名詞': 5, 'pronoun': 5,
  '介系詞': 6, 'preposition': 6,
  '連接詞': 7, 'conjunction': 7,
  '感嘆詞': 8, 'interjection': 8,
  '限定詞': 9, 'determiner': 9,
  '冠詞': 10, 'article': 10,
};

/* ─── 常見單字：各詞性標準中文釋義 ─── */

const CURATED_ZH = {
  book: { noun: '書籍、本子、冊子', verb: '預訂、預約、登記' },
  run: { verb: '奔跑、運作、經營', noun: '跑步、運行、路程' },
  provide: { verb: '提供、供給、準備' },
  launch: { verb: '發射、發起、推出', noun: '發布會、發射、下水' },
  make: { verb: '製作、製造、使成為', noun: '品牌、體質' },
  take: { verb: '拿取、攜帶、帶走', noun: '看法、場景' },
  get: { verb: '獲得、取得、變得' },
  go: { verb: '去、前進、進行', noun: '嘗試、一番努力' },
  come: { verb: '來、到來、發生' },
  see: { verb: '看見、理解、查看' },
  know: { verb: '知道、了解、認識' },
  think: { verb: '思考、認為、想' },
  give: { verb: '給予、提供、讓步', noun: '彈性、伸縮性' },
  find: { verb: '發現、找到、認為' },
  tell: { verb: '告訴、說、判斷' },
  ask: { verb: '詢問、要求、請求' },
  work: { noun: '工作、勞動、職業', verb: '工作、運作、有效' },
  feel: { verb: '感覺、感受到、認為', noun: '感覺、直覺' },
  want: { verb: '想要、希望、需要' },
  call: { verb: '打電話給、稱為、叫', noun: '電話、呼叫' },
  try: { verb: '嘗試、試圖、審理', noun: '嘗試' },
  need: { verb: '需要、有必要', noun: '需要、必需品' },
  leave: { verb: '離開、留下、委託', noun: '假期、許可' },
  put: { verb: '放置、設置、表達' },
  mean: { verb: '意思是、意味著、意指' },
  keep: { verb: '保留、保持、繼續' },
  begin: { verb: '開始、著手、起源' },
  show: { verb: '展示、顯示、證明', noun: '表演、展覽' },
  hear: { verb: '聽見、聽說、審理' },
  play: { verb: '玩、播放、演奏', noun: '遊戲、戲劇' },
  move: { verb: '移動、搬遷、感動', noun: '行動、步驟' },
  live: { verb: '生活、居住、活著', adjective: '活的、現場的' },
  believe: { verb: '相信、認為、信仰' },
  bring: { verb: '帶來、引起、促使' },
  write: { verb: '書寫、撰寫、寫作' },
  provide: { verb: '提供、供給、準備' },
  sit: { verb: '坐下、就座、位於' },
  stand: { verb: '站立、忍受、位於', noun: '立場、攤位' },
  lose: { verb: '失去、輸掉、迷路' },
  pay: { verb: '支付、付款、付出', noun: '薪水' },
  meet: { verb: '遇見、會面、滿足' },
  include: { verb: '包含、包括、列入' },
  set: { verb: '設置、設定、安排', noun: '一套、設備' },
  learn: { verb: '學習、學會、得知' },
  change: { verb: '改變、更換、兌換', noun: '變化、零錢' },
  lead: { verb: '帶領、領導、導致', noun: '領先、榜樣' },
  understand: { verb: '理解、了解、懂' },
  watch: { verb: '觀看、注視、留意', noun: '手錶、監視' },
  follow: { verb: '跟隨、遵循、理解' },
  stop: { verb: '停止、中止、阻止', noun: '車站、停止' },
  create: { verb: '創造、創建、造成' },
  speak: { verb: '說、演講、表明' },
  read: { verb: '閱讀、朗讀、理解' },
  grow: { verb: '成長、增長、種植' },
  open: { verb: '打開、開放、開始', adjective: '開放的、未關閉的' },
  walk: { verb: '走路、散步、行走', noun: '散步、步道' },
  win: { verb: '贏得、獲勝、取得', noun: '勝利' },
  teach: { verb: '教導、教授、教訓' },
  offer: { verb: '提供、提議、出價', noun: '提議、報價' },
  remember: { verb: '記得、記住、銘記' },
  consider: { verb: '考慮、認為、體諒' },
  appear: { verb: '出現、似乎、出版' },
  buy: { verb: '購買、買、收買' },
  serve: { verb: '服務、供應、服役' },
  die: { verb: '死亡、消逝、渴望' },
  send: { verb: '傳送、寄送、派遣' },
  expect: { verb: '預期、期望、要求' },
  build: { verb: '建造、建立、構建', noun: '體格' },
  stay: { verb: '停留、保持、暫住' },
  fall: { verb: '落下、下降、跌倒', noun: '下降、秋天' },
  cut: { verb: '切割、削減、停電', noun: '傷口、減少' },
  reach: { verb: '達到、抵達、伸出手', noun: '範圍、影響力' },
  kill: { verb: '殺死、終止、消磨' },
  remain: { verb: '保持、殘留、依然是' },
  suggest: { verb: '建議、暗示、表明' },
  raise: { verb: '提高、舉起、籌集' },
  pass: { verb: '通過、傳遞、消逝', noun: '通行證、通道' },
  sell: { verb: '販售、出售、推銷' },
  require: { verb: '需要、要求、規定' },
  report: { verb: '報告、報導、告發', noun: '報告、成績單' },
  decide: { verb: '決定、判斷、解決' },
  pull: { verb: '拉、吸引、拔除', noun: '拉力、吸引力' },
  develop: { verb: '發展、開發、成長' },
  eat: { verb: '吃、食用、耗盡' },
  plan: { verb: '計畫、打算、設計', noun: '計畫、方案' },
  love: { verb: '愛、喜愛、熱愛', noun: '愛、戀人' },
  use: { verb: '使用、運用、利用', noun: '用途、使用' },
  type: { noun: '類型、型號、文字', verb: '打字、輸入' },
  list: { noun: '清單、列表、目錄', verb: '列出、列舉' },
  form: { noun: '形狀、表格、體制', verb: '形成、組成、建立' },
  charge: { verb: '收費、充電、指控', noun: '費用、負責' },
  produce: { verb: '生產、製造、產生', noun: '農產品' },
  result: { noun: '結果、成果、後果', verb: '導致、產生' },
  market: { noun: '市場、市集、行情', verb: '推銷、行銷' },
};

/* ─── 常見單字：各詞性自然搭配例句 ─── */

const COLLOCATIONS = {
  book: {
    verb: [
      'She needs to book a hotel room and flight tickets for her trip.',
      'Could you help me book a table for two at the restaurant tonight?',
      'I would like to book an appointment with the dentist for next week.',
      'They managed to book the conference room well in advance.',
    ],
    noun: [
      'I am currently reading a fascinating book about modern history.',
      'This book provides comprehensive guidelines for beginners.',
      'She borrowed an interesting book from the library yesterday.',
      'The professor recommended an excellent book on artificial intelligence.',
    ],
  },
  run: {
    verb: [
      'He likes to run five kilometers in the park every morning.',
      'She has been successfully running her own business for ten years.',
      'They decided to run the experiment again to verify the results.',
      'We need to run a diagnostic test before installing the software.',
    ],
    noun: [
      'He went for a quick run around the neighborhood before breakfast.',
      'The daily run helps her stay focused and energized throughout the day.',
      'The company had a remarkable run of success over the past decade.',
      'She completed the marathon run in just under four hours.',
    ],
  },
  provide: {
    verb: [
      'The platform provides users with comprehensive learning resources.',
      'This service provides customers with fast and reliable delivery.',
      'The school provides students with access to a modern library.',
      'Our team will provide all the necessary support for this project.',
    ],
  },
  launch: {
    verb: [
      'The company is planning to launch a new smartphone next month.',
      'They will launch the marketing campaign at the beginning of next year.',
      'The space agency successfully launched the satellite into orbit.',
      'She decided to launch her own online business this summer.',
    ],
    noun: [
      'The product launch attracted hundreds of journalists and bloggers.',
      'The launch of the new service was a huge success.',
      'Attendees gathered to watch the official launch ceremony.',
      'The launch date has been moved up by two weeks.',
    ],
  },
  make: {
    verb: [
      'She helped me make an important decision about my career.',
      'They plan to make significant changes to the project scope.',
      'We should make every effort to meet the deadline.',
      'He tried to make a good impression during the interview.',
    ],
    noun: [
      'What make of car do you prefer for long-distance driving?',
      'The overall make of this product feels very premium.',
    ],
  },
  take: {
    verb: [
      'Please take a moment to review the document before signing.',
      'She decided to take a different approach to solve the problem.',
      'We need to take immediate action to address this issue.',
      'He offered to take responsibility for the project outcome.',
    ],
    noun: [
      'The director filmed the entire scene in a single take.',
      'Her take on the matter was quite different from the others.',
    ],
  },
  get: {
    verb: [
      'I need to get some fresh air after being indoors all day.',
      'She finally got the opportunity to study abroad.',
      'They got everything ready before the guests arrived.',
      'You should get your car serviced before the long trip.',
    ],
  },
  go: {
    verb: [
      'We decided to go to the new Italian restaurant downtown.',
      'She wants to go abroad to study environmental science.',
      'Let us go through the report one more time before submitting.',
      'He had to go through extensive training before the certification.',
    ],
    noun: [
      'She gave the project her best go and succeeded.',
    ],
  },
  come: {
    verb: [
      'Please come to the office at your earliest convenience.',
      'Good ideas often come from unexpected conversations.',
      'They will come to an agreement by the end of the week.',
      'She hopes to come across as confident during the presentation.',
    ],
  },
  see: {
    verb: [
      'I would like to see the results of the experiment.',
      'She went to see a specialist about the persistent symptoms.',
      'We need to see a significant improvement in performance.',
      'They could see the potential in the new technology.',
    ],
  },
  know: {
    verb: [
      'Do you know how to operate this equipment safely?',
      'She wants to know more about the history of the institution.',
      'I did not know the answer to the question at first.',
      'You should know the rules before participating in the game.',
    ],
  },
  think: {
    verb: [
      'I think this approach will work much better for our team.',
      'She thinks highly of the new management strategy.',
      'We should think carefully before making any commitments.',
      'He tends to think outside the box when solving problems.',
    ],
  },
  give: {
    verb: [
      'She decided to give her colleague some constructive feedback.',
      'They plan to give a presentation at the annual conference.',
      'Please give me a call when you arrive at the airport.',
      'He offered to give up his seat for the elderly passenger.',
    ],
    noun: [
      'This fabric has excellent give and stretches easily.',
    ],
  },
  find: {
    verb: [
      'I finally found the solution to the problem we discussed.',
      'She hopes to find a better work-life balance this year.',
      'They found it difficult to meet the tight deadline.',
      'You will find the information you need on the website.',
    ],
  },
  tell: {
    verb: [
      'Can you tell me the best way to get to the airport?',
      'She could tell that something was wrong immediately.',
      'The evidence seems to tell a very different story.',
      'He could not tell the difference between the two products.',
    ],
  },
  ask: {
    verb: [
      'She decided to ask her manager for a flexible work schedule.',
      'If you have any questions, feel free to ask the instructor.',
      'They asked me to submit the report by Friday.',
      'He did not dare to ask about the salary increase.',
    ],
  },
  work: {
    noun: [
      'The overall work was completed much faster than expected.',
      'Her work on the project was recognized by the entire team.',
      'This work explores the impact of technology on education.',
      'The quality of the work exceeded all our expectations.',
    ],
    verb: [
      'She works closely with the design team on a daily basis.',
      'They need to work together to solve this complex issue.',
      'The system works perfectly under normal operating conditions.',
      'He works part-time while pursuing his master\'s degree.',
    ],
  },
  feel: {
    verb: [
      'I feel confident about the outcome of the interview.',
      'She feels strongly about environmental conservation.',
      'Do you feel comfortable with the proposed arrangement?',
      'They felt the need to address the growing concern.',
    ],
    noun: [
      'The project gave her a real sense of accomplishment.',
    ],
  },
  live: {
    verb: [
      'They live in a quiet neighborhood near the city center.',
      'She wants to live a healthier and more active lifestyle.',
      'He has lived in five different countries throughout his life.',
      'We should live every day to the fullest.',
    ],
    adjective: [
      'The concert will be broadcast as a live performance tonight.',
      'She gave a live demonstration of the new software features.',
    ],
  },
  write: {
    verb: [
      'She plans to write a book about her travel experiences.',
      'Please write down your contact information on this form.',
      'He was asked to write a report on the market analysis.',
      'They decided to write a formal letter of complaint.',
    ],
  },
  set: {
    verb: [
      'We need to set clear goals for the upcoming quarter.',
      'She set a new record in the 100-meter dash.',
      'Please set the document aside for now and review it later.',
      'They set out to create the most innovative product in the industry.',
    ],
    noun: [
      'This complete set of tools is essential for the repair work.',
    ],
  },
  learn: {
    verb: [
      'She wants to learn a new language before her trip abroad.',
      'You can learn a lot from observing experienced professionals.',
      'He learned to play the piano at a very young age.',
      'The team learned valuable lessons from the failed project.',
    ],
  },
  change: {
    verb: [
      'The company decided to change its strategy completely.',
      'She needs to change her approach to meet the new requirements.',
      'Technology has changed the way we communicate with each other.',
      'He wants to change careers and pursue his passion.',
    ],
    noun: [
      'The recent changes in the policy affect all employees.',
      'A small change in the design made a big difference.',
    ],
  },
  build: {
    verb: [
      'They plan to build a new community center in the area.',
      'She worked hard to build a successful career from scratch.',
      'The team built a prototype to test the new concept.',
      'We need to build trust among all stakeholders.',
    ],
    noun: [
      'He has an athletic build that suits competitive sports.',
    ],
  },
  grow: {
    verb: [
      'The company continues to grow at an impressive rate.',
      'She wants to grow her skills in data analytics.',
      'Plants grow faster when they receive adequate sunlight.',
      'He grew to appreciate the value of teamwork over time.',
    ],
  },
  open: {
    verb: [
      'They plan to open a new branch in the city center.',
      'She opened the window to let some fresh air in.',
      'The store will open at nine o\'clock tomorrow morning.',
      'He opened the discussion with a thought-provoking question.',
    ],
    adjective: [
      'The team remained open to new ideas and suggestions.',
      'She is always open to feedback and constructive criticism.',
    ],
  },
  call: {
    verb: [
      'Please call me if you need any assistance with the project.',
      'They decided to call an emergency meeting to discuss the issue.',
      'She called her friend to congratulate her on the achievement.',
      'He called into question the accuracy of the data.',
    ],
    noun: [
      'She received an unexpected call from her former colleague.',
      'The decision was a close call between the two candidates.',
    ],
  },
  try: {
    verb: [
      'You should try the new restaurant that just opened downtown.',
      'She decided to try a different approach to the problem.',
      'They will try their best to finish the project on time.',
      'He tried to explain the concept as simply as possible.',
    ],
    noun: [
      'The first attempt did not work, but it was worth a try.',
    ],
  },
  need: {
    verb: [
      'We need to finish this report before the end of the day.',
      'She needs more time to complete the research properly.',
      'They need everyone to contribute to the team effort.',
      'He needs to improve his presentation skills.',
    ],
    noun: [
      'The project has several critical needs that must be addressed.',
    ],
  },
  put: {
    verb: [
      'Please put the documents in the appropriate folder.',
      'She put a lot of effort into preparing the presentation.',
      'They put the plan into action immediately after the meeting.',
      'He put forward a proposal for the new marketing strategy.',
    ],
  },
  keep: {
    verb: [
      'She managed to keep her composure during the crisis.',
      'Please keep the receipt in case you need to return the item.',
      'They need to keep track of all expenses for the project.',
      'He always keeps his promises no matter what.',
    ],
  },
  begin: {
    verb: [
      'The ceremony will begin at exactly ten o\'clock.',
      'She began to realize the importance of the project.',
      'They plan to begin construction next spring.',
      'He began his career as a junior software developer.',
    ],
  },
  show: {
    verb: [
      'She wants to show her gratitude for all the support.',
      'The results show a significant improvement in performance.',
      'They showed great determination throughout the competition.',
      'He showed me around the new office building.',
    ],
    noun: [
      'The art show attracted thousands of visitors over the weekend.',
    ],
  },
  hear: {
    verb: [
      'I heard that the company is planning to expand overseas.',
      'She was thrilled to hear the good news about her promotion.',
      'Did you hear what the speaker said during the lecture?',
      'They heard the announcement and immediately responded.',
    ],
  },
  play: {
    verb: [
      'She likes to play the violin in her spare time.',
      'The children play in the park every afternoon after school.',
      'He played a key role in the success of the project.',
      'They played their best during the championship final.',
    ],
    noun: [
      'The school organized a play performed by the drama club.',
    ],
  },
  move: {
    verb: [
      'They decided to move to a larger apartment downtown.',
      'She was deeply moved by the heartfelt speech.',
      'We need to move quickly to take advantage of this opportunity.',
      'He moved to a new position in the marketing department.',
    ],
    noun: [
      'Moving to a new city can be both exciting and challenging.',
    ],
  },
  believe: {
    verb: [
      'She believes that education is the key to success.',
      'I believe we can find a solution to this problem.',
      'They believe in the power of teamwork and collaboration.',
      'He found it hard to believe the surprising results.',
    ],
  },
  bring: {
    verb: [
      'Please bring your laptop to the meeting tomorrow.',
      'She brought a fresh perspective to the discussion.',
      'They brought the project to a successful completion.',
      'He brought up an important point during the presentation.',
    ],
  },
  stay: {
    verb: [
      'She plans to stay at the hotel for three nights.',
      'They decided to stay and watch the entire performance.',
      'He told me to stay calm and wait for further instructions.',
      'We should stay updated on the latest developments.',
    ],
  },
  stop: {
    verb: [
      'She asked him to stop making so much noise.',
      'They had to stop the project due to budget constraints.',
      'He stopped to help the stranded motorists.',
      'We must stop the spread of misinformation.',
    ],
    noun: [
      'The bus makes a stop at the central station every hour.',
    ],
  },
  create: {
    verb: [
      'She wants to create a more inclusive work environment.',
      'The team created an innovative solution to the problem.',
      'They created a detailed plan for the marketing campaign.',
      'He hopes to create opportunities for young entrepreneurs.',
    ],
  },
  speak: {
    verb: [
      'She will speak at the international conference next month.',
      'He spoke about the importance of mental health awareness.',
      'They speak three languages fluently in the office.',
      'She spoke to the manager about her concerns.',
    ],
  },
  read: {
    verb: [
      'I like to read a variety of books on different subjects.',
      'She read the report carefully before the meeting.',
      'He read an interesting article about climate change.',
      'They read the instructions thoroughly before starting.',
    ],
  },
  win: {
    verb: [
      'She worked hard to win the first place in the competition.',
      'They won the contract after a competitive bidding process.',
      'He won the award for best researcher of the year.',
      'The team won every match during the entire season.',
    ],
    noun: [
      'The victory was a well-deserved win for the entire team.',
    ],
  },
  teach: {
    verb: [
      'She teaches English at the local university.',
      'He taught himself to code using online tutorials.',
      'They want to teach children the importance of environmental protection.',
      'The experience taught her a valuable lesson about patience.',
    ],
  },
  offer: {
    verb: [
      'They offered me a position at their new branch.',
      'She offered to help with the event planning.',
      'The company offers flexible working hours for all employees.',
      'He offered a sincere apology for the misunderstanding.',
    ],
    noun: [
      'The job offer came with excellent benefits and a competitive salary.',
    ],
  },
  remember: {
    verb: [
      'Do you remember the first time we met at the conference?',
      'She always remembers to double-check her work.',
      'He could not remember where he had parked the car.',
      'They will remember this achievement for years to come.',
    ],
  },
  decide: {
    verb: [
      'She decided to accept the job offer in the new city.',
      'They need to decide on a date for the team-building event.',
      'He could not decide which option was the best.',
      'We decided to postpone the meeting until next week.',
    ],
  },
  develop: {
    verb: [
      'The team is working to develop a new software application.',
      'She wants to develop her leadership skills further.',
      'They developed a comprehensive plan for urban renewal.',
      'He developed an interest in photography during college.',
    ],
  },
  eat: {
    verb: [
      'She prefers to eat a light lunch before afternoon meetings.',
      'We should eat at the new café that just opened nearby.',
      'He tried to eat healthier by including more vegetables.',
      'They ate dinner together after the long workday.',
    ],
  },
  plan: {
    verb: [
      'We need to plan the event carefully to avoid any issues.',
      'She plans to pursue a master\'s degree next year.',
      'They planned a surprise party for their friend\'s birthday.',
      'He planned every detail of the business trip.',
    ],
    noun: [
      'The project plan outlines all the key milestones and deadlines.',
      'They presented a detailed plan for the new development.',
    ],
  },
  love: {
    verb: [
      'She loves spending time with her family during the holidays.',
      'He loves exploring new cuisines and restaurants.',
      'They love the challenge of working on complex projects.',
      'She loves teaching children about science and nature.',
    ],
    noun: [
      'His love for music started at a very young age.',
    ],
  },
  use: {
    verb: [
      'You can use this tool to analyze the data more efficiently.',
      'She decided to use a different approach for the experiment.',
      'They use renewable energy sources to power the building.',
      'He learned to use the new software in just a few days.',
    ],
    noun: [
      'The proper use of technology can greatly enhance productivity.',
    ],
  },
  type: {
    noun: [
      'This type of problem requires a creative and innovative solution.',
      'She prefers a minimalist type of design for her projects.',
      'What type of experience do you have in project management?',
    ],
    verb: [
      'She can type over sixty words per minute without errors.',
      'Please type your response in the designated text field.',
    ],
  },
  list: {
    noun: [
      'She made a list of all the items needed for the project.',
      'The list of candidates has been narrowed down to five.',
      'Please check the list for your name and contact details.',
    ],
    verb: [
      'They listed all the requirements in the project document.',
      'She listed several reasons for supporting the proposal.',
    ],
  },
  form: {
    noun: [
      'Please fill out the registration form before attending.',
      'The information is available in both digital and print form.',
      'They took the form of a committee to review the applications.',
    ],
    verb: [
      'They formed a working group to address the issue.',
      'A strong bond formed between the team members over time.',
    ],
  },
  charge: {
    verb: [
      'The company does not charge extra for weekend delivery.',
      'She was charged with managing the entire project budget.',
      'They charge a reasonable fee for the consulting service.',
    ],
    noun: [
      'The charge for the premium service is very reasonable.',
      'She took charge of the team during the manager\'s absence.',
    ],
  },
  result: {
    noun: [
      'The results of the survey were quite surprising.',
      'She was pleased with the positive result of the experiment.',
      'They analyzed the result to determine the next steps.',
    ],
    verb: [
      'The delay resulted in a significant increase in costs.',
      'Poor communication resulted in several misunderstandings.',
    ],
  },
  market: {
    noun: [
      'The local market offers a wide variety of fresh produce.',
      'They conducted extensive research before entering the market.',
      'The demand in the overseas market continues to grow.',
    ],
    verb: [
      'They plan to market the product to a younger audience.',
      'She helped market the new service through social media.',
    ],
  },
};

function parsePosTranslations(data) {
  const map = {};
  if (!data?.[1]) return map;

  for (const group of data[1]) {
    const rawPos = group[0] || '';
    const rawTerms = group[1];
    const pos = /[\u4e00-\u9fff]/.test(rawPos) ? rawPos : rawPos.toLowerCase();
    if (!pos || !Array.isArray(rawTerms)) continue;

    // 從 terms 中提取有效字串，跳過 null/數字/陣列等非字串項
    const allStrings = rawTerms.filter(t => typeof t === 'string' && t.trim());
    if (allStrings.length === 0) continue;

    // 過濾策略：優先保留英文詞和 2~4 字的中文詞，排除過短的單中文字
    let goodTerms = allStrings.filter(t => {
      const trimmed = t.trim();
      if (trimmed.length >= 2) return true;
      if (/[a-zA-Z]/.test(trimmed)) return true;
      return false;
    });

    // 過濾冷門中文字：若中文詞包含生僻字則移除
    goodTerms = goodTerms.filter(t => {
      const trimmed = t.trim();
      if (/[a-zA-Z]/.test(trimmed)) return true;
      for (const ch of trimmed) {
        if (OBSCURE_ZH.has(ch)) return false;
      }
      return true;
    });

    // 若過濾後為空，回退到原始列表
    const pool = goodTerms.length > 0 ? goodTerms : allStrings;

    // 收集本 POS 組的 terms（不再注入 coreTranslation）
    const terms = [];
    for (const t of pool) {
      if (terms.length >= 4) break;
      if (!terms.includes(t)) terms.push(t);
    }

    if (terms.length > 0) {
      map[pos] = terms.slice(0, 4);
    }
  }

  // 依照 POS_PRIORITY 排序
  const sorted = {};
  const entries = Object.entries(map).sort((a, b) => {
    const pa = POS_PRIORITY[a[0]] || 99;
    const pb = POS_PRIORITY[b[0]] || 99;
    return pa - pb;
  });
  for (const [k, v] of entries) sorted[k] = v;
  return sorted;
}

/* ─── 內建常見單字英英定義（Datamuse 缺失時的後備） ─── */

const BUILTIN_DEFS = {
  run: { verb: 'To move swiftly on foot; to manage or operate a system or business.', noun: 'An act or spell of running; a continuous period or route.' },
  book: { noun: 'A written or printed work consisting of pages bound together.', verb: 'To reserve accommodation, tickets, or a place in advance.' },
  make: { verb: 'To construct or manufacture something; to cause something to happen.', noun: 'A brand or type of product.' },
  take: { verb: 'To lay hold of something; to carry or bring somewhere.', noun: 'An act of taking something.' },
  get: { verb: 'To come to have or receive; to become affected by a condition.' },
  go: { verb: 'To move or travel to a place; to proceed in a particular way.', noun: 'An attempt at something.' },
  come: { verb: 'To move or travel toward the speaker; to happen or take place.' },
  see: { verb: 'To perceive with the eyes; to understand or realize something.' },
  know: { verb: 'To be aware of through observation or information; to be familiar with.' },
  think: { verb: 'To use the mind to consider or reason about something.' },
  give: { verb: 'To freely transfer possession of something to someone.', noun: 'The quality of elasticity.' },
  find: { verb: 'To discover something by searching or by chance.' },
  tell: { verb: 'To communicate information to someone; to narrate a story.' },
  ask: { verb: 'To inquire about something; to request something from someone.' },
  work: { noun: 'Activity involving mental or physical effort; a place of employment.', verb: 'To be engaged in physical or mental activity; to function properly.' },
  feel: { verb: 'To be aware of through touch or emotion; to experience a sensation.', noun: 'An intuitive understanding.' },
  want: { verb: 'To have a desire to possess or do something.' },
  call: { verb: 'To contact someone by phone; to give a name or label to.', noun: 'A phone conversation; a shout or cry.' },
  try: { verb: 'To attempt to do something; to test or experiment with.', noun: 'An attempt to do something.' },
  need: { verb: 'To require something; to be necessary.', noun: 'A requirement or necessity.' },
  leave: { verb: 'To go away from; to allow something to remain.', noun: 'The period of absence.' },
  put: { verb: 'To move to a particular place; to set in a position.' },
  mean: { verb: 'To signify or represent; to intend to convey.' },
  keep: { verb: 'To continue to have or hold; to retain in possession.' },
  begin: { verb: 'To start doing something; to come into existence.' },
  show: { verb: 'To cause to be seen; to display or exhibit.', noun: 'A performance or entertainment.' },
  hear: { verb: 'To perceive sound with the ears; to be informed of.' },
  play: { verb: 'To engage in activity for enjoyment; to perform music.', noun: 'Activity for enjoyment; a dramatic work.' },
  move: { verb: 'To change position or place; to cause to move.', noun: 'An act of moving; a step toward a goal.' },
  live: { verb: 'To be alive; to reside in a particular place.', adjective: 'Having life; real or actual.' },
  believe: { verb: 'To accept something as true; to have faith in.' },
  bring: { verb: 'To take or carry to a place.' },
  write: { verb: 'To compose text; to put words on a surface.' },
  provide: { verb: 'To make available for use; to supply something needed.' },
  sit: { verb: 'To be in a seated position on the feet; to occupy a seat.' },
  stand: { verb: 'To be in an upright position on the feet; to tolerate.', noun: 'A attitude or position; a stall.' },
  lose: { verb: 'To be unable to find; to fail to win.' },
  pay: { verb: 'To give money in exchange for goods or services.', noun: 'Money received for work.' },
  meet: { verb: 'To come into the presence of; to gather together.' },
  include: { verb: 'To contain as part of a whole; to encompass.' },
  set: { verb: 'To put in a particular position; to establish or fix.', noun: 'A group of related items.' },
  learn: { verb: 'To gain knowledge or skill; to study.' },
  change: { verb: 'To make or become different; to replace with another.', noun: 'An alteration or modification.' },
  lead: { verb: 'To guide or direct; to be in charge of.', noun: 'The initiative or example.' },
  understand: { verb: 'To comprehend the meaning of; to be familiar with.' },
  watch: { verb: 'To look at or observe attentively over a period of time.', noun: 'A small timepiece.' },
  follow: { verb: 'To come after; to act according to instructions.' },
  stop: { verb: 'To cease moving or doing; to bring to an end.', noun: 'A cessation; a place where a vehicle stops.' },
  create: { verb: 'To bring something into existence; to produce.' },
  speak: { verb: 'To say words; to talk or converse.' },
  read: { verb: 'To look at and understand written or printed matter.' },
  grow: { verb: 'To increase in size; to develop over time.' },
  open: { verb: 'To move so as to allow access; to make available.', adjective: 'Not closed or blocked.' },
  walk: { verb: 'To move at a regular pace on foot.', noun: 'An act or period of walking.' },
  win: { verb: 'To achieve victory; to gain a prize.', noun: 'A victory.' },
  teach: { verb: 'To give instruction; to cause to learn.' },
  offer: { verb: 'To present for acceptance; to volunteer.', noun: 'An expression of readiness.' },
  remember: { verb: "To have in one's mind; to recall from memory." },
  consider: { verb: 'To think carefully about; to regard as.' },
  appear: { verb: 'To come into sight; to seem or look like.' },
  buy: { verb: 'To obtain something by paying money.' },
  serve: { verb: 'To perform duties for; to provide service.' },
  die: { verb: 'To cease to live; to stop existing.' },
  send: { verb: 'To cause to go to a destination; to transmit.' },
  expect: { verb: 'To regard as likely; to anticipate.' },
  build: { verb: 'To construct or erect; to develop over time.' },
  stay: { verb: 'To remain in the same place; to continue to be.' },
  fall: { verb: 'To drop down; to decrease.', noun: 'A decrease; a drop from a height.' },
  cut: { verb: 'To use a sharp instrument to divide; to reduce.', noun: 'An incision; a reduction.' },
  reach: { verb: 'To arrive at; to stretch out a hand.', noun: 'The extent of stretching; range.' },
  kill: { verb: 'To cause the death of; to put an end to.' },
  remain: { verb: 'To stay in the same place; to continue to exist.' },
  suggest: { verb: 'To put forward for consideration; to imply.' },
  raise: { verb: 'To lift to a higher position; to increase.' },
  pass: { verb: 'To move past; to proceed.', noun: 'A narrow passage; a ticket or permit.' },
  sell: { verb: 'To exchange goods for money.' },
  require: { verb: 'To need for a particular purpose; to demand.' },
  report: { verb: 'To give a spoken or written account of.', noun: 'An account of something.' },
  decide: { verb: 'To make a choice from a number of alternatives.' },
  pull: { verb: 'To exert force to move something toward oneself.', noun: 'An act of pulling.' },
  develop: { verb: 'To grow or cause to grow; to create over time.' },
  eat: { verb: 'To put food into the mouth and swallow.' },
  plan: { verb: 'To decide on a course of action; to intend.', noun: 'A proposal for doing something.' },
  love: { verb: 'To feel deep affection for; to enjoy greatly.', noun: 'A deep feeling of affection.' },
  use: { verb: 'To employ or apply for a purpose.', noun: 'The action of using.' },
  type: { noun: 'A category or class; a printed character.', verb: 'To write using a keyboard.' },
  list: { noun: 'A series of items written or printed.', verb: 'To include in a list.' },
  form: { noun: 'The shape or structure of something; a document.', verb: 'To create or be created.' },
  charge: { verb: 'To demand a price; to load or fill.', noun: 'A price or fee; responsibility.' },
  produce: { verb: 'To make or manufacture; to bring forward.', noun: 'Agricultural products.' },
  result: { noun: 'A consequence or outcome.', verb: 'To arise or follow from.' },
  market: { noun: 'A place where goods are bought and sold.', verb: 'To promote or advertise.' },
  launch: { verb: 'To set in motion; to introduce a new product or service.', noun: 'An act of launching; a product introduction event.' },
};

/* ─── 冷門/生僻中文字過濾 ─── */

const OBSCURE_ZH = new Set(
  '澆鑄熔煉鍛造鑄造冶煉淬鍍鉻鋅錫銨鈉鉀鎂鈣鋁鈦釩鉻錳鐵鈷鎳銅鋅鎵鍺砷硒溴氪銣鍶釔鋯鉬銠鈀鎘銦錫銻銫鋇鑭鈰鐠釹釤銪釓鋱鈥鉺銩鏑鎦鑥鈩鉿鑭鈹鎂鈣鈧鈦釩鉻錳鐵鈷鎳銅鋅鎵鍺'
);

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

/* ─── 整合 ─── */

function mergeMeanings(datamuseDefs, posTranslations, word) {
  const gtxKeys = Object.keys(posTranslations);
  console.log(`[Lookup Debug] 7-A. mergeMeanings: gtxKeys=`, gtxKeys);

  if (gtxKeys.length > 0) {
    const lowerWord = (word || '').toLowerCase();
    const curated = CURATED_ZH[lowerWord] || {};

    const merged = gtxKeys.map((posKey) => {
      const zhPosLabel = mapPos(posKey);
      const enPosKey = REVERSE_POS_MAP[posKey] || posKey.toLowerCase();

      // 優先使用內建標準釋義（嚴格分離各詞性）
      let translation = '';
      if (curated[enPosKey]) {
        translation = curated[enPosKey];
      } else if (curated[posKey]) {
        translation = curated[posKey];
      } else {
        // 後備：使用 GTX 原始資料
        const zhTerms = posTranslations[posKey];
        translation = zhTerms ? zhTerms.join('、') : '';
      }

      // Datamuse 用縮寫 (v, n, adj, adv)，嘗試完整名和縮寫
      const dmKeys = {
        verb: ['verb', 'v'],
        noun: ['noun', 'n'],
        adjective: ['adjective', 'adj'],
        adverb: ['adverb', 'adv'],
      };
      let definition = '';
      const candidates = dmKeys[enPosKey] || [enPosKey];
      for (const k of candidates) {
        if (datamuseDefs[k]) { definition = datamuseDefs[k]; break; }
      }

      // 後備：內建常見單字定義
      if (!definition) {
        const builtinGroup = BUILTIN_DEFS[lowerWord];
        if (builtinGroup) {
          for (const k of candidates) {
            if (builtinGroup[k]) { definition = builtinGroup[k]; break; }
          }
        }
      }

      return {
        partOfSpeech: zhPosLabel,
        translation,
        definition,
        example: '',
      };
    });
    return merged;
  }

  return [
    {
      partOfSpeech: '',
      translation: '',
      definition: '',
      example: '',
    },
  ];
}
