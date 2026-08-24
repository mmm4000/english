const LISTENING_BANK = [
  /* ─── 日常生活 ─── */
  {
    id: 'listen_1',
    audioText: 'Yesterday, Sarah decided to book a flight to London for a business conference. Although the schedule was tight, she managed to run to the train station just in time to catch the express train.',
    question: 'Why did Sarah run to the train station?',
    options: [
      'To meet her friend for lunch',
      'To catch the express train in time',
      'To buy tickets for a concert',
      'To avoid the heavy rain',
    ],
    correctAnswer: 1,
    transcriptZh: '昨天，莎拉決定預訂前往倫敦的商務會議機票。儘管行程緊湊，她還是及時跑到火車站趕上了特快列車。',
    targetWords: ['book', 'run'],
    theme: 'daily',
  },
  {
    id: 'listen_2',
    audioText: 'Tom likes to read books before bed. Last night, he read a fascinating novel about a scientist who discovered a new planet. The story was so exciting that he forgot to set his alarm clock.',
    question: 'What did Tom forget to do after reading?',
    options: [
      'Brush his teeth',
      'Set his alarm clock',
      'Turn off the light',
      'Close the window',
    ],
    correctAnswer: 1,
    transcriptZh: '湯姆喜歡睡前看書。昨晚，他讀了一本關於一位科學家發現新星球的精彩小說。故事太令人興奮了，他忘了設定鬧鐘。',
    targetWords: ['read', 'book'],
    theme: 'daily',
  },
  {
    id: 'listen_3',
    audioText: 'The weather forecast predicted heavy rain this weekend. Maria decided to cancel her outdoor picnic and instead invited her friends over for a movie night. They ordered pizza and watched a comedy together.',
    question: 'Why did Maria cancel the picnic?',
    options: [
      'She was feeling sick',
      'The weather forecast predicted heavy rain',
      'Her friends could not come',
      'She had to work overtime',
    ],
    correctAnswer: 1,
    transcriptZh: '氣象預報預測本週末會有大雨。瑪麗亞決定取消戶外野餐，改邀朋友來家裡看電影之夜。他們點了披薩，一起看了一部喜劇。',
    targetWords: ['cancel', 'predict'],
    theme: 'daily',
  },
  {
    id: 'listen_4',
    audioText: 'At the supermarket, David could not find his favorite cereal. He asked a staff member for help, and she led him to the correct aisle. He also picked up some fresh vegetables and a bottle of olive oil for dinner.',
    question: 'What was David looking for at the supermarket?',
    options: [
      'Fresh vegetables',
      'A bottle of olive oil',
      'His favorite cereal',
      'A new cookbook',
    ],
    correctAnswer: 2,
    transcriptZh: '在超市裡，大衛找不到他最喜歡的麥片。他請一位工作人員幫忙，她帶他到正確的貨架。他也拿了一些新鮮蔬菜和一瓶橄欖油做晚餐。',
    targetWords: ['find', 'pick'],
    theme: 'daily',
  },
  {
    id: 'listen_5',
    audioText: 'Lisa has been practicing the piano every day for the past three months. Her teacher said she made great progress and recommended her for the school talent show. Lisa is both nervous and excited about performing in front of her classmates.',
    question: 'What did Lisa\'s teacher recommend her for?',
    options: [
      'A music competition',
      'The school talent show',
      'A piano lesson abroad',
      'Joining a band',
    ],
    correctAnswer: 1,
    transcriptZh: '麗莎過去三個月每天都在練習鋼琴。她的老師說她進步很大，推薦她參加學校才藝表演。麗莎對在同學面前表演既緊張又興奮。',
    targetWords: ['practice', 'recommend'],
    theme: 'daily',
  },
  /* ─── 職場 ─── */
  {
    id: 'listen_6',
    audioText: 'The marketing team held a meeting to discuss the new product launch. They decided to focus on social media advertising and asked each member to prepare a detailed report by Friday. The manager emphasized the importance of meeting the deadline.',
    question: 'What did the manager emphasize?',
    options: [
      'Hiring more staff',
      'The importance of meeting the deadline',
      'Reducing the budget',
      'Changing the product design',
    ],
    correctAnswer: 1,
    transcriptZh: '行銷團隊開會討論新產品上市。他們決定專注於社群媒體廣告，並要求每位成員在週五前準備一份詳細報告。經理強調了按時完成的重要性。',
    targetWords: ['discuss', 'emphasize'],
    theme: 'workplace',
  },
  {
    id: 'listen_7',
    audioText: 'During the job interview, the candidate was asked about her previous experience managing a team. She described how she successfully led a project that increased company revenue by twenty percent within six months.',
    question: 'How much did the project increase company revenue?',
    options: [
      'Ten percent',
      'Fifteen percent',
      'Twenty percent',
      'Thirty percent',
    ],
    correctAnswer: 2,
    transcriptZh: '在求職面試中，面試官問到她之前管理團隊的經驗。她描述了自己如何成功主導一個專案，在六個月內將公司營收提高了百分之二十。',
    targetWords: ['manage', 'increase'],
    theme: 'workplace',
  },
  {
    id: 'listen_8',
    audioText: 'The software development team adopted an agile methodology this quarter. They hold daily stand-up meetings to track progress and address any blockers. The approach has improved communication and reduced project delivery time significantly.',
    question: 'What has the agile approach improved?',
    options: [
      'Employee salaries',
      'Office decoration',
      'Communication and reduced delivery time',
      'Number of clients',
    ],
    correctAnswer: 2,
    transcriptZh: '軟體開發團隊本季度採用了敏捷方法論。他們每天召開站立會議來追蹤進度並解決任何阻礙。這種方法改善了溝通，並大幅縮短了專案交付時間。',
    targetWords: ['adopt', 'improve'],
    theme: 'workplace',
  },
  {
    id: 'listen_9',
    audioText: 'The company announced a new remote work policy. Employees can now work from home three days a week, but they must attend the office on Mondays and Wednesdays for team collaboration sessions.',
    question: 'Which days must employees attend the office?',
    options: [
      'Monday and Wednesday',
      'Tuesday and Thursday',
      'Wednesday and Friday',
      'Monday and Friday',
    ],
    correctAnswer: 0,
    transcriptZh: '公司宣布了新的遠端工作政策。員工現在每週可以在家工作三天，但必須在週一和週三到辦公室參加團隊協作會議。',
    targetWords: ['announce', 'collaborate'],
    theme: 'workplace',
  },
  {
    id: 'listen_10',
    audioText: 'After reviewing the quarterly sales data, the director decided to restructure the sales team. Two new regional managers were appointed, and the company opened a new branch office in the southern part of the country.',
    question: 'What happened after reviewing the sales data?',
    options: [
      'The company closed two branches',
      'The sales team was restructured',
      'All employees received a bonus',
      'The director resigned',
    ],
    correctAnswer: 1,
    transcriptZh: '在審閱了季度銷售數據後，總監決定重組銷售團隊。兩位新的區域經理被任命，公司在南部地區開設了一家新的分公司。',
    targetWords: ['review', 'restructure'],
    theme: 'workplace',
  },
  /* ─── 學術 ─── */
  {
    id: 'listen_11',
    audioText: 'Professor Chen published a groundbreaking research paper on climate change. The study analyzed data from over fifty research stations worldwide and concluded that average temperatures have risen by one point five degrees over the past century.',
    question: 'How much have average temperatures risen according to the study?',
    options: [
      'Half a degree',
      'One degree',
      'One point five degrees',
      'Two degrees',
    ],
    correctAnswer: 2,
    transcriptZh: '陳教授發表了一篇關於氣候變遷的開創性研究論文。該研究分析了全球五十多個研究站的數據，並得出結論：過去一個世紀以來，平均溫度上升了一點五度。',
    targetWords: ['publish', 'analyze'],
    theme: 'academic',
  },
  {
    id: 'listen_12',
    audioText: 'The university library has extended its opening hours during the exam period. Students can now access the library twenty-four hours a day, seven days a week. The library also provides free coffee and snacks to help students stay alert during late-night study sessions.',
    question: 'What additional service does the library provide during exams?',
    options: [
      'Free textbooks',
      'Free coffee and snacks',
      'Free parking',
      'Free printing',
    ],
    correctAnswer: 1,
    transcriptZh: '大學圖書館在考試期間延長了開放時間。學生現在可以全天候使用圖書館。圖書館還提供免費咖啡和點心，幫助學生在深夜讀書時保持清醒。',
    targetWords: ['extend', 'access'],
    theme: 'academic',
  },
  {
    id: 'listen_13',
    audioText: 'The biology department is conducting a study on marine ecosystems. Researchers have been collecting samples from coral reefs in the Pacific Ocean for the past two years. Their preliminary findings suggest that ocean acidification is affecting coral growth rates.',
    question: 'What are the researchers studying?',
    options: [
      'Mountain ecosystems',
      'Desert wildlife',
      'Marine ecosystems and coral reefs',
      'Freshwater fish',
    ],
    correctAnswer: 2,
    transcriptZh: '生物學系正在進行一項關於海洋生態系統的研究。研究人員過去兩年一直在從太平洋的珊瑚礁採集樣本。他們的初步發現表明，海洋酸化正在影響珊瑚的生長速度。',
    targetWords: ['conduct', 'suggest'],
    theme: 'academic',
  },
  {
    id: 'listen_14',
    audioText: 'The history professor assigned a research paper on the impact of the Industrial Revolution. Students must cite at least ten academic sources and submit a first draft by the end of next month. The final paper should be between three thousand and five thousand words.',
    question: 'How many academic sources must students cite?',
    options: [
      'At least five',
      'At least eight',
      'At least ten',
      'At least fifteen',
    ],
    correctAnswer: 2,
    transcriptZh: '歷史學教授布置了一篇關於工業革命影響的研究論文。學生必須引用至少十個學術來源，並在下月底前提交初稿。終稿應在三千到五千字之間。',
    targetWords: ['assign', 'cite'],
    theme: 'academic',
  },
  {
    id: 'listen_15',
    audioText: 'A new study published in the Journal of Psychology found that students who take regular breaks during study sessions perform better on exams. The researchers recommend a ten-minute break every fifty minutes of focused study.',
    question: 'How long a break do researchers recommend?',
    options: [
      'Five minutes every thirty minutes',
      'Ten minutes every fifty minutes',
      'Fifteen minutes every hour',
      'Twenty minutes every two hours',
    ],
    correctAnswer: 1,
    transcriptZh: '《心理學期刊》發表的一項新研究發現，在學習期間定期休息的學生在考試中表現更好。研究人員建議每專注學習五十分鐘休息十分鐘。',
    targetWords: ['publish', 'recommend'],
    theme: 'academic',
  },
  /* ─── 旅遊 ─── */
  {
    id: 'listen_16',
    audioText: 'During their trip to Japan, the Chen family visited Tokyo, Kyoto, and Osaka. They especially enjoyed the ancient temples in Kyoto and tried traditional Japanese food at a local restaurant. The father took hundreds of photographs throughout the journey.',
    question: 'Which city did the Chen family enjoy the most?',
    options: [
      'Tokyo',
      'Kyoto',
      'Osaka',
      'They enjoyed all cities equally',
    ],
    correctAnswer: 1,
    transcriptZh: '在陳家人日本之旅期間，他們參觀了東京、京都和大阪。他們特別喜歡京都的古寺廟，還在當地餐廳品嚐了傳統日本料理。父親在整個旅程中拍了數百張照片。',
    targetWords: ['visit', 'enjoy'],
    theme: 'travel',
  },
  {
    id: 'listen_17',
    audioText: 'The travel agency recommended booking the hotel at least two months in advance for the summer holiday season. Popular destinations tend to fill up quickly, and prices increase significantly during peak travel months.',
    question: 'How far in advance should hotels be booked?',
    options: [
      'At least two weeks',
      'At least one month',
      'At least two months',
      'At least three months',
    ],
    correctAnswer: 2,
    transcriptZh: '旅行社建議在暑期至少提前兩個月預訂酒店。熱門目的地往往很快客滿，高峰旅遊月份的價格會顯著上漲。',
    targetWords: ['recommend', 'book'],
    theme: 'travel',
  },
  {
    id: 'listen_18',
    audioText: 'The airport announced that flight two-oh-three to Paris has been delayed by two hours due to severe weather conditions. Passengers are advised to wait in the departure lounge and check the information board for further updates.',
    question: 'Why was the flight to Paris delayed?',
    options: [
      'Technical problems with the aircraft',
      'Severe weather conditions',
      'A strike by airport staff',
      'A problem with the fuel supply',
    ],
    correctAnswer: 1,
    transcriptZh: '機場宣布，由於惡劣天氣狀況，前往巴黎的二零三號航班延誤了兩小時。建議乘客在候機室等候，並查看資訊板以獲取進一步更新。',
    targetWords: ['announce', 'delay'],
    theme: 'travel',
  },
  {
    id: 'listen_19',
    audioText: 'Backpacking through Southeast Asia has become increasingly popular among young travelers. The backpacker trail typically includes stops in Thailand, Vietnam, Cambodia, and Laos. Many travelers say the experience helped them become more independent and open-minded.',
    question: 'What do many travelers say about the backpacking experience?',
    options: [
      'It was too expensive',
      'It helped them become more independent and open-minded',
      'They would never do it again',
      'It was boring and repetitive',
    ],
    correctAnswer: 1,
    transcriptZh: '在東南亞背包旅行在年輕旅客中越來越受歡迎。背包客路線通常包括泰國、越南、柬埔寨和寮國的停留點。許多旅客說，這段經歷幫助他們變得更加獨立和開放。',
    targetWords: ['include', 'become'],
    theme: 'travel',
  },
  {
    id: 'listen_20',
    audioText: 'The cruise ship departed from the port of Barcelona and will travel along the Mediterranean coast. The seven-day itinerary includes stops in Marseille, Rome, and Santorini. Onboard entertainment includes live music, cooking classes, and a rooftop pool.',
    question: 'How many days does the cruise itinerary last?',
    options: [
      'Five days',
      'Seven days',
      'Ten days',
      'Fourteen days',
    ],
    correctAnswer: 1,
    transcriptZh: '郵輪從巴塞隆納港出發，將沿地中海海岸航行。為期七天的行程包括馬賽、羅馬和聖托里尼的停留。船上娛樂設施包括現場音樂、烹飪課程和一個屋頂游泳池。',
    targetWords: ['depart', 'include'],
    theme: 'travel',
  },
  /* ─── 科技 ─── */
  {
    id: 'listen_21',
    audioText: 'A technology startup has developed a new artificial intelligence tool that can translate spoken language in real time. The device supports over thirty languages and is designed to help travelers communicate easily in foreign countries.',
    question: 'What is the main purpose of the AI translation device?',
    options: [
      'To replace human translators',
      'To help travelers communicate in foreign countries',
      'To teach users new languages',
      'To transcribe business meetings',
    ],
    correctAnswer: 1,
    transcriptZh: '一家科技新創公司開發了一款新的人工智慧工具，可以即時翻譯口語語言。該裝置支援超過三十種語言，旨在幫助旅客在外國輕鬆交流。',
    targetWords: ['develop', 'support'],
    theme: 'tech',
  },
  {
    id: 'listen_22',
    audioText: 'The city government launched a smart traffic system to reduce congestion during rush hours. Sensors were installed at major intersections to monitor traffic flow, and the data is used to optimize traffic light timing in real time.',
    question: 'What is the purpose of the smart traffic system?',
    options: [
      'To increase parking fees',
      'To reduce congestion during rush hours',
      'To replace traffic police',
      'To ban cars from the city center',
    ],
    correctAnswer: 1,
    transcriptZh: '市政府推出了一套智慧交通系統，以減少尖峰時段的交通擁堵。主要路口安裝了感測器來監控車流量，數據用於即時優化交通號誌時序。',
    targetWords: ['launch', 'optimize'],
    theme: 'tech',
  },
  {
    id: 'listen_23',
    audioText: 'Researchers at a technology company have created a wearable device that monitors heart rate, sleep quality, and stress levels. The gadget syncs with a smartphone app and provides personalized health recommendations based on the collected data.',
    question: 'What does the wearable device monitor?',
    options: [
      'Only heart rate',
      'Heart rate, sleep quality, and stress levels',
      'Blood pressure and body temperature',
      'Calorie intake and exercise',
    ],
    correctAnswer: 1,
    transcriptZh: '一家科技公司的研究人員創造了一款可穿戴裝置，可以監測心率、睡眠品質和壓力水平。該裝置與智慧型手機應用程式同步，並根據收集的數據提供個人化的健康建議。',
    targetWords: ['create', 'monitor'],
    theme: 'tech',
  },
  {
    id: 'listen_24',
    audioText: 'A new coding bootcamp has been introduced to help people transition into tech careers. The twelve-week program covers web development, data science, and user interface design. Graduates have a ninety percent employment rate within six months.',
    question: 'What is the employment rate for graduates?',
    options: [
      'Seventy percent',
      'Eighty percent',
      'Ninety percent',
      'Ninety-five percent',
    ],
    correctAnswer: 2,
    percent: 90,
    transcriptZh: '一個新的程式語言訓練營已經推出，幫助人們轉換到科技職涯。為期十二週的課程涵蓋網頁開發、資料科學和使用者介面設計。畢業生在六個月內的就業率達到百分之九十。',
    targetWords: ['introduce', 'cover'],
    theme: 'tech',
  },
  /* ─── 健康 ─── */
  {
    id: 'listen_25',
    audioText: 'The nutritionist advised the patient to reduce sugar intake and eat more whole grains. She explained that a balanced diet combined with regular exercise is the most effective way to maintain a healthy weight and prevent chronic diseases.',
    question: 'What did the nutritionist recommend for a healthy lifestyle?',
    options: [
      'Taking dietary supplements',
      'A balanced diet combined with regular exercise',
      'Skipping meals to lose weight',
      'Only eating organic food',
    ],
    correctAnswer: 1,
    transcriptZh: '營養師建議病人減少糖分攝取，多吃全穀類。她解釋說，均衡飲食加上規律運動是維持健康體重和預防慢性疾病最有效的方法。',
    targetWords: ['recommend', 'maintain'],
    theme: 'health',
  },
  {
    id: 'listen_26',
    audioText: 'A study conducted by the National Health Institute found that people who sleep less than six hours a night have a higher risk of developing heart disease. The researchers recommend getting at least seven to eight hours of quality sleep each night.',
    question: 'How many hours of sleep do researchers recommend?',
    options: [
      'Five to six hours',
      'Six to seven hours',
      'Seven to eight hours',
      'Eight to nine hours',
    ],
    correctAnswer: 2,
    transcriptZh: '國立衛生研究院進行的一項研究發現，每晚睡眠不足六小時的人罹患心臟病的風險較高。研究人員建議每晚至少睡七到八小時的優質睡眠。',
    targetWords: ['conduct', 'recommend'],
    theme: 'health',
  },
];

/**
 * Shuffle array (Fisher-Yates).
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick N random items from array.
 */
function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

/**
 * Generate listening comprehension questions.
 * Prioritizes questions whose targetWords appear in the user's vocab library.
 * @param {Array} allCards - The user's vocabulary cards.
 * @param {number} count - Number of questions to return (default 5).
 * @returns {Array} Shuffled list of question objects.
 */
export function generateListeningQuestions(allCards, count = 5) {
  const vocabWords = new Set(
    (allCards || []).map(c => (c.word || '').toLowerCase()).filter(Boolean)
  );

  /* Score each question: +10 for each targetWord in vocab, +1 base */
  const scored = LISTENING_BANK.map(q => {
    let score = 1;
    for (const tw of q.targetWords) {
      if (vocabWords.has(tw.toLowerCase())) score += 10;
    }
    return { q, score };
  });

  /* Sort by score descending, then shuffle ties */
  scored.sort((a, b) => b.score - a.score);

  /* Pick top `count`, but shuffle within same score tier */
  const selected = [];
  let i = 0;
  while (selected.length < count && i < scored.length) {
    const tierStart = i;
    while (i < scored.length && scored[i].score === scored[tierStart].score) i++;
    const tier = shuffle(scored.slice(tierStart, i).map(s => s.q));
    for (const q of tier) {
      if (selected.length >= count) break;
      selected.push(q);
    }
  }

  return selected;
}

/**
 * Get total number of questions in the bank.
 */
export function getListeningBankSize() {
  return LISTENING_BANK.length;
}
