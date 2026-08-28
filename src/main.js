import { sm2 } from './db/scheduler.js';
import { getAllCards, findCardByWord, saveCard, deleteCard } from './db/index.js';
import { getVerbForms, isLikelyVerb } from './utils/conjugations.js';
import { fetchTatoebaExamples } from './utils/tatoeba.js';
import { getLocalExample, generateAutoExample } from './utils/examples.js';
import { generateListeningQuestions, getListeningBankSize } from './utils/listeningGenerator.js';
import { lookupWord, getSmartSentence, translateSentence } from './api/dictionary.js';

const $ = (sel) => document.querySelector(sel);
const app = () => $('#app');

let currentView = 'home';
let detailCard = null;
let allCards = [];

let pendingLookups = [];

/* ─── Tatoeba example cache (runtime only) ─── */
const tatoebaCache = {};
function getTatoebaCache(word, meaningIdx) {
  const key = `${word}_${meaningIdx}`;
  if (!tatoebaCache[key]) tatoebaCache[key] = { examples: [], currentIdx: -1 };
  return tatoebaCache[key];
}

const BATCH_SEP = ' ||| ';
const BATCH_TIMEOUT = 3000;

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (_) {}
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:.6rem 1.2rem;border-radius:.5rem;z-index:999;font-size:.9rem;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/* ─── Meaning 標準化（相容新舊格式） ─── */

function normalizeMeaning(m) {
  if (!m) return { pos: '', label: '', translation: '', definition: '', exampleEn: '', exampleZh: '' };
  // 新格式已有 pos 欄位
  if (m.pos !== undefined) {
    return {
      pos: m.pos || '',
      label: m.label || `[${m.pos || ''}] ${m.translation || ''}`,
      translation: m.translation || '',
      definition: m.definition || '',
      exampleEn: m.exampleEn || '',
      exampleZh: m.exampleZh || '',
    };
  }
  // 舊格式相容
  return {
    pos: m.partOfSpeech || '',
    label: `[${m.partOfSpeech || ''}] ${m.translation_zh || ''}`,
    translation: m.translation_zh || '',
    definition: m.definition_en || '',
    exampleEn: m.example_en || '',
    exampleZh: m.example_zh || '',
  };
}

function getActiveMeaning(card) {
  if (card && card.meanings && card.meanings.length > 0) {
    const idx = Math.min(card.selected_meaning_index || 0, card.meanings.length - 1);
    return normalizeMeaning(card.meanings[idx]);
  }
  return { pos: '', label: '', translation: card?.translation_zh || '', definition: card?.definition_en || '', exampleEn: card?.example_en || '', exampleZh: '' };
}

/* ─── Translation with fallback ─── */
async function translateToZh(text) {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Google ${res.status}`);
    const data = await res.json();
    const result = data[0]?.map(item => item[0]).join('') || '';
    if (result) return result;
  } catch (e) {
    console.log('[Translate] Google failed, trying MyMemory:', e.message);
  }
  try {
    const trUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`;
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 5000);
    const res = await fetch(trUrl, { signal: controller2.signal });
    clearTimeout(timer2);
    if (!res.ok) return '';
    const data = await res.json();
    const result = data.responseData?.translatedText || '';
    if (result && result.toLowerCase() !== text.toLowerCase()) return result;
  } catch (_) {}
  return '';
}

async function batchTranslate(texts) {
  const results = await Promise.all(texts.map(t => translateToZh(t)));
  return results;
}

/* ─── Background translation ─── */
async function translateMeaningOnDemand(m, word) {
  if (m.translation && m.exampleZh) return;
  const texts = [m.definition || '', m.exampleEn || ''];
  const results = await batchTranslate(texts);
  if (!m.translation) m.translation = results[0] || '';
  if (!m.exampleZh) m.exampleZh = results[1] || '';
}

async function translateMeaningsInBackground(meanings, word) {
  console.log(`[AddWord Debug] translateMeaningsInBackground: 開始，word="${word}", meanings=${meanings.length} 筆`);
  const texts = [word];
  for (const m of meanings.slice(0, 4)) {
    texts.push(m.definition || '');
    texts.push(m.exampleEn || '');
  }
  console.log(`[AddWord Debug] translateMeaningsInBackground: 準備翻譯 ${texts.length} 段文字`, texts);

  let results = await batchTranslate(texts);
  console.log(`[AddWord Debug] translateMeaningsInBackground: batchTranslate 結果`, results);

  let idx = 0;
  const wordZh = results[idx++] || '';
  console.log(`[AddWord Debug] translateMeaningsInBackground: wordZh="${wordZh}"`);
  for (const m of meanings.slice(0, 4)) {
    const defZh = results[idx++] || '';
    const exZh = results[idx++] || '';
    if (!m.translation && defZh) m.translation = defZh;
    if (!m.exampleZh && exZh) m.exampleZh = exZh;
    if (!m.translation && wordZh) m.translation = wordZh;
    console.log(`[AddWord Debug] translateMeaningsInBackground: ${m.pos} =>`, {
      translation: m.translation,
      exampleZh: m.exampleZh,
    });
  }

  const needsRetry = meanings.slice(0, 4).filter(m => !m.translation);
  if (needsRetry.length > 0) {
    console.log(`[AddWord Debug] translateMeaningsInBackground: 有 ${needsRetry.length} 筆缺少翻譯，重試`);
    const retryTexts = needsRetry.map(m => m.definition || '');
    const retryResults = await batchTranslate(retryTexts);
    for (let i = 0; i < needsRetry.length; i++) {
      if (!needsRetry[i].translation && retryResults[i]) needsRetry[i].translation = retryResults[i];
      else if (!needsRetry[i].translation && wordZh) needsRetry[i].translation = wordZh;
    }
  }

  if (currentView === 'add') {
    const sel = document.getElementById('meaning-select');
    if (sel && meanings.length >= 1) {
      sel.innerHTML = meanings.map((m, i) => {
        return `<option value="${i}">${m.label || `[${m.pos}] ${m.translation}`}</option>`;
      }).join('');
      console.log(`[AddWord Debug] translateMeaningsInBackground: 下拉選單已更新 (含翻譯)`);
    }
    const inpZh = $('#inp-zh');
    const selIdx = pendingLookups[0]?.selected_meaning_index || 0;
    if (inpZh && meanings[selIdx] && !inpZh.value) {
      inpZh.value = meanings[selIdx].translation || '';
      console.log(`[AddWord Debug] translateMeaningsInBackground: inp-zh 已填入`, meanings[selIdx].translation);
    }
    if (pendingLookups[0]) {
      pendingLookups[0].wordZh = wordZh;
      pendingLookups[0].meanings = meanings;
      console.log(`[AddWord Debug] translateMeaningsInBackground: pendingLookups.meanings 已更新`);
    }
  }
}

/* ─── Rendering ─── */
function nav() {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'add', label: 'Add' },
    { id: 'quiz', label: 'Quiz' },
  ];
  return `
    <nav style="position:fixed;bottom:0;left:0;right:0;display:flex;border-top:1px solid #1e293b;background:#0f172a;padding-bottom:env(safe-area-inset-bottom);">
      ${tabs.map(t => `
        <button data-nav="${t.id}" style="flex:1;padding:1rem 0;background:none;border:none;color:${currentView===t.id?'#3b82f6':'#94a3b8'};font-size:.85rem;cursor:pointer;min-height:44px;">
          ${t.label}
        </button>
      `).join('')}
    </nav>
  `;
}

function meaningLabel(m) {
  const nm = normalizeMeaning(m);
  const pos = nm.pos || '—';
  const zh = nm.translation || '';
  if (!zh) return `[${pos}] 載入中…`;
  const short = zh.length > 10 ? zh.slice(0, 10) + '…' : zh;
  return `[${pos}] ${short}`;
}

function renderVerbFormsChips(verb_forms) {
  if (!verb_forms) return '';
  const forms = [
    { label: '原形', key: 'base' },
    { label: '三單', key: 'third' },
    { label: '過去式', key: 'past_tense' },
    { label: '過去分詞', key: 'past_participle' },
    { label: 'V-ing', key: 'present_participle' },
  ];
  return `
    <div style="margin-bottom:1rem;">
      <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.5rem;">動詞變化</div>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
        ${forms.map(f => `
          <span style="display:inline-flex;align-items:center;gap:.3rem;background:#1e3a5f;color:#93c5fd;padding:.3rem .6rem;border-radius:.3rem;font-size:.8rem;">
            <span style="color:#64748b;font-size:.7rem;">${f.label}</span>
            <span style="color:#f8fafc;">${verb_forms[f.key]}</span>
            <button data-speak="${escAttr(verb_forms[f.key])}" style="background:none;border:none;color:#3b82f6;font-size:.75rem;cursor:pointer;padding:.2rem .3rem;min-height:44px;min-width:44px;">🔊</button>
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function renderHome() {
  const count = allCards.length;
  const dueCount = allCards.filter(c => {
    if (!c.next_due) return true;
    if (c.repetition === 0) return true;
    return c.next_due <= new Date().toISOString();
  }).length;
  if (count === 0) {
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">📚</div>
        <h2 style="margin-bottom:.5rem;color:#f8fafc;">No words yet</h2>
        <p style="color:#94a3b8;margin-bottom:1.5rem;">Add your first vocabulary word to get started.</p>
        <button onclick="window._nav('add')" style="background:#3b82f6;color:#fff;border:none;padding:.8rem 2rem;border-radius:.5rem;font-size:1rem;cursor:pointer;">Add Word</button>
      </div>
    `;
  }
  return `
    <div style="flex:1;padding:1rem;">
      <h2 style="margin-bottom:.5rem;">Vocabulary (${count} words)</h2>
      <p style="color:#94a3b8;margin-bottom:1rem;">${dueCount} due for review</p>
      <div id="word-list">
        ${allCards.map(c => {
          const m = getActiveMeaning(c);
          return `
          <div data-card-id="${c.id}" style="background:#1e293b;padding:1rem;border-radius:.5rem;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
            <div>
              <strong style="color:#f8fafc;">${c.word}</strong>
              <span style="color:#94a3b8;margin-left:.5rem;font-size:.85rem;">${c.phonetic}</span>
              ${m.translation ? `<span style="color:#3b82f6;margin-left:.5rem;font-size:.85rem;">${m.translation}</span>` : ''}
            </div>
            <div style="display:flex;gap:.5rem;">
              <button data-speak="${c.word}" style="background:none;border:none;color:#3b82f6;font-size:1.2rem;cursor:pointer;padding:.3rem;min-height:44px;min-width:44px;">🔊</button>
              <button data-del="${c.id}" style="background:none;border:none;color:#ef4444;font-size:1.2rem;cursor:pointer;padding:.3rem;min-height:44px;min-width:44px;">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDetail() {
  if (!detailCard) return renderHome();
  const c = detailCard;
  const rawMeanings = c.meanings && c.meanings.length > 0 ? c.meanings : [{ partOfSpeech: '', definition_en: c.definition_en || '', translation_zh: c.translation_zh || '', example_en: c.example_en || '', example_zh: '' }];
  const meanings = rawMeanings.map(normalizeMeaning);
  const selIdx = Math.min(c.selected_meaning_index || 0, meanings.length - 1);
  const m = meanings[selIdx];

  const dropdownOpts = meanings.map((mi, i) => {
    const sel = i === selIdx ? ' selected' : '';
    return `<option value="${i}"${sel}>${mi.label || `[${mi.pos}] ${mi.translation}`}</option>`;
  }).join('');

  const isVerb = m.pos && (m.pos.includes('動') || m.pos.toLowerCase().includes('verb'));

  return `
    <div style="flex:1;padding:1rem;">
      <button id="btn-back" style="background:none;border:none;color:#3b82f6;font-size:1rem;cursor:pointer;margin-bottom:1rem;display:flex;align-items:center;gap:.3rem;">← Back</button>
      <div style="background:#1e293b;border-radius:1rem;padding:2rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
          <div>
            <div style="font-size:2rem;color:#f8fafc;">${c.word}</div>
            <div style="color:#94a3b8;font-size:1.1rem;margin-top:.25rem;">${c.phonetic}</div>
          </div>
          <button data-speak="${c.word}" style="background:none;border:none;color:#3b82f6;font-size:2rem;cursor:pointer;padding:.3rem;min-height:44px;min-width:44px;">🔊</button>
        </div>

        ${isVerb ? renderVerbFormsChips(c.verb_forms) : ''}

        ${meanings.length > 1 ? `
          <div style="margin-bottom:1rem;">
            <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.25rem;">釋義切換</div>
            <select id="detail-meaning-select" style="width:100%;padding:.6rem;border:1px solid #334155;border-radius:.5rem;background:#0f172a;color:#f8fafc;font-size:.95rem;">
              ${dropdownOpts}
            </select>
          </div>
        ` : ''}

        <div style="margin-bottom:1rem;">
          <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.25rem;">繁體中文釋義</div>
          ${m.translation
            ? `<div style="color:#3b82f6;font-size:1.3rem;">${m.translation}</div>`
            : `<div style="color:#64748b;font-size:1rem;font-style:italic;">（正在取得翻譯...）</div>`
          }
        </div>

        <div style="margin-bottom:1rem;">
          <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.25rem;">English Definition</div>
          <div style="color:#cbd5e1;font-size:1rem;line-height:1.5;">${m.definition}</div>
        </div>

        <div style="margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <div style="color:#94a3b8;font-size:.8rem;">English Example</div>
            <div style="display:flex;gap:.5rem;">
              ${m.exampleEn ? `<button data-speak-ex="${escAttr(m.exampleEn)}" style="background:none;border:none;color:#3b82f6;font-size:1rem;cursor:pointer;padding:.3rem;min-height:44px;min-width:44px;">🔊</button>` : ''}
              <button data-refresh-ex="${escAttr(c.word)}" style="background:none;border:none;color:#f59e0b;font-size:1rem;cursor:pointer;padding:.3rem;min-height:44px;min-width:44px;" title="${m.exampleEn ? '換一句例句' : '嘗試取得例句'}">🔄</button>
            </div>
          </div>
          <div id="display-example-en" style="color:${m.exampleEn ? '#e2e8f0' : '#64748b'};font-style:${m.exampleEn ? 'italic' : 'normal'};font-size:${m.exampleEn ? '1rem' : '.85rem'};line-height:1.5;">${m.exampleEn || '此釋義暫無專屬例句'}</div>
        </div>

        <div style="margin-bottom:1rem;">
          <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.25rem;">中文例句翻譯</div>
          <div id="display-example-zh" style="color:${m.exampleZh ? '#cbd5e1' : '#64748b'};font-size:${m.exampleZh ? '.95rem' : '.85rem'};font-style:italic;line-height:1.5;">${m.exampleZh || '（正在取得例句翻譯...）'}</div>
        </div>

        <div style="border-top:1px solid #334155;padding-top:1rem;margin-top:.5rem;">
          <button id="btn-set-default-meaning" style="width:100%;background:#f59e0b;color:#fff;border:none;padding:.7rem;border-radius:.5rem;cursor:pointer;margin-bottom:.5rem;">📌 設為預設複習釋義</button>
        </div>

        <div style="display:flex;gap:.5rem;border-top:1px solid #334155;padding-top:1rem;margin-top:.5rem;">
          <button data-speak="${c.word}" style="flex:1;background:#3b82f6;color:#fff;border:none;padding:.8rem;border-radius:.5rem;cursor:pointer;">🔊 Pronounce</button>
          <button id="btn-delete-detail" data-del="${c.id}" style="background:#ef4444;color:#fff;border:none;padding:.8rem 1.2rem;border-radius:.5rem;cursor:pointer;">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function renderAdd() {
  return `
    <div style="flex:1;padding:1rem;">
      <h2 style="margin-bottom:1rem;">Add Word</h2>
      <div style="display:flex;gap:.5rem;margin-bottom:.5rem;">
        <input id="inp-word" placeholder="e.g. ephemeral" style="flex:1;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:1rem;" />
        <button id="btn-lookup" style="background:#3b82f6;color:#fff;border:none;padding:.8rem 1.2rem;border-radius:.5rem;cursor:pointer;">Lookup</button>
      </div>
      <div id="dup-warning" style="display:none;background:#854d0e;color:#fef08a;padding:.8rem 1rem;border-radius:.5rem;margin-bottom:1rem;font-size:.9rem;">
        <div style="margin-bottom:.5rem;">⚠️ 此單字已在單字庫中！</div>
        <button id="btn-goto-dup" style="background:#f59e0b;color:#000;border:none;padding:.4rem .8rem;border-radius:.3rem;cursor:pointer;font-size:.85rem;">前往查看</button>
      </div>
      <div id="add-status" style="color:#94a3b8;font-size:.85rem;margin-bottom:.5rem;"></div>
      <div id="add-fields" style="display:none;">
        <div id="add-verb-forms"></div>
        <div id="meaning-selector-wrap" style="display:none;margin-bottom:.8rem;">
          <label style="color:#94a3b8;font-size:.8rem;display:block;margin-bottom:.3rem;">釋義切換</label>
          <select id="meaning-select" style="width:100%;padding:.7rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:.95rem;"></select>
        </div>
        <input id="inp-phonetic" placeholder="Phonetic (auto-filled)" style="width:100%;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:1rem;margin-bottom:.5rem;" />
        <input id="inp-zh" placeholder="繁體中文翻譯 (auto-filled)" style="width:100%;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:1rem;margin-bottom:.5rem;" />
        <textarea id="inp-def" placeholder="English Definition (auto-filled)" rows="2" style="width:100%;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:1rem;margin-bottom:.5rem;"></textarea>
        <div style="margin-bottom:.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;">
            <label style="color:#94a3b8;font-size:.8rem;">Example Sentence</label>
            <div style="display:flex;gap:.4rem;">
              <button id="btn-speak-ex-input" style="background:none;border:none;color:#3b82f6;font-size:.9rem;cursor:pointer;">🔊</button>
              <button id="btn-refresh-ex-input" style="background:none;border:none;color:#f59e0b;font-size:.9rem;cursor:pointer;" title="換一句例句">🔄</button>
            </div>
          </div>
          <textarea id="inp-ex" placeholder="Example Sentence (auto-filled)" rows="2" style="width:100%;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#1e293b;color:#f8fafc;font-size:1rem;margin-bottom:.3rem;"></textarea>
          <div id="inp-ex-zh" style="color:#94a3b8;font-size:.85rem;min-height:1.2em;"></div>
        </div>
        <button id="btn-speak-input" style="background:none;border:1px solid #334155;color:#3b82f6;padding:.5rem 1rem;border-radius:.5rem;cursor:pointer;margin-bottom:1rem;">🔊 Preview pronunciation</button>
        <button id="btn-add-single" style="width:100%;background:#22c55e;color:#fff;border:none;padding:1rem;border-radius:.5rem;font-size:1rem;cursor:pointer;">Add to Library</button>
      </div>
    </div>
  `;
}

function renderMeaningOptionLabel(m) {
  const nm = normalizeMeaning(m);
  if (nm.label) return nm.label;
  return `[${nm.pos || '—'}] ${nm.translation || '載入中…'}`;
}

function renderQuiz() {
  const due = allCards.filter(c => {
    if (!c.next_due) return true;
    if (c.repetition === 0) return true;
    return c.next_due <= new Date().toISOString();
  });
  if (due.length === 0 && allCards.length === 0) {
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
        <h2 style="margin-bottom:.5rem;color:#f8fafc;">All caught up!</h2>
        <p style="color:#94a3b8;">No cards due for review. Come back later.</p>
      </div>
    `;
  }
  if (due.length === 0) {
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
        <h2 style="margin-bottom:.5rem;color:#f8fafc;">All caught up!</h2>
        <p style="color:#94a3b8;margin-bottom:1.5rem;">No cards due for review right now.</p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;">
          <button data-quiz="flashcard-all" style="background:#3b82f6;color:#fff;border:none;padding:.8rem 1.5rem;border-radius:.5rem;cursor:pointer;">📚 強制練習所有單字</button>
        </div>
      </div>
    `;
  }
  return `
    <div style="flex:1;padding:1rem;">
      <h2 style="margin-bottom:1rem;">Review (${due.length} due)</h2>
      <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;">
        <button data-quiz="flashcard" style="flex:1;background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:.8rem;border-radius:.5rem;cursor:pointer;">🃏 Flashcard</button>
        <button data-quiz="fillblank" style="flex:1;background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:.8rem;border-radius:.5rem;cursor:pointer;">📝 Fill Blank</button>
        <button data-quiz="listening" style="flex:1;background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:.8rem;border-radius:.5rem;cursor:pointer;">🎧 Listening</button>
      </div>
      <div style="margin-bottom:1.5rem;">
        <button data-quiz="listening-comp" style="width:100%;background:linear-gradient(135deg,#1e3a5f,#0f172a);color:#93c5fd;border:1px solid #1e3a5f;padding:1rem;border-radius:.5rem;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:.5rem;">
          🎙️ 聽力理解測驗 (Listening Comprehension)
        </button>
      </div>
      <div id="quiz-area"></div>
    </div>
  `;
}

/* ─── Quiz Modes ─── */
let quizCards = [];
let quizIdx = 0;
let quizScore = { correct: 0, total: 0 };

/* ─── Listening Comprehension State ─── */
let listeningQuestions = [];
let listeningIdx = 0;
let listeningScore = { correct: 0, total: 0 };
let listeningSpeed = 1.0;

function startQuiz(mode) {
  if (mode === 'listening-comp') {
    listeningQuestions = generateListeningQuestions(allCards, Math.min(5, getListeningBankSize()));
    listeningIdx = 0;
    listeningScore = { correct: 0, total: 0 };
    listeningSpeed = 1.0;
    renderListeningComp();
    return;
  }
  const now = new Date().toISOString();
  if (mode.endsWith('-all')) {
    quizCards = [...allCards];
    mode = mode.replace('-all', '');
  } else {
    quizCards = allCards.filter(c => {
      if (!c.next_due) return true;
      if (c.repetition === 0) return true;
      return c.next_due <= now;
    });
  }
  quizIdx = 0;
  quizScore = { correct: 0, total: 0 };
  if (mode === 'flashcard') renderFlashcard();
  else if (mode === 'fillblank') renderFillBlank();
  else if (mode === 'listening') renderListening();
}

function renderFlashcard() {
  if (quizIdx >= quizCards.length) return showSummary();
  const c = quizCards[quizIdx];
  const m = getActiveMeaning(c);
  const area = $('#quiz-area');
  area.innerHTML = `
    <div id="flashcard" style="background:#1e293b;border-radius:1rem;padding:2rem;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform .3s;">
      <div style="font-size:2rem;color:#f8fafc;" id="fc-front">${c.word}</div>
      <div id="fc-back" style="display:none;text-align:center;margin-top:1rem;">
        ${m.translation ? `<div style="color:#3b82f6;font-size:1.2rem;margin-bottom:.5rem;">${m.translation}</div>` : ''}
        <div style="color:#cbd5e1;margin-bottom:.5rem;">${m.definition}</div>
        ${m.exampleEn ? `<div style="color:#94a3b8;font-style:italic;font-size:.9rem;">${m.exampleEn}</div>` : ''}
      </div>
    </div>
    <div id="fc-buttons" style="display:none;margin-top:1rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;">
      <button data-q="0" style="background:#ef4444;color:#fff;border:none;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;">Again</button>
      <button data-q="2" style="background:#f59e0b;color:#fff;border:none;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;">Hard</button>
      <button data-q="3" style="background:#22c55e;color:#fff;border:none;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;">Good</button>
      <button data-q="5" style="background:#3b82f6;color:#fff;border:none;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;">Easy</button>
    </div>
  `;
  $('#flashcard').onclick = () => {
    $('#fc-front').style.display = 'none';
    $('#fc-back').style.display = 'block';
    $('#fc-buttons').style.display = 'flex';
    speak(c.word);
  };
  area.querySelectorAll('[data-q]').forEach(btn => {
    btn.onclick = () => {
      const q = parseInt(btn.dataset.q);
      sm2(c, q);
      saveCard(c);
      allCards = allCards.map(x => x.id === c.id ? c : x);
      quizScore.total++;
      if (q >= 3) quizScore.correct++;
      quizIdx++;
      renderFlashcard();
    };
  });
}

function renderFillBlank() {
  if (quizIdx >= quizCards.length) return showSummary();
  const c = quizCards[quizIdx];
  const m = getActiveMeaning(c);
  const otherWords = allCards.filter(x => x.id !== c.id).map(x => x.word);
  while (otherWords.length < 3) otherWords.push('—');
  const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [...shuffled, c.word].sort(() => Math.random() - 0.5);
  const blanked = (m.exampleEn || '').replace(new RegExp(`\\b${c.word}\\b`, 'gi'), '______') || `The meaning of "______" is...`;
  const area = $('#quiz-area');
  area.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:1.5rem;margin-bottom:1rem;">
      <div style="color:#cbd5e1;font-size:1.1rem;line-height:1.6;">${blanked}</div>
    </div>
    <div id="fb-choices" style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
      ${options.map(o => `
        <button data-choice="${o}" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:.8rem;border-radius:.5rem;cursor:pointer;font-size:1rem;">${o}</button>
      `).join('')}
    </div>
    <div id="fb-result" style="margin-top:1rem;text-align:center;"></div>
  `;
  area.querySelectorAll('[data-choice]').forEach(btn => {
    btn.onclick = () => {
      const correct = btn.dataset.choice.toLowerCase() === c.word.toLowerCase();
      if (correct) {
        btn.style.background = '#22c55e';
        sm2(c, 4);
        quizScore.correct++;
      } else {
        btn.style.background = '#ef4444';
        sm2(c, 0);
        area.querySelectorAll('[data-choice]').forEach(b => {
          if (b.dataset.choice.toLowerCase() === c.word.toLowerCase()) b.style.background = '#22c55e';
        });
      }
      saveCard(c);
      allCards = allCards.map(x => x.id === c.id ? c : x);
      quizScore.total++;
      area.querySelectorAll('[data-choice]').forEach(b => b.disabled = true);
      setTimeout(() => { quizIdx++; renderFillBlank(); }, 1200);
    };
  });
}

function renderListening() {
  if (quizIdx >= quizCards.length) return showSummary();
  const c = quizCards[quizIdx];
  const area = $('#quiz-area');
  area.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:2rem;text-align:center;">
      <div style="font-size:3rem;margin-bottom:1rem;cursor:pointer;" id="listen-btn">🎧</div>
      <p style="color:#94a3b8;margin-bottom:1rem;">Tap to listen</p>
      <input id="listen-input" placeholder="Type the word you heard..." style="width:100%;padding:.8rem;border:1px solid #334155;border-radius:.5rem;background:#0f172a;color:#f8fafc;font-size:1rem;margin-bottom:1rem;" />
      <button id="listen-submit" style="width:100%;background:#3b82f6;color:#fff;border:none;padding:1rem;border-radius:.5rem;font-size:1rem;cursor:pointer;">Submit</button>
      <div id="listen-result" style="margin-top:1rem;text-align:center;"></div>
    </div>
  `;
  speak(c.word);
  $('#listen-btn').onclick = () => speak(c.word);
  $('#listen-submit').onclick = () => {
    const guess = $('#listen-input').value.trim().toLowerCase();
    const result = $('#listen-result');
    if (guess === c.word.toLowerCase()) {
      result.innerHTML = `<span style="color:#22c55e;font-size:1.2rem;">Correct!</span>`;
      sm2(c, 5);
      quizScore.correct++;
    } else {
      result.innerHTML = `<span style="color:#ef4444;font-size:1.2rem;">Answer: ${c.word}</span>`;
      sm2(c, 0);
    }
    saveCard(c);
    allCards = allCards.map(x => x.id === c.id ? c : x);
    quizScore.total++;
    $('#listen-submit').disabled = true;
    $('#listen-input').disabled = true;
    setTimeout(() => { quizIdx++; renderListening(); }, 1500);
  };
}

/* ─── Listening Comprehension Mode ─── */
function speakAtSpeed(text, rate) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate || listeningSpeed;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (_) {}
}

function renderListeningComp() {
  if (listeningIdx >= listeningQuestions.length) return showListeningSummary();
  const q = listeningQuestions[listeningIdx];
  const area = $('#quiz-area');
  area.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:1.5rem;margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <span style="color:#94a3b8;font-size:.85rem;">Listening Comprehension (${listeningIdx + 1}/${listeningQuestions.length})</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;margin-bottom:1.5rem;">
        <button id="lc-play" style="width:80px;height:80px;border-radius:50%;background:#3b82f6;color:#fff;border:none;font-size:2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(59,130,246,.4);">🔊</button>
        <div style="display:flex;align-items:center;gap:.8rem;width:100%;max-width:300px;">
          <span style="color:#94a3b8;font-size:.8rem;white-space:nowrap;">0.8x</span>
          <input id="lc-speed" type="range" min="0.8" max="1.2" step="0.2" value="${listeningSpeed}" style="flex:1;accent-color:#3b82f6;" />
          <span style="color:#94a3b8;font-size:.8rem;white-space:nowrap;">1.2x</span>
          <span id="lc-speed-label" style="color:#f8fafc;font-size:.85rem;min-width:2.5em;text-align:center;">${listeningSpeed}x</span>
        </div>
        <div style="display:flex;gap:.5rem;">
          <button id="lc-stop" style="background:#374151;color:#e2e8f0;border:none;padding:.4rem .8rem;border-radius:.5rem;cursor:pointer;font-size:.8rem;">⏹ 停止</button>
          <button id="lc-replay" style="background:#374151;color:#e2e8f0;border:none;padding:.4rem .8rem;border-radius:.5rem;cursor:pointer;font-size:.8rem;">🔁 重播</button>
        </div>
      </div>
      <div id="lc-question" style="margin-bottom:1.2rem;">
        <div style="color:#f8fafc;font-size:1.05rem;line-height:1.6;margin-bottom:1rem;">${q.question}</div>
        <div id="lc-options" style="display:flex;flex-direction:column;gap:.5rem;">
          ${q.options.map((opt, i) => `
            <button data-lc-opt="${i}" style="text-align:left;background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:.75rem 1rem;border-radius:.5rem;cursor:pointer;font-size:.95rem;transition:background .2s;">${String.fromCharCode(65 + i)}. ${opt}</button>
          `).join('')}
        </div>
      </div>
      <div id="lc-result" style="display:none;"></div>
    </div>
  `;
  $('#lc-play').onclick = () => speakAtSpeed(q.audioText, listeningSpeed);
  const speedSlider = $('#lc-speed');
  const speedLabel = $('#lc-speed-label');
  speedSlider.oninput = () => {
    listeningSpeed = parseFloat(speedSlider.value);
    speedLabel.textContent = listeningSpeed + 'x';
  };
  $('#lc-stop').onclick = () => speechSynthesis.cancel();
  $('#lc-replay').onclick = () => speakAtSpeed(q.audioText, listeningSpeed);
  const optionBtns = area.querySelectorAll('[data-lc-opt]');
  optionBtns.forEach(btn => {
    btn.onclick = () => {
      speechSynthesis.cancel();
      const chosen = parseInt(btn.dataset.lcOpt);
      const correct = chosen === q.correctAnswer;
      const resultEl = $('#lc-result');
      optionBtns.forEach(b => {
        b.disabled = true;
        b.style.cursor = 'default';
        const idx = parseInt(b.dataset.lcOpt);
        if (idx === q.correctAnswer) {
          b.style.background = '#22c55e';
          b.style.borderColor = '#22c55e';
          b.style.color = '#fff';
        } else if (idx === chosen && !correct) {
          b.style.background = '#ef4444';
          b.style.borderColor = '#ef4444';
          b.style.color = '#fff';
        } else {
          b.style.opacity = '0.5';
        }
      });
      if (correct) listeningScore.correct++;
      listeningScore.total++;
      let transcriptEn = q.audioText;
      for (const w of q.targetWords) {
        const re = new RegExp(`\\b(${w})\\b`, 'gi');
        transcriptEn = transcriptEn.replace(re, `<mark style="background:#f59e0b;color:#000;padding:0 .15rem;border-radius:.2rem;font-weight:600;">$1</mark>`);
      }
      resultEl.style.display = 'block';
      resultEl.innerHTML = `
        <div style="border-top:1px solid #334155;padding-top:1rem;margin-top:.5rem;">
          <div style="font-size:1.2rem;margin-bottom:.8rem;">
            ${correct
              ? '<span style="color:#22c55e;">✅ 正確！</span>'
              : `<span style="color:#ef4444;">❌ 錯誤 — 正確答案：${String.fromCharCode(65 + q.correctAnswer)}. ${q.options[q.correctAnswer]}</span>`
            }
          </div>
          <div style="margin-bottom:1rem;">
            <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.3rem;">英文逐字稿 (Transcript)</div>
            <div style="color:#e2e8f0;font-size:.95rem;line-height:1.7;font-style:italic;">${transcriptEn}</div>
          </div>
          <div style="margin-bottom:1rem;">
            <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.3rem;">繁體中文翻譯</div>
            <div style="color:#cbd5e1;font-size:.9rem;line-height:1.6;">${q.transcriptZh}</div>
          </div>
          <div style="margin-bottom:1rem;">
            <div style="color:#94a3b8;font-size:.8rem;margin-bottom:.3rem;">目標單字</div>
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
              ${q.targetWords.map(w => `
                <span style="background:#1e3a5f;color:#93c5fd;padding:.3rem .6rem;border-radius:.3rem;font-size:.85rem;">
                  <strong>${w}</strong>
                </span>
              `).join('')}
            </div>
          </div>
          <button id="lc-next" style="width:100%;background:#3b82f6;color:#fff;border:none;padding:.8rem;border-radius:.5rem;cursor:pointer;font-size:1rem;">
            ${listeningIdx < listeningQuestions.length - 1 ? '下一題 (Next Question)' : '查看成績 (View Results)'}
          </button>
        </div>
      `;
      $('#lc-next').onclick = () => { listeningIdx++; renderListeningComp(); };
    };
  });
}

function showListeningSummary() {
  const area = $('#quiz-area');
  const pct = listeningScore.total > 0 ? Math.round((listeningScore.correct / listeningScore.total) * 100) : 0;
  area.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:2rem;text-align:center;">
      <div style="font-size:3rem;margin-bottom:1rem;">${pct >= 80 ? '🎉' : pct >= 50 ? '👏' : '📖'}</div>
      <h3 style="color:#f8fafc;margin-bottom:.5rem;">Listening Comprehension Complete</h3>
      <p style="color:#cbd5e1;font-size:1.3rem;margin-bottom:.3rem;">${listeningScore.correct} / ${listeningScore.total} correct</p>
      <p style="color:#94a3b8;margin-bottom:1rem;">Accuracy: ${pct}%</p>
      <button onclick="window._nav('quiz')" style="margin-top:.5rem;background:#3b82f6;color:#fff;border:none;padding:.8rem 2rem;border-radius:.5rem;cursor:pointer;">Back to Quiz</button>
    </div>
  `;
}

function showSummary() {
  const area = $('#quiz-area');
  const earliest = allCards.length > 0 ? allCards.reduce((m, c) => c.next_due < m ? c.next_due : m, allCards[0].next_due) : '';
  area.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:2rem;text-align:center;">
      <div style="font-size:3rem;margin-bottom:1rem;">🎉</div>
      <h3 style="color:#f8fafc;margin-bottom:.5rem;">Quiz Complete</h3>
      <p style="color:#cbd5e1;font-size:1.1rem;">${quizScore.correct} / ${quizScore.total} correct</p>
      <p style="color:#94a3b8;margin-top:.5rem;">Next review: ${earliest ? new Date(earliest).toLocaleDateString() : '—'}</p>
      <button onclick="window._nav('home')" style="margin-top:1rem;background:#3b82f6;color:#fff;border:none;padding:.8rem 2rem;border-radius:.5rem;cursor:pointer;">Back to Home</button>
    </div>
  `;
}

/* ─── Render & Navigation ─── */
function render() {
  const views = { home: renderHome, add: renderAdd, quiz: renderQuiz, detail: renderDetail };
  const showNav = currentView !== 'detail';
  app().innerHTML = `
    <div style="flex:1;padding-bottom:${showNav ? '4rem' : '0'};">
      ${views[currentView]()}
    </div>
    ${showNav ? nav() : ''}
  `;
  bindEvents();
}

let dupWarningCardId = null;

function showDupWarning(cardId) {
  dupWarningCardId = cardId;
  const el = $('#dup-warning');
  if (el) el.style.display = 'block';
}

function hideDupWarning() {
  dupWarningCardId = null;
  const el = $('#dup-warning');
  if (el) el.style.display = 'none';
}

async function checkDuplicate(word) {
  const w = (word || '').trim();
  if (!w) { hideDupWarning(); return; }
  const existing = await findCardByWord(w);
  if (existing) showDupWarning(existing.id);
  else hideDupWarning();
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { currentView = btn.dataset.nav; render(); };
  });

  if (currentView === 'home') {
    document.querySelectorAll('[data-card-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-speak]') || e.target.closest('[data-del]')) return;
        const card = allCards.find(c => c.id === el.dataset.cardId);
        if (card) { detailCard = card; currentView = 'detail'; render(); }
      });
    });
    document.querySelectorAll('[data-speak]').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); speak(btn.dataset.speak); };
    });
    document.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await deleteCard(btn.dataset.del);
        allCards = allCards.filter(c => c.id !== btn.dataset.del);
        render();
        toast('Card deleted');
      };
    });
  }

  if (currentView === 'detail') {
    const btnBack = $('#btn-back');
    if (btnBack) btnBack.onclick = () => { currentView = 'home'; detailCard = null; render(); };
    document.querySelectorAll('[data-speak]').forEach(btn => {
      btn.onclick = () => speak(btn.dataset.speak);
    });
    document.querySelectorAll('[data-speak-ex]').forEach(el => {
      el.onclick = () => speak(el.dataset.speakEx);
    });
    document.querySelectorAll('[data-refresh-ex]').forEach(btn => {
      btn.onclick = async () => {
        const word = btn.dataset.refreshEx;
        if (!detailCard) return;
        const mIdx = detailCard.selected_meaning_index || 0;
        const cache = getTatoebaCache(word, mIdx);
        if (cache.examples.length === 0) {
          let results = [];
          /* Try local first */
          const local = getLocalExample(word);
          if (local) results.push({ example_en: local.en, example_zh: local.zh });
          /* Then Tatoeba */
          try {
            const tResults = await fetchTatoebaExamples(word);
            results = results.concat(tResults);
          } catch (_) {}
          /* Then auto-gen */
          if (results.length === 0) {
            const nm = normalizeMeaning(detailCard.meanings?.[mIdx]);
            const auto = generateAutoExample(word, nm.pos || '');
            results.push({ example_en: auto.en, example_zh: auto.zh });
          }
          cache.examples = results;
          cache.currentIdx = -1;
        }
        cache.currentIdx = (cache.currentIdx + 1) % cache.examples.length;
        const ex = cache.examples[cache.currentIdx];
        if (detailCard.meanings && detailCard.meanings[mIdx]) {
          detailCard.meanings[mIdx].exampleEn = ex.example_en;
          detailCard.meanings[mIdx].exampleZh = ex.example_zh;
          await saveCard(detailCard);
          allCards = allCards.map(x => x.id === detailCard.id ? detailCard : x);
          detailCard = allCards.find(x => x.id === detailCard.id) || detailCard;
          render();
        }
      };
    });
    const btnDel = $('#btn-delete-detail');
    if (btnDel) {
      btnDel.onclick = async () => {
        await deleteCard(btnDel.dataset.del);
        allCards = allCards.filter(c => c.id !== btnDel.dataset.del);
        currentView = 'home'; detailCard = null; render();
        toast('Card deleted');
      };
    }
    const meaningSelect = $('#detail-meaning-select');
    if (meaningSelect) {
      meaningSelect.onchange = async () => {
        const idx = parseInt(meaningSelect.value);
        if (detailCard && !isNaN(idx)) {
          detailCard.selected_meaning_index = idx;
          const m = normalizeMeaning(detailCard.meanings?.[idx]);
          if (m && (!m.translation || !m.exampleZh)) {
            await translateMeaningOnDemand(m, detailCard.word);
          }
          await saveCard(detailCard);
          allCards = allCards.map(x => x.id === detailCard.id ? detailCard : x);

          /* Directly update DOM for example section */
          const exampleEnEl = document.getElementById('display-example-en');
          const exampleZhEl = document.getElementById('display-example-zh');
          if (exampleEnEl && exampleZhEl) {
            if (m && m.exampleEn) {
              exampleEnEl.textContent = m.exampleEn;
              exampleEnEl.style.fontStyle = 'italic';
              exampleEnEl.style.color = '#e2e8f0';
              exampleZhEl.textContent = m.exampleZh || '';
              exampleZhEl.style.color = '#cbd5e1';
            } else {
              exampleEnEl.textContent = '此釋義暫無專屬例句';
              exampleEnEl.style.fontStyle = 'normal';
              exampleEnEl.style.color = '#64748b';
              exampleZhEl.textContent = '';
            }
          }

          render();
        }
      };
    }
    const btnSetDefault = $('#btn-set-default-meaning');
    if (btnSetDefault) {
      btnSetDefault.onclick = async () => {
        if (detailCard) {
          const selEl = $('#detail-meaning-select');
          detailCard.selected_meaning_index = selEl ? parseInt(selEl.value) : (detailCard.selected_meaning_index || 0);
          await saveCard(detailCard);
          allCards = allCards.map(x => x.id === detailCard.id ? detailCard : x);
          detailCard = allCards.find(x => x.id === detailCard.id) || detailCard;
          toast('已設為預設複習釋義');
        }
      };
    }
  }

  if (currentView === 'add') {
    const inpWord = $('#inp-word');
    const btnLookup = $('#btn-lookup');
    const btnSpeakInput = $('#btn-speak-input');
    const btnGotoDup = $('#btn-goto-dup');
    const btnAddSingle = $('#btn-add-single');

    if (inpWord) {
      inpWord.addEventListener('input', () => {
        const w = inpWord.value.trim();
        if (w.length >= 2) checkDuplicate(w);
        else hideDupWarning();
      });
    }

    if (btnGotoDup) {
      btnGotoDup.onclick = () => {
        const card = allCards.find(c => c.id === dupWarningCardId);
        if (card) { detailCard = card; currentView = 'detail'; render(); }
      };
    }

    document.querySelectorAll('[data-speak-ex]').forEach(el => {
      el.onclick = () => speak(el.dataset.speakEx);
    });

    if (btnLookup) {
      btnLookup.onclick = async () => {
        const word = inpWord ? inpWord.value.trim() : '';
        if (!word) return;
        const w = word.toLowerCase();
        console.log(`[AddWord Debug] 使用者點擊 Lookup，查詢: "${w}"`);
        const existing = await findCardByWord(w);
        if (existing) {
          showDupWarning(existing.id);
          toast('此單字已存在，請勿重複新增');
          return;
        }
        const status = $('#add-status');
        status.textContent = 'Looking up...';
        btnLookup.disabled = true;
        hideDupWarning();

        try {
          console.log(`[AddWord Debug] 呼叫 lookupWord("${w}")...`);
          const data = await lookupWord(w);
          console.log(`[AddWord Debug] lookupWord 回傳:`, data);

          if (!data || !data.meanings || data.meanings.length === 0) {
            console.warn(`[AddWord Debug] 查詢結果無 meanings，顯示手動填寫模式`);
            toast('無法自動取得釋義，請手動填寫');
            $('#add-fields').style.display = 'block';
            $('#meaning-selector-wrap').style.display = 'none';
            pendingLookups = [];
            status.textContent = '';
            btnLookup.disabled = false;
            return;
          }

          const cardMeanings = data.meanings.map(m => normalizeMeaning(m));
          console.log(`[AddWord Debug] 轉換後 cardMeanings:`, cardMeanings);

          pendingLookups = [{
            word: w,
            phonetic: data.phonetic,
            meanings: cardMeanings,
            verb_forms: data.verb_forms || null,
            selected_meaning_index: 0,
          }];
          console.log(`[AddWord Debug] pendingLookups 已設定:`, pendingLookups[0]);

          const first = cardMeanings[0];
          console.log(`[AddWord Debug] 第一筆釋義 (first):`, first);
          $('#add-fields').style.display = 'block';

          // 渲染動詞變化（僅當選中動詞詞性時顯示）
          const verbFormsEl = document.getElementById('add-verb-forms');
          if (verbFormsEl) {
            const isFirstVerb = first.pos &&
              (first.pos.includes('動') || first.pos.toLowerCase().includes('verb'));
            if (data.verb_forms && isFirstVerb) {
              verbFormsEl.innerHTML = renderVerbFormsChips(data.verb_forms);
              verbFormsEl.querySelectorAll('[data-speak]').forEach(btn => {
                btn.onclick = () => speak(btn.dataset.speak);
              });
              verbFormsEl.style.display = '';
            } else {
              verbFormsEl.innerHTML = '';
              verbFormsEl.style.display = 'none';
            }
          }

          requestAnimationFrame(() => {
            const phonInp = document.getElementById('inp-phonetic');
            const zhInp = document.getElementById('inp-zh');
            const defInp = document.getElementById('inp-def');
            const exInp = document.getElementById('inp-ex');
            const exZhEl = document.getElementById('inp-ex-zh');
            if (phonInp) phonInp.value = data.phonetic || '';
            if (zhInp) zhInp.value = first.translation || '';
            if (defInp) defInp.value = first.definition || '';
            if (exInp) exInp.value = first.exampleEn || '';
            if (exZhEl) exZhEl.textContent = '';
            console.log(`[AddWord Debug] 欄位回填完成:`, {
              phonetic: data.phonetic,
              translation: first.translation,
              definition: first.definition,
              exampleEn: first.exampleEn,
            });
          });

          const selWrap = document.getElementById('meaning-selector-wrap');
          const sel = document.getElementById('meaning-select');
          if (selWrap && sel) {
            if (cardMeanings.length >= 1) {
              selWrap.style.display = 'block';
              sel.innerHTML = cardMeanings.map((m, i) => {
                return `<option value="${i}">${renderMeaningOptionLabel(m)}</option>`;
              }).join('');
              sel.value = '0';
              console.log(`[AddWord Debug] 釋義下拉選單已建立，共 ${cardMeanings.length} 項`);
            } else {
              selWrap.style.display = 'none';
              sel.innerHTML = '';
              console.log(`[AddWord Debug] 無釋義資料，隱藏下拉選單`);
            }
          }

          status.textContent = '';
          btnLookup.disabled = false;

          console.log(`[AddWord Debug] 開始背景翻譯 (${cardMeanings.length} 筆 meanings)...`);
          translateMeaningsInBackground(cardMeanings, w);
        } catch (err) {
          console.error(`[AddWord Debug] lookupWord 例外錯誤:`, err);
          toast('無法自動取得釋義，請手動填寫');
          $('#add-fields').style.display = 'block';
          $('#meaning-selector-wrap').style.display = 'none';
          pendingLookups = [];
          status.textContent = '';
          btnLookup.disabled = false;
        }
      };
    }

    if (btnSpeakInput) {
      btnSpeakInput.onclick = () => {
        const w = inpWord ? inpWord.value.trim() : '';
        if (w) speak(w);
      };
    }

    const btnSpeakExInput = $('#btn-speak-ex-input');
    if (btnSpeakExInput) {
      btnSpeakExInput.onclick = () => {
        const ex = $('#inp-ex') ? $('#inp-ex').value.trim() : '';
        if (ex) speak(ex);
      };
    }

    const btnRefreshExInput = $('#btn-refresh-ex-input');
    if (btnRefreshExInput) {
      btnRefreshExInput.onclick = async () => {
        const word = inpWord ? inpWord.value.trim() : '';
        if (!word) { toast('請先輸入單字'); return; }
        const lookup = pendingLookups[0];
        const selIdx = lookup?.selected_meaning_index || 0;
        const nm = normalizeMeaning(lookup?.meanings?.[selIdx]);
        const pos = nm.pos || '';
        const enSentence = getSmartSentence(word, pos, lookup?.verb_forms || null);
        const zhSentence = await translateSentence(enSentence);
        const exInp = document.getElementById('inp-ex');
        const zhEl = document.getElementById('inp-ex-zh');
        if (exInp) exInp.value = enSentence;
        if (zhEl) zhEl.textContent = zhSentence || '';
        if (lookup?.meanings?.[selIdx]) {
          lookup.meanings[selIdx].exampleEn = enSentence;
          lookup.meanings[selIdx].exampleZh = zhSentence;
        }
      };
    }

    // ─── 釋義切換下拉選單 ───
    const meaningSelect = document.getElementById('meaning-select');
    if (meaningSelect) {
      meaningSelect.addEventListener('change', async () => {
        const lookup = pendingLookups[0];
        if (!lookup) return;
        const idx = parseInt(meaningSelect.value);
        if (isNaN(idx) || !lookup.meanings[idx]) return;
        console.log(`[AddWord Debug] 釋義切換: index=${idx}`);
        lookup.selected_meaning_index = idx;
        const m = normalizeMeaning(lookup.meanings[idx]);

        // 補翻譯
        if (!m.translation) {
          await translateMeaningOnDemand(m, lookup.word);
        }

        // 重新生成對應詞性的語境例句
        const enSentence = getSmartSentence(lookup.word, m.pos, lookup.verb_forms);
        m.exampleEn = enSentence;
        m.exampleZh = await translateSentence(enSentence);
        // 回寫到原始物件
        lookup.meanings[idx].exampleEn = m.exampleEn;
        lookup.meanings[idx].exampleZh = m.exampleZh;

        const phonInp = document.getElementById('inp-phonetic');
        const zhInp = document.getElementById('inp-zh');
        const defInp = document.getElementById('inp-def');
        const exInp = document.getElementById('inp-ex');
        const exZhEl = document.getElementById('inp-ex-zh');
        if (phonInp) phonInp.value = lookup.phonetic || '';
        if (zhInp) zhInp.value = m.translation || '';
        if (defInp) defInp.value = m.definition || '';
        if (exInp) exInp.value = m.exampleEn || '';
        if (exZhEl) exZhEl.textContent = m.exampleZh || '';

        // 動詞變化區塊：僅當選中動詞時顯示
        const verbFormsEl = document.getElementById('add-verb-forms');
        if (verbFormsEl) {
          const isVerb = m.pos &&
            (m.pos.includes('動') || m.pos.toLowerCase().includes('verb'));
          if (lookup.verb_forms && isVerb) {
            verbFormsEl.innerHTML = renderVerbFormsChips(lookup.verb_forms);
            verbFormsEl.querySelectorAll('[data-speak]').forEach(btn => {
              btn.onclick = () => speak(btn.dataset.speak);
            });
            verbFormsEl.style.display = '';
          } else {
            verbFormsEl.innerHTML = '';
            verbFormsEl.style.display = 'none';
          }
        }

        console.log(`[AddWord Debug] 切換後欄位回填:`, {
          pos: m.pos,
          translation: m.translation,
          definition: m.definition,
          exampleEn: m.exampleEn,
          exampleZh: m.exampleZh,
        });
      });
    }

    if (btnAddSingle) {
      btnAddSingle.onclick = async () => {
        const w = (inpWord ? inpWord.value.trim() : '').toLowerCase();
        if (!w) { toast('Word is required'); return; }
        const dup = await findCardByWord(w);
        if (dup) {
          showDupWarning(dup.id);
          toast('此單字已存在，請勿重複新增');
          return;
        }

        // 若有 lookup 資料，使用完整的 meanings 陣列
        const lookup = pendingLookups[0];
        let meanings, phonetic, selectedIdx;
        if (lookup && lookup.meanings && lookup.meanings.length > 0) {
          // 以表單欄位覆蓋當前選中的那一筆（允許使用者微調）
          const selIdx = lookup.selected_meaning_index || 0;
          const updatedMeanings = lookup.meanings.map((m, i) => {
            const nm = normalizeMeaning(m);
            if (i === selIdx) {
              return {
                pos: nm.pos,
                label: nm.label,
                translation: (document.getElementById('inp-zh')?.value || '').trim() || nm.translation,
                definition: (document.getElementById('inp-def')?.value || '').trim() || nm.definition,
                exampleEn: (document.getElementById('inp-ex')?.value || '').trim() || nm.exampleEn,
                exampleZh: (document.getElementById('inp-ex-zh')?.textContent || '').trim() || nm.exampleZh,
              };
            }
            return nm;
          });
          meanings = updatedMeanings;
          phonetic = (document.getElementById('inp-phonetic')?.value || '').trim() || lookup.phonetic;
          selectedIdx = selIdx;
        } else {
          // 無 lookup 資料（手動輸入模式）
          const phoneticVal = (document.getElementById('inp-phonetic')?.value || '').trim();
          const translation_zh = (document.getElementById('inp-zh')?.value || '').trim();
          const definition_en = (document.getElementById('inp-def')?.value || '').trim();
          const example_en = (document.getElementById('inp-ex')?.value || '').trim();
          const example_zh = (document.getElementById('inp-ex-zh')?.textContent || '').trim();
          if (!w || !definition_en) { toast('Word and definition are required'); return; }
          meanings = [{ pos: '', label: '', translation: translation_zh, definition: definition_en, exampleEn: example_en, exampleZh: example_zh }];
          phonetic = phoneticVal;
          selectedIdx = 0;
        }

        const now = new Date();
        const card = {
          id: uuid(),
          word: w,
          phonetic,
          meanings,
          verb_forms: lookup?.verb_forms || null,
          selected_meaning_index: selectedIdx,
          repetition: 0,
          interval: 0,
          ease_factor: 2.5,
          next_due: now.toISOString(),
        };
        await saveCard(card);
        allCards.push(card);
        currentView = 'home';
        render();
        toast(`"${w}" added!`);
      };
    }
  }

  if (currentView === 'quiz') {
    document.querySelectorAll('[data-quiz]').forEach(btn => {
      btn.onclick = () => startQuiz(btn.dataset.quiz);
    });
  }
}

/* ─── Init ─── */
let speechWarmed = false;
function warmSpeechChannel() {
  if (speechWarmed) return;
  speechWarmed = true;
  try {
    speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch (_) {}
  document.removeEventListener('click', warmSpeechChannel);
}

async function init() {
  document.addEventListener('click', warmSpeechChannel, { once: false });
  allCards = await getAllCards();
  render();
}

window._nav = (view) => { currentView = view; render(); };

init();
