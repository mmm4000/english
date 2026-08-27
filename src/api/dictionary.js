export async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) throw new Error('請輸入單字');

  let phonetic = '';
  let definition = '';
  let example = '';
  let translation = '';
  let partOfSpeech = '';

  // 1. 查詢 Free Dictionary API (英文定義、音標、例句)
  try {
    const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (dictRes.ok) {
      const data = await dictRes.json();
      const firstEntry = data[0];
      phonetic = firstEntry?.phonetic || firstEntry?.phonetics?.find(p => p.text)?.text || '';

      const firstMeaning = firstEntry?.meanings?.[0];
      if (firstMeaning) {
        partOfSpeech = firstMeaning.partOfSpeech || '';
        const defObj = firstMeaning.definitions?.[0];
        definition = defObj?.definition || '';
        example = defObj?.example || '';
      }
    }
  } catch (err) {
    console.warn('Dictionary API 請求失敗:', err);
  }

  // 2. 查詢 Google Translate GTX (繁體中文翻譯)
  try {
    const transRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&q=${encodeURIComponent(word)}`);
    if (transRes.ok) {
      const transData = await transRes.json();
      // 提取核心中文直譯
      if (transData?.[0]?.[0]?.[0]) {
        translation = transData[0][0][0];
      }
      // 若有詳細辭典釋義則抓取更完整的詞性翻譯
      if (transData?.[1]?.[0]?.[1]) {
        const dictTerms = transData[1][0][1];
        if (Array.isArray(dictTerms) && dictTerms.length > 0) {
          translation = dictTerms.slice(0, 3).join('、');
        }
      }
    }
  } catch (err) {
    console.warn('Google Translate 請求失敗:', err);
  }

  // 若兩者皆無才提供保底（但不要填入 Meaning of "..."）
  return {
    word,
    phonetic,
    translation: translation || '（請自行輸入中文翻譯）',
    definition: definition || 'No English definition found.',
    example: example || `This is an example sentence for "${word}".`,
    partOfSpeech
  };
}
