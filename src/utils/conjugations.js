const IRREGULAR = {
  arise: { pp: 'arose', ptp: 'arisen' },
  be: { pp: 'was', ptp: 'been', gerund: 'being', third: 'is' },
  bear: { pp: 'bore', ptp: 'borne' },
  beat: { pp: 'beat', ptp: 'beaten' },
  become: { pp: 'became', ptp: 'become' },
  begin: { pp: 'began', ptp: 'begun' },
  bend: { pp: 'bent', ptp: 'bent' },
  bet: { pp: 'bet', ptp: 'bet' },
  bite: { pp: 'bit', ptp: 'bitten' },
  bleed: { pp: 'bled', ptp: 'bled' },
  blow: { pp: 'blew', ptp: 'blown' },
  break: { pp: 'broke', ptp: 'broken' },
  bring: { pp: 'brought', ptp: 'brought' },
  build: { pp: 'built', ptp: 'built' },
  burn: { pp: 'burnt', ptp: 'burnt' },
  burst: { pp: 'burst', ptp: 'burst' },
  buy: { pp: 'bought', ptp: 'bought' },
  catch: { pp: 'caught', ptp: 'caught' },
  choose: { pp: 'chose', ptp: 'chosen' },
  come: { pp: 'came', ptp: 'come' },
  cost: { pp: 'cost', ptp: 'cost' },
  cut: { pp: 'cut', ptp: 'cut' },
  deal: { pp: 'dealt', ptp: 'dealt' },
  dig: { pp: 'dug', ptp: 'dug' },
  do: { pp: 'did', ptp: 'done', third: 'does', gerund: 'doing' },
  draw: { pp: 'drew', ptp: 'drawn' },
  drink: { pp: 'drank', ptp: 'drunk' },
  drive: { pp: 'drove', ptp: 'driven' },
  eat: { pp: 'ate', ptp: 'eaten' },
  fall: { pp: 'fell', ptp: 'fallen' },
  feed: { pp: 'fed', ptp: 'fed' },
  feel: { pp: 'felt', ptp: 'felt' },
  fight: { pp: 'fought', ptp: 'fought' },
  find: { pp: 'found', ptp: 'found' },
  fly: { pp: 'flew', ptp: 'flown' },
  forget: { pp: 'forgot', ptp: 'forgotten' },
  forgive: { pp: 'forgave', ptp: 'forgiven' },
  freeze: { pp: 'froze', ptp: 'frozen' },
  get: { pp: 'got', ptp: 'got' },
  give: { pp: 'gave', ptp: 'given' },
  go: { pp: 'went', ptp: 'gone', third: 'goes', gerund: 'going' },
  grow: { pp: 'grew', ptp: 'grown' },
  hang: { pp: 'hung', ptp: 'hung' },
  have: { pp: 'had', ptp: 'had', third: 'has', gerund: 'having' },
  hear: { pp: 'heard', ptp: 'heard' },
  hide: { pp: 'hid', ptp: 'hidden' },
  hit: { pp: 'hit', ptp: 'hit' },
  hold: { pp: 'held', ptp: 'held' },
  hurt: { pp: 'hurt', ptp: 'hurt' },
  keep: { pp: 'kept', ptp: 'kept' },
  kneel: { pp: 'knelt', ptp: 'knelt' },
  know: { pp: 'knew', ptp: 'known' },
  lay: { pp: 'laid', ptp: 'laid' },
  lead: { pp: 'led', ptp: 'led' },
  leave: { pp: 'left', ptp: 'left' },
  lend: { pp: 'lent', ptp: 'lent' },
  let: { pp: 'let', ptp: 'let' },
  lie: { pp: 'lay', ptp: 'lain' },
  lose: { pp: 'lost', ptp: 'lost' },
  make: { pp: 'made', ptp: 'made' },
  mean: { pp: 'meant', ptp: 'meant' },
  meet: { pp: 'met', ptp: 'met' },
  mistake: { pp: 'mistook', ptp: 'mistaken' },
  overcome: { pp: 'overcame', ptp: 'overcome' },
  pay: { pp: 'paid', ptp: 'paid' },
  put: { pp: 'put', ptp: 'put' },
  quit: { pp: 'quit', ptp: 'quit' },
  read: { pp: 'read', ptp: 'read' },
  ride: { pp: 'rode', ptp: 'ridden' },
  ring: { pp: 'rang', ptp: 'rung' },
  rise: { pp: 'rose', ptp: 'risen' },
  run: { pp: 'ran', ptp: 'run' },
  say: { pp: 'said', ptp: 'said' },
  see: { pp: 'saw', ptp: 'seen' },
  sell: { pp: 'sold', ptp: 'sold' },
  send: { pp: 'sent', ptp: 'sent' },
  set: { pp: 'set', ptp: 'set' },
  shake: { pp: 'shook', ptp: 'shaken' },
  shed: { pp: 'shed', ptp: 'shed' },
  shoot: { pp: 'shot', ptp: 'shot' },
  show: { pp: 'showed', ptp: 'shown' },
  shut: { pp: 'shut', ptp: 'shut' },
  sing: { pp: 'sang', ptp: 'sung' },
  sink: { pp: 'sank', ptp: 'sunk' },
  sit: { pp: 'sat', ptp: 'sat' },
  sleep: { pp: 'slept', ptp: 'slept' },
  slide: { pp: 'slid', ptp: 'slid' },
  speak: { pp: 'spoke', ptp: 'spoken' },
  spend: { pp: 'spent', ptp: 'spent' },
  spread: { pp: 'spread', ptp: 'spread' },
  stand: { pp: 'stood', ptp: 'stood' },
  steal: { pp: 'stole', ptp: 'stolen' },
  stick: { pp: 'stuck', ptp: 'stuck' },
  strike: { pp: 'struck', ptp: 'stricken' },
  swear: { pp: 'swore', ptp: 'sworn' },
  swim: { pp: 'swam', ptp: 'swum' },
  take: { pp: 'took', ptp: 'taken' },
  teach: { pp: 'taught', ptp: 'taught' },
  tear: { pp: 'tore', ptp: 'torn' },
  tell: { pp: 'told', ptp: 'told' },
  think: { pp: 'thought', ptp: 'thought' },
  throw: { pp: 'threw', ptp: 'thrown' },
  undergo: { pp: 'underwent', ptp: 'undergone' },
  understand: { pp: 'understood', ptp: 'understood' },
  undertake: { pp: 'undertook', ptp: 'undertaken' },
  wake: { pp: 'woke', ptp: 'woken' },
  wear: { pp: 'wore', ptp: 'worn' },
  win: { pp: 'won', ptp: 'won' },
  withdraw: { pp: 'withdrew', ptp: 'withdrawn' },
  write: { pp: 'wrote', ptp: 'written' },
};

function endsWithConsonant(word) {
  const w = word.toLowerCase();
  const vowels = 'aeiou';
  return w.length > 0 && !vowels.includes(w[w.length - 1]);
}

function isVowel(ch) {
  return 'aeiou'.includes(ch.toLowerCase());
}

function isCVC(word) {
  const w = word.toLowerCase();
  if (w.length < 3) return false;
  const last = w[w.length - 1];
  const prev = w[w.length - 2];
  const prevPrev = w[w.length - 3];
  if (last === 'w' || last === 'x' || last === 'y') return false;
  return !isVowel(last) && isVowel(prev) && !isVowel(prevPrev);
}

function addS(word) {
  const w = word.toLowerCase();
  if (w.endsWith('s') || w.endsWith('sh') || w.endsWith('ch') || w.endsWith('x') || w.endsWith('z')) return w + 'es';
  if (w.endsWith('y') && endsWithConsonant(w.slice(0, -1))) return w.slice(0, -1) + 'ies';
  return w + 's';
}

function addEd(word) {
  const w = word.toLowerCase();
  if (w.endsWith('e')) return w + 'd';
  if (w.endsWith('y') && endsWithConsonant(w.slice(0, -1))) return w.slice(0, -1) + 'ied';
  if (w.endsWith('c')) return w + 'ked';
  if (isCVC(w)) return w + w[w.length - 1] + 'ed';
  return w + 'ed';
}

function addIng(word) {
  const w = word.toLowerCase();
  if (w.endsWith('ie')) return w.slice(0, -2) + 'ying';
  if (w.endsWith('e') && !w.endsWith('ee') && !w.endsWith('ye')) return w.slice(0, -1) + 'ing';
  if (w.endsWith('c')) return w + 'king';
  if (isCVC(w)) return w + w[w.length - 1] + 'ing';
  return w + 'ing';
}

export function getVerbForms(word) {
  const w = word.toLowerCase();
  const irr = IRREGULAR[w];
  if (irr) {
    return {
      base: w,
      third: irr.third || addS(w),
      present_participle: irr.gerund || addIng(w),
      past_tense: irr.pp,
      past_participle: irr.ptp,
    };
  }
  return {
    base: w,
    third: addS(w),
    present_participle: addIng(w),
    past_tense: addEd(w),
    past_participle: addEd(w),
  };
}

export function isLikelyVerb(meanings) {
  if (!meanings || !Array.isArray(meanings)) return false;
  return meanings.some(m => (m.partOfSpeech || '').toLowerCase().includes('verb'));
}
