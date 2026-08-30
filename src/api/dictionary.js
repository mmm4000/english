import { getVerbForms } from '../utils/conjugations.js';

/**
 * 單字查詢：Google GTX（主資料源）+ Datamuse（音標備援）
 * 完全不依賴 api.dictionaryapi.dev（已知 522 超時問題）
 *
 * 規格：
 * - 以 POS 為單位聚合：每個詞性只出一個代表選項
 * - GTX 遍歷所有詞性分組（data[1] 或 data[2]）
 * - 形容詞 fallback 搭配具體生活實體，嚴禁抽象主詞
 * - 嚴禁「Understanding ... will help you communicate better」等模板
 * - Definition 必須為英文，禁止填入中文
 */

/* --- 常見動詞 GTX 翻譯優化 --- */
const VERB_ZH_FIX = {
  book: '預訂、預約、登記', run: '奔跑、運作、經營',
  make: '製作、製造、使成為', take: '拿取、攜帶、帶走',
  get: '獲得、取得、變得', go: '去、前進、進行',
  come: '來、到來、發生', see: '看見、理解、查看',
  know: '知道、了解、認識', think: '思考、認為、想',
  give: '給予、提供、讓步', find: '發現、找到、認為',
  tell: '告訴、說、判斷', ask: '詢問、要求、請求',
  work: '工作、運作、有效', feel: '感覺、感受到、認為',
  want: '想要、希望、需要', call: '打電話給、稱為、叫',
  try: '嘗試、試圖、審理', need: '需要、有必要',
  leave: '離開、留下、委託', put: '放置、設置、表達',
  mean: '意思是、意味著、意指', keep: '保留、保持、繼續',
  begin: '開始、著手、起源', show: '展示、顯示、證明',
  hear: '聽見、聽說、審理', play: '玩、播放、演奏',
  move: '移動、搬遷、感動', believe: '相信、認為、信仰',
  bring: '帶來、引起、促使', write: '書寫、撰寫、寫作',
  provide: '提供、供給、準備', sit: '坐下、就座、位於',
  stand: '站立、忍受、位於', lose: '失去、輸掉、迷路',
  pay: '支付、付款、付出', meet: '遇見、會面、滿足',
  include: '包含、包括、列入', set: '設置、設定、安排',
  learn: '學習、學會、得知', change: '改變、更換、兌換',
  lead: '帶領、領導、導致', understand: '理解、了解、懂',
  watch: '觀看、注視、留意', follow: '跟隨、遵循、理解',
  stop: '停止、中止、阻止', create: '創造、創建、造成',
  speak: '說、演講、表明', read: '閱讀、朗讀、理解',
  grow: '成長、增長、種植', open: '打開、開放、開始',
  walk: '走路、散步、行走', win: '贏得、獲勝、取得',
  teach: '教導、教授、教訓', offer: '提供、提議、出價',
  remember: '記得、記住、銘記', consider: '考慮、認為、體諒',
  appear: '出現、似乎、出版', buy: '購買、買、收買',
  serve: '服務、供應、服役', die: '死亡、消逝、渴望',
  send: '傳送、寄送、派遣', expect: '預期、期望、要求',
  build: '建造、建立、構建', stay: '停留、保持、暫住',
  fall: '落下、下降、跌倒', cut: '切割、削減、停電',
  reach: '達到、抵達、伸出手', kill: '殺死、終止、消磨',
  remain: '保持、殘留、依然是', suggest: '建議、暗示、表明',
  raise: '提高、舉起、籌集', pass: '通過、傳遞、消逝',
  sell: '販售、出售、推銷', require: '需要、要求、規定',
  report: '報告、報導、告發', decide: '決定、判斷、解決',
  pull: '拉、吸引、拔除', develop: '發展、開發、成長',
  eat: '吃、食用、耗盡', plan: '計畫、打算、設計',
  love: '愛、喜愛、熱愛', use: '使用、運用、利用',
  launch: '發射、發起、推出', live: '生活、居住、活著',
};

/* --- 常見名詞 GTX 翻譯優化 --- */
const NOUN_ZH_FIX = {
  book: '書籍、本子、冊子', run: '跑步、運行、路程',
  work: '工作、勞動、職業', feel: '感覺、直覺',
  call: '電話、呼叫', try: '嘗試',
  need: '需要、必需品', leave: '假期、許可',
  show: '表演、展覽', play: '遊戲、戲劇',
  move: '行動、步驟', stand: '立場、攤位',
  pay: '薪水', set: '一套、設備',
  change: '變化、零錢', lead: '領先、榜樣',
  watch: '手錶、監視', stop: '車站、停止',
  build: '體格', fall: '下降、秋天',
  cut: '傷口、減少', reach: '範圍、影響力',
  pass: '通行證、通道', report: '報告、成績單',
  pull: '拉力、吸引力', plan: '計畫、方案',
  love: '愛、戀人', use: '用途、使用',
  type: '類型、型號、文字', list: '清單、列表、目錄',
  form: '形狀、表格、體制', charge: '費用、負責',
  produce: '農產品', result: '結果、成果、後果',
  market: '市場、市集、行情', launch: '發布會、發射、下水',
  make: '品牌、體質', take: '看法、場景',
  go: '嘗試、一番努力', give: '彈性、伸縮性',
};

/* --- 常見形容詞英文定義（禁止填入中文） --- */
const ADJ_EN_DEF = {
  stinky: 'Having a strong, unpleasant smell; foul-smelling.',
  smelly: 'Having an unpleasant odor; malodorous.',
  dirty: 'Covered or marked with an unclean substance; not clean.',
  clean: 'Free from dirt or impurities; unsoiled.',
  hot: 'Having a high temperature; giving off heat.',
  cold: 'Having a low temperature; lacking warmth.',
  big: 'Of considerable size, extent, or intensity.',
  small: 'Of a size that is less than normal or usual.',
  good: 'Of a high quality, standard, or level.',
  bad: 'Of poor quality or a low standard; inferior.',
  fast: 'Moving or capable of moving at high speed.',
  slow: 'Moving or capable of moving only slowly; not quick.',
  happy: 'Feeling or showing pleasure or contentment.',
  sad: 'Feeling or showing sorrow; unhappy.',
  angry: 'Feeling or showing strong displeasure or hostility.',
  beautiful: 'Pleasing the senses or mind aesthetically.',
  ugly: 'Unpleasant to look at; sightly.',
  strong: 'Having great physical power; forceful.',
  weak: 'Lacking physical strength, especially as a result of age or illness.',
  old: 'Having lived for a long time; no longer young.',
  young: 'Having lived or existed for only a short time.',
  new: 'Recently made, invented, or discovered.',
  bright: 'Giving out or reflecting much light; shining.',
  dark: 'With little or no light; gloomy.',
  soft: 'Easy to mold, cut, compress, or fold; not hard or firm.',
  hard: 'Solid, firm, and rigid; not easily bent or broken.',
  loud: 'Producing much noise; easily heard.',
  quiet: 'Making little or no noise.',
  sweet: 'Having the taste or flavor characteristic of sugar.',
  bitter: 'Having a sharp, unpleasant taste.',
  fresh: 'Recently made or obtained; not stale.',
  dry: 'Free from moisture or liquid; not wet.',
  wet: 'Covered or saturated with water or another liquid.',
  warm: 'Having a moderate degree of heat.',
  cool: 'Of a slightly low temperature; pleasantly cold.',
  rich: 'Having a great deal of money; wealthy.',
  poor: 'Lacking sufficient money to live at a standard considered comfortable.',
  tired: 'In need of sleep or rest; weary.',
  busy: 'Having much to do; occupied.',
  free: 'Not under the control or domination of another.',
  ready: 'In a suitable state for an activity or situation.',
  wrong: 'Not correct or true; mistaken.',
  right: 'Factually correct; true.',
  safe: 'Protected from or not exposed to danger or risk.',
  dangerous: 'Likely to cause harm or injury.',
  funny: 'Causing laughter or amusement; humorous.',
  serious: 'Demanding careful consideration; important.',
  important: 'Of great significance or value.',
  simple: 'Easily understood or done.',
  difficult: 'Needing much effort or skill to accomplish.',
  easy: 'Achieved without great effort; posing no difficulty.',
  true: 'In accordance with fact or reality.',
  false: 'Not according to truth or fact; incorrect.',
  possible: 'Able to be done or achieved.',
  impossible: 'Not able to occur, exist, or be done.',
  special: 'Better, greater, or otherwise different from what is usual.',
  common: 'Occurring, found, or done often; prevalent.',
  rare: 'Not occurring very often.',
  strange: 'Unusual or surprising; difficult to understand or explain.',
  normal: 'Conforming to a standard; usual, typical, or expected.',
  pretty: 'Attractive in a delicate way.',
  cute: 'Attractive in a pretty or endearing way.',
  scary: 'Frightening; causing fear.',
  terrible: 'Extremely bad or serious.',
  awful: 'Very bad or unpleasant.',
  excellent: 'Extremely good; outstanding.',
  perfect: 'Having all the required elements; complete.',
  whole: 'All of; entire.',
  empty: 'Containing nothing; not filled or occupied.',
  full: 'Containing as much or as many as possible.',
  dark: 'With little or no light.',
  deep: 'Extending far down from the surface.',
  wide: 'Of great or more than average width.',
  narrow: 'Of small width in relation to length.',
  thin: 'Having a small distance between opposite sides.',
  thick: 'Having a large distance between opposite sides.',
  heavy: 'Of great weight.',
  light: 'Of little weight; not heavy.',
  loud: 'Producing much noise.',
  quiet: 'Making little or no noise.',
  slow: 'Moving without much speed.',
  fast: 'Moving at high speed.',
  early: 'Before the usual or expected time.',
  late: 'After the expected or usual time.',
  far: 'At, to, or by a great distance.',
  near: 'Close in distance or time.',
  always: 'At all times; on every occasion.',
  never: 'At no time; not ever.',
};

/* --- 常見名詞英文定義 --- */
const NOUN_EN_DEF = {
  book: 'A written or printed work of pages bound together.',
  run: 'An act of running at a steady pace.',
  work: 'Activity involving mental or physical effort.',
  call: 'A telephone conversation or attempt to reach someone.',
  show: 'A public performance or entertainment event.',
  play: 'Activity for enjoyment and recreation.',
  move: 'An act of changing location or position.',
  stand: 'A position or viewpoint held by someone.',
  pay: 'Money received for regular work.',
  set: 'A collection of related items.',
  change: 'The act of becoming different.',
  lead: 'The initiative or example given to others.',
  watch: 'A small timepiece worn on the wrist.',
  stop: 'A cessation of movement or activity.',
  fall: 'A decrease in level or amount.',
  cut: 'An opening made by cutting.',
  pass: 'A ticket or document giving authorization.',
  report: 'A detailed account or statement.',
  pull: 'The act of exerting force to draw something.',
  plan: 'A detailed proposal for doing something.',
  type: 'A category of people or things.',
  list: 'A number of items written or printed together.',
  form: 'The visible shape or appearance of something.',
  result: 'A consequence or outcome.',
  market: 'A regular gathering for buying and selling.',
};

/* --- 常見動詞英文定義 --- */
const VERB_EN_DEF = {
  book: 'To reserve accommodation, a ticket, etc. in advance.',
  run: 'To move at a speed faster than a walk.',
  make: 'To bring into existence; to create or produce.',
  take: 'To lay hold of something with one\'s hands.',
  get: 'To come to have or receive something.',
  go: 'To move or travel to a place.',
  come: 'To move or travel toward the speaker.',
  see: 'To perceive with the eyes.',
  know: 'To be aware of through observation or information.',
  think: 'To use the mind to consider or reason about.',
  give: 'To freely transfer possession of something.',
  find: 'To discover something by searching.',
  tell: 'To communicate information to someone.',
  ask: 'To inquire or request information.',
  work: 'To be engaged in physical or mental activity.',
  feel: 'To experience an emotion or sensation.',
  want: 'To have a desire for something.',
  call: 'To contact someone by phone.',
  try: 'To attempt to do something.',
  need: 'To require something because it is essential.',
  leave: 'To depart from a place.',
  put: 'To move something to a particular position.',
  mean: 'To have as a signification or definition.',
  keep: 'To continue to have or hold.',
  begin: 'To start doing something.',
  show: 'To allow something to be seen.',
  hear: 'To perceive sound with the ears.',
  play: 'To engage in activity for enjoyment.',
  move: 'To change position or place.',
  believe: 'To accept something as true.',
  bring: 'To take something to a place.',
  write: 'To compose text or put words on paper.',
  provide: 'To make available for use; to supply.',
  sit: 'To be in a position with the body supported.',
  stand: 'To be in an upright position on the feet.',
  lose: 'To be deprived of something.',
  pay: 'To give money in exchange for goods or services.',
  meet: 'To come into the presence of someone.',
  include: 'To contain as part of a whole.',
  set: 'To put something in a particular position.',
  learn: 'To gain knowledge or skill.',
  change: 'To make or become different.',
  lead: 'To guide or direct a group.',
  understand: 'To comprehend the meaning of something.',
  watch: 'To observe attentively over a period of time.',
  follow: 'To go or come after someone.',
  stop: 'To cease moving or doing something.',
  create: 'To bring something into existence.',
  speak: 'To say words or talk.',
  read: 'To look at and understand written words.',
  grow: 'To increase in size over time.',
  open: 'To move a door or lid so as to allow access.',
  walk: 'To move at a regular pace on foot.',
  win: 'To be successful in a contest or competition.',
  teach: 'To give instruction or lessons.',
  offer: 'To present something for acceptance.',
  remember: 'To recall from memory.',
  consider: 'To think carefully about something.',
  appear: 'To become visible or come into sight.',
  buy: 'To obtain something by paying for it.',
  serve: 'To perform duties for someone.',
  die: 'To cease to live.',
  send: 'To cause to go to a destination.',
  expect: 'To regard something as likely to happen.',
  build: 'To construct something by putting parts together.',
  stay: 'To remain in a particular place.',
  fall: 'To move downward quickly.',
  cut: 'To use a sharp instrument to divide something.',
  reach: 'To stretch out an arm to touch something.',
  kill: 'To cause the death of a living thing.',
  remain: 'To stay in the same place.',
  suggest: 'To put forward an idea for consideration.',
  raise: 'To lift to a higher position.',
  pass: 'To move past something.',
  sell: 'To exchange goods for money.',
  require: 'To need something for a particular purpose.',
  report: 'To give a spoken or written account.',
  decide: 'To make a choice from a number of alternatives.',
  pull: 'To exert force to draw something toward you.',
  develop: 'To grow or cause to grow.',
  eat: 'To put food into the mouth and swallow.',
  plan: 'To decide on a course of action.',
  love: 'To feel deep affection for someone.',
  use: 'To employ something for a purpose.',
  launch: 'To set in motion a new activity.',
  live: 'To be alive; to have life.',
};

/* --- 詞性優先級 --- */
const POS_PRIORITY = { verb: 1, noun: 2, adjective: 3, adverb: 4 };

const POS_MAP = {
  noun: '名詞', verb: '動詞', adjective: '形容詞', adverb: '副詞',
  pronoun: '代名詞', preposition: '介系詞', conjunction: '連接詞',
  interjection: '感嘆詞', determiner: '限定詞', article: '冠詞',
};

/* --- POS 標準化 --- */
function normalizePos(raw) {
  const s = (raw || '').toLowerCase().trim();
  if (['noun','n','n.'].includes(s)) return 'noun';
  if (['verb','v','v.','vt','vi','vb'].includes(s)) return 'verb';
  if (['adjective','adj','adj.'].includes(s)) return 'adjective';
  if (['adverb','adv','adv.'].includes(s)) return 'adverb';
  if (['pronoun','pron','pron.'].includes(s)) return 'pronoun';
  if (['preposition','prep','prep.'].includes(s)) return 'preposition';
  if (['conjunction','conj','conj.'].includes(s)) return 'conjunction';
  if (['interjection','intj','intj.'].includes(s)) return 'interjection';
  if (['determiner','det','det.'].includes(s)) return 'determiner';
  if (['article','art','art.'].includes(s)) return 'article';
  if (['numeral','num','num.'].includes(s)) return 'numeral';
  if (['phrasal verb','phr.v.'].includes(s)) return 'verb';
  if (['名詞','名词'].includes(s)) return 'noun';
  if (['動詞','动词'].includes(s)) return 'verb';
  if (['形容詞','形容词'].includes(s)) return 'adjective';
  if (['副詞','副词'].includes(s)) return 'adverb';
  if (['代名詞','代词'].includes(s)) return 'pronoun';
  if (['介系詞','介词'].includes(s)) return 'preposition';
  if (['連接詞','连接词'].includes(s)) return 'conjunction';
  if (['感嘆詞','感叹词'].includes(s)) return 'interjection';
  if (s === '限定詞') return 'determiner';
  if (['冠詞','冠词'].includes(s)) return 'article';
  return s;
}

/* --- 主查詢函式 --- */
export async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) throw new Error('請輸入單字');

  const [gtxData, datamuseData] = await Promise.all([fetchGtx(word), fetchDatamuse(word)]);

  // 1. 音標：優先 GTX -> Datamuse ipa_pron
  let phonetic = '';
  if (gtxData?.[0]?.[0]?.[3]) {
    phonetic = gtxData[0][0][3];
  } else if (gtxData?.[0]?.[0]?.[2]) {
    phonetic = gtxData[0][0][2];
  } else if (datamuseData?.[0]?.ipa_pron) {
    phonetic = '/' + datamuseData[0].ipa_pron + '/';
  }

  // 2. GTX 遍歷所有詞性分組（data[1] 或 data[2]）
  const gtxZh = gtxData?.[0]?.[0]?.[0] || '';
  const zhByPos = {};
  const gtxPosList = [];

  const gtxDictRaw = Array.isArray(gtxData?.[1]) ? gtxData[1]
    : Array.isArray(gtxData?.[2]) ? gtxData[2] : [];

  for (const group of gtxDictRaw) {
    if (!Array.isArray(group) || group.length < 2) continue;
    const rawPos = normalizePos(group[0] || '');
    if (!rawPos || rawPos === 'other') continue;
    gtxPosList.push(rawPos);

    // group[1] 可能是 ["詞1","詞2"] 或 [["詞1","翻譯1"],["詞2","翻譯2"]]
    const rawTerms = Array.isArray(group[1]) ? group[1] : [];
    const terms = rawTerms
      .map(t => {
        if (typeof t === 'string') return t;
        if (Array.isArray(t) && t.length > 0 && typeof t[0] === 'string') return t[0];
        return null;
      })
      .filter(t => typeof t === 'string' && t.trim())
      .slice(0, 3);
    if (terms.length > 0) {
      zhByPos[rawPos] = terms.join('、');
    }
  }

  // 3. 確保至少有一個 POS
  if (gtxPosList.length === 0 && gtxZh) {
    // GTX 有翻譯但沒有明確 POS，嘗試從翻譯推斷
    gtxPosList.push('noun');
    zhByPos['noun'] = gtxZh;
  }

  // 4. 為每個 POS 組裝 definition（英文）+ 翻譯（中文）+ 例句
  const aggregatedMeanings = [];

  for (const rawPos of gtxPosList) {
    const posZh = POS_MAP[rawPos] || rawPos;
    const w = word;

    // 英文定義：優先查表，再從翻譯推導
    let enDef = getEnDefinition(w, rawPos, gtxZh);

    // 中文翻譯：優先查表，再從 GTX 取得
    let zhTranslation = getZhTranslation(rawPos, zhByPos, gtxZh, w);

    aggregatedMeanings.push({
      pos: posZh,
      rawPos,
      definition: enDef,
      translation: zhTranslation,
      exampleEn: '',
    });
  }

  // 5. 詞性排序：動詞 > 名詞 > 形容詞 > 副詞
  aggregatedMeanings.sort((a, b) => (POS_PRIORITY[a.rawPos] || 99) - (POS_PRIORITY[b.rawPos] || 99));

  // 6. 動詞變化
  const hasVerb = aggregatedMeanings.some(m => m.rawPos === 'verb') || gtxPosList.includes('verb');
  const verbForms = hasVerb ? getVerbForms(word) : null;

  // 7. 整合例句 + 翻譯
  const finalMeanings = await Promise.all(
    aggregatedMeanings.map(async m => {
      let exEn = generateNaturalExample(word, m.rawPos);
      let exZh = exEn ? await translateSentence(exEn) : '';
      return {
        pos: m.pos,
        label: '[' + m.pos + '] ' + m.translation,
        translation: m.translation,
        definition: m.definition,
        exampleEn: exEn,
        exampleZh: exZh,
      };
    })
  );

  return { word, phonetic, verb_forms: verbForms, meanings: finalMeanings };
}

/* --- 英文定義：優先查表 → 模板生成（禁止中文） --- */
function getEnDefinition(word, rawPos, gtxZh) {
  const w = (word || '').toLowerCase();

  // 查表
  if (rawPos === 'adjective' && ADJ_EN_DEF[w]) return ADJ_EN_DEF[w];
  if (rawPos === 'noun' && NOUN_EN_DEF[w]) return NOUN_EN_DEF[w];
  if (rawPos === 'verb' && VERB_EN_DEF[w]) return VERB_EN_DEF[w];

  // 模板生成（英文）
  if (rawPos === 'adjective') return 'Having the quality of being ' + w + '; characterized by ' + w + '.';
  if (rawPos === 'verb') return 'To ' + w + ' something; to perform the action of ' + w + '.';
  if (rawPos === 'noun') return 'A ' + w + '; something related to ' + w + '.';
  if (rawPos === 'adverb') return 'In a ' + w + ' manner; to a ' + w + ' degree.';
  return 'The word "' + w + '" in English.';
}

/* --- 中文翻譯：優先查表 → GTX 詞性分組 → GTX 核心翻譯 --- */
function getZhTranslation(rawPos, zhByPos, gtxZh, word) {
  const w = (word || '').toLowerCase();
  if (rawPos === 'verb' && VERB_ZH_FIX[w]) return VERB_ZH_FIX[w];
  if (rawPos === 'noun' && NOUN_ZH_FIX[w]) return NOUN_ZH_FIX[w];
  if (zhByPos[rawPos]) return zhByPos[rawPos];
  const zhPos = POS_MAP[rawPos] || '';
  if (zhPos && zhByPos[zhPos]) return zhByPos[zhPos];
  return gtxZh || '載入中…';
}

/* --- 自然例句產生器（無模板廢話） --- */
function generateNaturalExample(word, rawPos) {
  const pool = {
    verb: [
      'We need to ' + word + ' the schedule as soon as possible.',
      'She decided to ' + word + ' the problem before it got worse.',
      'They plan to ' + word + ' a new project next month.',
      'He always tries to ' + word + ' his work on time.',
      'We should ' + word + ' this opportunity while we can.',
      'Can you ' + word + ' me a favor and pass this along?',
    ],
    noun: [
      'She opened the ' + word + ' and began reading the first chapter.',
      'The ' + word + ' on the table belongs to my roommate.',
      'I bought a new ' + word + ' at the store yesterday.',
      'The ' + word + ' was placed right in the center of the room.',
      'Everyone noticed the ' + word + ' sitting by the window.',
      'This ' + word + ' is one of the best I have ever seen.',
    ],
    adjective: [
      'The old gym socks left in the bag were extremely ' + word + '.',
      'The food in the fridge turned ' + word + ' after a few days.',
      'The room felt ' + word + ' with all the windows closed.',
      'The air in the basement was ' + word + ' and hard to breathe.',
      'Everyone noticed the ' + word + ' smell coming from the kitchen.',
      'Her hair felt ' + word + ' after the long flight.',
      'The carpet looked ' + word + ' after the party was over.',
      'These old gym shoes are really ' + word + '.',
    ],
    adverb: [
      'She finished the report ' + word + ' and handed it in.',
      'He spoke ' + word + ' during the team meeting.',
      'The team worked ' + word + ' to meet the deadline.',
      'They ' + word + ' agreed to move forward with the plan.',
      'The cat ' + word + ' jumped onto the counter.',
      'She ' + word + ' walked past the crowd without anyone noticing.',
    ],
  };
  const list = pool[rawPos] || [
    'I came across the word "' + word + '" in today\'s newspaper.',
    'The word "' + word + '" appeared several times in the article.',
  ];
  return list[Math.floor(Math.random() * list.length)];
}

/* --- 例句翻譯（Google GTX） --- */
export async function translateSentence(enText) {
  if (!enText) return '';
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=' + encodeURIComponent(enText);
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    return data?.[0]?.[0]?.[0] || '';
  } catch (_) { return ''; }
}

/* --- UI 刷新用例句 --- */
export function getSmartSentence(word, pos, verbForms) {
  const cleanPos = (pos || '').toLowerCase();
  let rawPos = 'other';
  if (cleanPos.includes('動') || cleanPos.includes('verb')) rawPos = 'verb';
  else if (cleanPos.includes('名') || cleanPos.includes('noun')) rawPos = 'noun';
  else if (cleanPos.includes('形') || cleanPos.includes('adj')) rawPos = 'adjective';
  else if (cleanPos.includes('副') || cleanPos.includes('adv')) rawPos = 'adverb';
  return generateNaturalExample(word, rawPos);
}

/* --- 請求函式 --- */
async function fetchGtx(word) {
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&q=' + encodeURIComponent(word);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function fetchDatamuse(word) {
  try {
    const url = 'https://api.datamuse.com/words?sp=' + encodeURIComponent(word) + '&ipa=1&max=1';
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}