import poolSeed from '../electron/pool-seed.json';
import oakHighStory from '../community-pool/stories/pool-en-b1-f5b4772b21af.json';
import spearCipherStory from '../community-pool/stories/pool-en-b2-a476995313e7.json';
import difficultyProfiles from '../electron/difficulty-profiles.json';
import writingTopics from '../electron/writing-topics.json';
import scienceUnits from '../electron/science-units.json';
import scienceWriting from '../electron/science-writing.json';
import { getScience } from './science';

const STORAGE_KEYS = {
  books: 'leaflight-web-books-v1',
  trash: 'leaflight-web-trash-v1',
  settings: 'leaflight-web-settings-v1',
  apiKey: 'leaflight-web-apikey-v1',
  githubToken: 'leaflight-web-ghtoken-v1',
  pool: 'leaflight-web-pool-v1',
  writings: 'leaflight-web-writings-v1',
  writingTrash: 'leaflight-web-writing-trash-v1',
  writingReviews: 'leaflight-web-writing-reviews-v1',
  comparison: 'leaflight-web-comparison-v1',
  jobs: 'leaflight-web-jobs-v1',
  seededIds: 'leaflight-web-seeded-ids-v1'
};

const DEFAULT_PRESETS = [
  {
    name: '温暖日常 · B1',
    preset: {
      language: 'en',
      level: 'B1',
      genre: 'slice of life',
      words: 1000,
      totalChapters: 8,
      preferences: '贴近日常生活的温和故事，人物成熟自然，生词密度适中。'
    }
  },
  {
    name: '轻奇幻冒险 · B2',
    preset: {
      language: 'en',
      level: 'B2',
      genre: 'fantasy',
      words: 1000,
      totalChapters: 10,
      preferences: '有悬念但不过度黑暗的奇幻旅程，节奏明快。'
    }
  },
  {
    name: '海边物语 · N4',
    preset: {
      language: 'ja',
      level: 'N4',
      genre: 'slice of life',
      words: 800,
      totalChapters: 6,
      preferences: '海辺の小さな町を舞台にした、穏やかで少し不思議な日常物語。'
    }
  }
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in private browsing mode
  }
}

function normalizeReadings(readings: unknown): { surface: string; reading: string }[] {
  if (!Array.isArray(readings)) return [];
  const seen = new Set<string>();
  const out: { surface: string; reading: string }[] = [];
  for (const item of readings) {
    if (!item || typeof item !== 'object') continue;
    const surface = String((item as any).surface || '').trim();
    const reading = String((item as any).reading || '').trim();
    if (!surface || !reading || surface === reading || seen.has(surface)) continue;
    if (!/[\u4e00-\u9fff]/u.test(surface)) continue;
    seen.add(surface);
    out.push({ surface, reading });
  }
  return out;
}

function analyzeDifficulty(
  text = '',
  preset: { language?: string; level?: string } = {},
  readings: { surface: string; reading: string }[] = [],
  calibration = 0
) {
  const language = preset.language === 'ja' ? 'ja' : 'en';
  const level = preset.level || (language === 'ja' ? 'N3' : 'B1');
  const langProfiles = (difficultyProfiles as any)[language] || (difficultyProfiles as any).en;
  const base = langProfiles[level] || Object.values(langProfiles)[0];
  const shift = Math.max(-1, Math.min(1, Number(calibration) || 0));
  const delta = language === 'ja' ? shift * 4 : shift * 2;
  const target = {
    sentence: [Math.max(4, base.sentence[0] + delta), Math.max(6, base.sentence[1] + delta)],
    longSentence: Math.max(8, base.longSentence + delta * 2)
  };
  const clean = String(text || '').trim();
  const sentences = (
    language === 'ja'
      ? clean.split(/[。！？!?]+|\n+/u)
      : clean.split(/[.!?]+|\n+/u)
  )
    .map(s => s.trim())
    .filter(Boolean);

  if (language === 'ja') {
    const chars = Array.from(clean.replace(/\s+/gu, ''));
    const units = chars.length;
    const sentenceLengths = sentences.map(s => Array.from(s.replace(/\s+/gu, '')).length).filter(Boolean);
    const averageSentenceLength = sentenceLengths.length
      ? Number((sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length).toFixed(1))
      : 0;
    const longSentenceRatio = sentenceLengths.length
      ? Math.round((sentenceLengths.filter(n => n > target.longSentence).length / sentenceLengths.length) * 100)
      : 0;
    const kanjiChars = chars.filter(c => /[\u4e00-\u9fff]/u.test(c));
    const kanjiRatio = units ? Math.round((kanjiChars.length / units) * 100) : 0;
    const complexMatches = clean.match(/にもかかわらず|ざるを得ない|にほかならない|といったらない|兼ねない|に際して|をめぐって|つつある/gu) || [];
    const complexRatio = sentences.length ? Math.round((complexMatches.length / sentences.length) * 100) : 0;
    const covered = new Set<string>();
    for (const r of normalizeReadings(readings)) {
      for (const ch of Array.from(r.surface)) {
        if (/[\u4e00-\u9fff]/u.test(ch)) covered.add(ch);
      }
    }
    const distinctKanji = new Set(kanjiChars);
    let uncoveredKanji = 0;
    for (const ch of distinctKanji) {
      if (!covered.has(ch)) uncoveredKanji++;
    }
    const enough = units >= 120 && sentences.length >= 3;
    const warnings: string[] = [];
    if (enough) {
      if (averageSentenceLength > target.sentence[1]) warnings.push('long-average');
      if (averageSentenceLength < target.sentence[0]) warnings.push('short-average');
      if (longSentenceRatio > base.longRatioMax) warnings.push('long-sentences');
      if (kanjiRatio > base.kanjiMax) warnings.push('kanji-density');
      if (['N5', 'N4'].includes(level) && complexRatio > 8) warnings.push('advanced-patterns');
      if (['N5', 'N4', 'N3'].includes(level) && uncoveredKanji > 12) warnings.push('missing-readings');
    }
    return {
      version: 1,
      language,
      level,
      calibration: shift,
      enough,
      units,
      sentences: sentences.length,
      averageSentenceLength,
      longSentenceRatio,
      kanjiRatio,
      longWordRatio: 0,
      complexRatio,
      uncoveredKanji,
      target,
      warnings
    };
  }

  const words = clean.match(/\b[\w’'-]+\b/g) || [];
  const units = words.length;
  const sentenceLengths = sentences.map(s => (s.match(/\b[\w’'-]+\b/g) || []).length).filter(Boolean);
  const averageSentenceLength = sentenceLengths.length
    ? Number((sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length).toFixed(1))
    : 0;
  const longSentenceRatio = sentenceLengths.length
    ? Math.round((sentenceLengths.filter(n => n > target.longSentence).length / sentenceLengths.length) * 100)
    : 0;
  const longWords = words.filter(w => w.replace(/[^a-zA-Z]/g, '').length >= 9);
  const longWordRatio = units ? Math.round((longWords.length / units) * 100) : 0;
  const complexMatches =
    clean.match(/\b(although|nevertheless|furthermore|consequently|whereas|nonetheless|notwithstanding|albeit|whereby)\b/gi) || [];
  const complexRatio = sentences.length ? Math.round((complexMatches.length / sentences.length) * 100) : 0;
  const enough = units >= 60 && sentences.length >= 3;
  const warnings: string[] = [];
  if (enough) {
    if (averageSentenceLength > target.sentence[1]) warnings.push('long-average');
    if (averageSentenceLength < target.sentence[0]) warnings.push('short-average');
    if (longSentenceRatio > base.longRatioMax) warnings.push('long-sentences');
    if (longWordRatio > base.longWordMax) warnings.push('literary-words');
    if (['A2', 'B1'].includes(level) && complexRatio > 15) warnings.push('advanced-patterns');
  }
  return {
    version: 1,
    language,
    level,
    calibration: shift,
    enough,
    units,
    sentences: sentences.length,
    averageSentenceLength,
    longSentenceRatio,
    kanjiRatio: 0,
    longWordRatio,
    complexRatio,
    uncoveredKanji: 0,
    target,
    warnings
  };
}

function getAdjustment(feedback: { chapterId: string; rating: string; date: string }[] = []): number {
  const recent = feedback.slice(-8);
  if (!recent.length) return 0;
  const score = recent.reduce((sum, item) => sum + (item.rating === 'hard' ? -1 : item.rating === 'easy' ? 1 : 0), 0);
  return score <= -2 ? -1 : score >= 2 ? 1 : 0;
}

function poolStoryToBook(story: any, indexOffset = 0) {
  const language = story.preset?.language === 'ja' ? 'ja' : 'en';
  const chapters = (story.chapters || []).map((c: any, idx: number) => ({
    id: c.id || `${story.poolId}-ch-${idx + 1}`,
    title: String(c.title || `Chapter ${idx + 1}`),
    text: String(c.text || ''),
    summary: String(c.summary || ''),
    readings: language === 'ja' ? normalizeReadings(c.readings) : []
  }));
  const ts = new Date(Date.now() - indexOffset * 60_000).toISOString();
  return {
    id: story.poolId,
    poolId: story.poolId,
    source: 'pool' as const,
    sharedBy: story.sharedBy || 'Community Reader',
    title: story.title,
    synopsis: story.synopsis,
    bible: story.bible || '',
    outline: Array.isArray(story.outline) ? story.outline : chapters.map((c: any) => c.summary || c.title),
    sample: story.sample || chapters[0]?.text?.slice(0, 400) || '',
    sampleReadings: language === 'ja' ? normalizeReadings(story.sampleReadings) : [],
    preset: {
      language,
      level: story.preset?.level || (language === 'ja' ? 'N4' : 'B1'),
      genre: story.preset?.genre || 'fantasy',
      words: Number(story.preset?.words) || (language === 'ja' ? 800 : 1000),
      totalChapters: Math.max(chapters.length, Number(story.preset?.totalChapters) || chapters.length),
      preferences: story.preset?.preferences || story.note || ''
    },
    chapters,
    feedback: [],
    progress: { chapter: 0, fraction: 0 },
    bookmarks: [],
    updatedAt: ts
  };
}

function getCuratedPoolStories(): any[] {
  const seedList = Array.isArray(poolSeed) ? poolSeed : [];
  const byId = new Map<string, any>();
  const orderedRaw = [
    { ...oakHighStory, featured: true },
    ...seedList.filter((s: any) => s.poolId === 'pool-ja-n4-library').map((s: any) => ({ ...s, featured: true })),
    { ...spearCipherStory, featured: true },
    ...seedList.filter((s: any) => s.poolId !== 'pool-ja-n4-library').map((s: any) => ({ ...s, featured: true }))
  ];
  for (const item of orderedRaw) {
    if (item && item.poolId && !byId.has(item.poolId)) {
      byId.set(item.poolId, {
        version: 1,
        ...item
      });
    }
  }
  return [...byId.values()];
}

function ensureInitialBooks(): any[] {
  const curated = getCuratedPoolStories();
  const existing = readJson<any[] | null>(STORAGE_KEYS.books, null);
  const seededIds = new Set<string>(readJson<string[]>(STORAGE_KEYS.seededIds, []));

  if (!existing) {
    const initialBooks = curated.map((story, idx) => poolStoryToBook(story, idx));
    writeJson(STORAGE_KEYS.books, initialBooks);
    writeJson(
      STORAGE_KEYS.seededIds,
      curated.map(s => s.poolId)
    );
    return initialBooks;
  }

  let changed = false;
  const nextBooks = [...existing];
  curated.forEach((story, idx) => {
    if (!seededIds.has(story.poolId) && !nextBooks.some(b => b.id === story.poolId || b.poolId === story.poolId)) {
      nextBooks.unshift(poolStoryToBook(story, idx));
      seededIds.add(story.poolId);
      changed = true;
    }
  });
  if (changed) {
    writeJson(STORAGE_KEYS.books, nextBooks);
    writeJson(STORAGE_KEYS.seededIds, [...seededIds]);
  }
  return nextBooks;
}

function getPoolState(): { stories: any[]; syncedAt: string | null } {
  const cached = readJson<{ stories?: any[]; syncedAt?: string | null } | null>(STORAGE_KEYS.pool, null);
  const curated = getCuratedPoolStories();
  const merged = new Map<string, any>();
  for (const item of curated) merged.set(item.poolId, item);
  if (cached?.stories && Array.isArray(cached.stories)) {
    for (const item of cached.stories) {
      if (item?.poolId && Array.isArray(item.chapters) && item.chapters.length) {
        merged.set(item.poolId, item);
      }
    }
  }
  return {
    stories: [...merged.values()],
    syncedAt: cached?.syncedAt || null
  };
}

function findWritingExercise(topicId?: string | null) {
  if (!topicId) return null;
  const baseList = Array.isArray((writingTopics as any).topics) ? (writingTopics as any).topics : [];
  const sciList = Array.isArray((scienceWriting as any).topics) ? (scienceWriting as any).topics : [];
  const foundBase = baseList.find((t: any) => t.id === topicId);
  if (foundBase) return structuredClone(foundBase);
  const foundSci = sciList.find((t: any) => t.id === topicId);
  if (foundSci) {
    return {
      ...structuredClone(foundSci),
      science: getScience(foundSci.scienceUnitId, foundSci.language as 'en' | 'ja')
    };
  }
  return null;
}

function triggerDownload(filename: string, content: string, mime = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 200);
}

function pickFileText(accept = '.json,application/json'): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(val);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      file
        .text()
        .then(text => finish(text))
        .catch(() => finish(null));
    });
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

export function installWebBridge(): void {
  if (typeof window === 'undefined' || window.leaflight) return;

  const jobListeners = new Set<(jobs: any[]) => void>();
  const notifyJobs = () => {
    const currentJobs = readJson<any[]>(STORAGE_KEYS.jobs, []);
    for (const fn of jobListeners) {
      try {
        fn(currentJobs);
      } catch {
        // Ignore listener errors
      }
    }
  };

  async function handleCommand(command: string, payload: any = {}): Promise<any> {
    switch (command) {
      case 'library': {
        return ensureInitialBooks();
      }
      case 'trash': {
        return readJson<any[]>(STORAGE_KEYS.trash, []);
      }
      case 'settings': {
        const saved = readJson<any>(STORAGE_KEYS.settings, {});
        const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey) || '';
        const ghToken = localStorage.getItem(STORAGE_KEYS.githubToken) || '';
        return {
          uiLanguage: saved.uiLanguage || 'zh',
          model: saved.model || 'gemini-2.5-flash',
          apiGenerationAvailable: false,
          hasKey: Boolean(apiKey),
          hasGithubToken: Boolean(ghToken),
          poolNickname: saved.poolNickname || '',
          encryptionAvailable: false,
          presets: Array.isArray(saved.presets) && saved.presets.length ? saved.presets : DEFAULT_PRESETS,
          reader: saved.reader || {
            effect: 'none',
            showReadings: true,
            font: 'serif',
            size: 20,
            line: 1.85,
            width: 720,
            theme: 'paper',
            mode: 'scroll'
          },
          lastUsage: saved.lastUsage
        };
      }
      case 'save-settings': {
        const current = await handleCommand('settings');
        if (payload.clearKey) {
          localStorage.removeItem(STORAGE_KEYS.apiKey);
        }
        const next = {
          ...current,
          uiLanguage: payload.uiLanguage || current.uiLanguage || 'zh',
          model: payload.model || current.model || 'gemini-2.5-flash'
        };
        writeJson(STORAGE_KEYS.settings, next);
        return handleCommand('settings');
      }
      case 'save-reader': {
        const current = readJson<any>(STORAGE_KEYS.settings, {});
        current.reader = { ...(current.reader || {}), ...(payload || {}) };
        writeJson(STORAGE_KEYS.settings, current);
        return current.reader;
      }
      case 'save-presets': {
        const current = readJson<any>(STORAGE_KEYS.settings, {});
        current.presets = Array.isArray(payload) ? payload : DEFAULT_PRESETS;
        writeJson(STORAGE_KEYS.settings, current);
        return current.presets;
      }
      case 'jobs': {
        return readJson<any[]>(STORAGE_KEYS.jobs, []);
      }
      case 'job': {
        const jobs = readJson<any[]>(STORAGE_KEYS.jobs, []);
        return jobs.find(j => j.id === payload?.id) || null;
      }
      case 'jobs-read': {
        const jobs = readJson<any[]>(STORAGE_KEYS.jobs, []).map(j => ({ ...j, unread: false }));
        writeJson(STORAGE_KEYS.jobs, jobs);
        return jobs;
      }
      case 'cancel': {
        const jobs = readJson<any[]>(STORAGE_KEYS.jobs, []).map(j =>
          j.id === payload?.id ? { ...j, status: 'cancelled', stage: '已取消', updatedAt: new Date().toISOString() } : j
        );
        writeJson(STORAGE_KEYS.jobs, jobs);
        return jobs;
      }
      case 'progress': {
        const books = ensureInitialBooks();
        const idx = books.findIndex(b => b.id === payload?.id);
        if (idx >= 0 && payload?.progress) {
          books[idx] = {
            ...books[idx],
            progress: payload.progress,
            updatedAt: new Date().toISOString()
          };
          writeJson(STORAGE_KEYS.books, books);
          return books[idx];
        }
        return null;
      }
      case 'bookmark': {
        const books = ensureInitialBooks();
        const idx = books.findIndex(b => b.id === payload?.id);
        if (idx < 0) throw new Error('找不到该作品。');
        const mark = {
          id: 'bm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          ...payload.progress
        };
        books[idx] = {
          ...books[idx],
          bookmarks: [...(books[idx].bookmarks || []), mark]
        };
        writeJson(STORAGE_KEYS.books, books);
        return books[idx];
      }
      case 'remove-bookmarks': {
        const books = ensureInitialBooks();
        const idx = books.findIndex(b => b.id === payload?.id);
        if (idx < 0) throw new Error('找不到该作品。');
        const removeSet = new Set(payload?.ids || []);
        books[idx] = {
          ...books[idx],
          bookmarks: (books[idx].bookmarks || []).filter((m: any) => !removeSet.has(m.id))
        };
        writeJson(STORAGE_KEYS.books, books);
        return books[idx];
      }
      case 'reanchor': {
        const books = ensureInitialBooks();
        const idx = books.findIndex(b => b.id === payload?.id);
        if (idx < 0) throw new Error('找不到该作品。');
        const byId = new Map<string, any>((payload?.marks || []).map((m: any) => [m.id, m]));
        books[idx] = {
          ...books[idx],
          bookmarks: (books[idx].bookmarks || []).map((m: any) => (byId.has(m.id) ? { ...m, ...byId.get(m.id) } : m))
        };
        writeJson(STORAGE_KEYS.books, books);
        return books[idx];
      }
      case 'delete-book': {
        const books = ensureInitialBooks();
        const trash = readJson<any[]>(STORAGE_KEYS.trash, []);
        const target = books.find(b => b.id === payload?.id);
        const remaining = books.filter(b => b.id !== payload?.id);
        if (target) {
          trash.unshift({ ...target, deletedAt: new Date().toISOString() });
          writeJson(STORAGE_KEYS.trash, trash);
        }
        writeJson(STORAGE_KEYS.books, remaining);
        return remaining;
      }
      case 'recover-book': {
        const books = ensureInitialBooks();
        const trash = readJson<any[]>(STORAGE_KEYS.trash, []);
        const target = trash.find(b => b.id === payload?.id);
        const remainingTrash = trash.filter(b => b.id !== payload?.id);
        if (target) {
          const { deletedAt: _deleted, ...rest } = target;
          books.unshift({ ...rest, updatedAt: new Date().toISOString() });
          writeJson(STORAGE_KEYS.books, books);
          writeJson(STORAGE_KEYS.trash, remainingTrash);
        }
        return books;
      }
      case 'demo': {
        const books = ensureInitialBooks();
        const existing = books.find(b => b.demo || b.id === 'pool-en-b1-lantern');
        if (existing) return existing;
        const lantern = (Array.isArray(poolSeed) ? poolSeed : []).find((s: any) => s.poolId === 'pool-en-b1-lantern') || getCuratedPoolStories()[0];
        const demoBook = {
          ...poolStoryToBook(lantern, 0),
          id: 'demo-lantern-keeper',
          demo: true
        };
        books.unshift(demoBook);
        writeJson(STORAGE_KEYS.books, books);
        return demoBook;
      }
      case 'import-story': {
        const books = ensureInitialBooks();
        const id = 'import-' + Date.now().toString(36);
        const rawChapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
        const imported = {
          id,
          source: 'import' as const,
          title: String(payload?.title || 'Imported Story'),
          synopsis: String(payload?.synopsis || rawChapters[0]?.text?.slice(0, 180) || ''),
          sample: String(rawChapters[0]?.text?.slice(0, 360) || ''),
          sampleReadings: [],
          preset: {
            language: payload?.language === 'ja' ? 'ja' : 'en',
            level: payload?.language === 'ja' ? 'N3' : 'B1',
            genre: 'slice of life',
            words: 1000,
            totalChapters: Math.max(1, rawChapters.length),
            preferences: ''
          },
          chapters: rawChapters.map((c: any, idx: number) => ({
            id: `${id}-ch-${idx + 1}`,
            title: String(c.title || `Chapter ${idx + 1}`),
            text: String(c.text || ''),
            summary: '',
            readings: []
          })),
          feedback: [],
          progress: { chapter: 0, fraction: 0 },
          bookmarks: [],
          updatedAt: new Date().toISOString()
        };
        books.unshift(imported);
        try{localStorage.setItem(STORAGE_KEYS.books,JSON.stringify(books));}catch{throw Error('网页预览存储空间不足，请使用 Mac 或 Android 客户端导入长篇。');}
        return imported;
      }
      case 'difficulty': {
        const books = ensureInitialBooks();
        const b = books.find(x => x.id === payload?.id);
        if (!b) throw new Error('找不到该作品。');
        const adj = getAdjustment(b.feedback || []);
        if (payload?.chapterId === 'sample') {
          return {
            report: analyzeDifficulty(b.sample, b.preset, b.sampleReadings, adj),
            feedback: null,
            adjustment: adj
          };
        }
        const ch = (b.chapters || []).find((c: any) => c.id === payload?.chapterId) || b.chapters?.[0];
        const fb = (b.feedback || []).find((f: any) => f.chapterId === ch?.id)?.rating || null;
        return {
          report: analyzeDifficulty(ch?.text || '', b.preset, ch?.readings || [], ch?.calibrationUsed ?? adj),
          feedback: fb,
          adjustment: adj
        };
      }
      case 'feedback': {
        const books = ensureInitialBooks();
        const idx = books.findIndex(x => x.id === payload?.id);
        if (idx < 0) throw new Error('找不到该作品。');
        const b = books[idx];
        const nextFb = (b.feedback || []).filter((f: any) => f.chapterId !== payload?.chapterId);
        nextFb.push({
          chapterId: payload.chapterId,
          rating: payload.rating,
          date: new Date().toISOString()
        });
        books[idx] = { ...b, feedback: nextFb };
        writeJson(STORAGE_KEYS.books, books);
        return books[idx];
      }
      case 'comparison': {
        return readJson<any>(STORAGE_KEYS.comparison, null);
      }
      case 'pool-list': {
        return getPoolState();
      }
      case 'pool-sync': {
        const state = getPoolState();
        const byId = new Map<string, any>(state.stories.map(s => [s.poolId, s]));
        let warning: string | undefined;
        try {
          const resp = await fetch(
            'https://raw.githubusercontent.com/jayson-sheyue/Leaflight/main/community-pool/index.json',
            { cache: 'no-store' }
          );
          if (resp.ok) {
            const indexData = await resp.json();
            const remoteList = Array.isArray(indexData?.stories) ? indexData.stories : [];
            for (const item of remoteList) {
              if (!item?.poolId) continue;
              if (Array.isArray(item.chapters) && item.chapters.length) {
                const existing = byId.get(item.poolId);
                if (!existing || item.chapters.length >= (existing.chapters?.length || 0)) {
                  byId.set(item.poolId, item);
                }
              } else if (item.path && !byId.has(item.poolId)) {
                const detailResp = await fetch(
                  `https://raw.githubusercontent.com/jayson-sheyue/Leaflight/main/${item.path}`,
                  { cache: 'no-store' }
                );
                if (detailResp.ok) {
                  const detail = await detailResp.json();
                  if (detail?.poolId && Array.isArray(detail.chapters)) {
                    byId.set(detail.poolId, detail);
                  }
                }
              }
            }
          }
        } catch {
          warning = '当前处于离线或网络受限环境，已展示内置精选与本地书池缓存。';
        }
        const nextState = {
          stories: [...byId.values()],
          syncedAt: new Date().toISOString(),
          ...(warning ? { warning } : {})
        };
        writeJson(STORAGE_KEYS.pool, nextState);
        return nextState;
      }
      case 'pool-add': {
        const { stories } = getPoolState();
        const story = stories.find(s => s.poolId === payload?.poolId);
        if (!story) throw new Error('在共享书池中未找到该作品。');
        const books = ensureInitialBooks();
        const existing = books.find(b => b.id === story.poolId || b.poolId === story.poolId);
        if (existing) return existing;
        const book = poolStoryToBook(story, 0);
        books.unshift(book);
        writeJson(STORAGE_KEYS.books, books);
        return book;
      }
      case 'pool-import': {
        const text = await pickFileText('.json,application/json');
        if (!text) return false;
        const parsed = JSON.parse(text);
        const story = parsed?.story || parsed;
        if (!story?.poolId || !Array.isArray(story?.chapters) || !story.chapters.length) {
          throw new Error('无效的共享书池文件格式。');
        }
        const state = getPoolState();
        const stories = [story, ...state.stories.filter(s => s.poolId !== story.poolId)];
        writeJson(STORAGE_KEYS.pool, { stories, syncedAt: state.syncedAt });
        const books = ensureInitialBooks();
        const book = poolStoryToBook(story, 0);
        const nextBooks = [book, ...books.filter(b => b.id !== book.id && b.poolId !== story.poolId)];
        writeJson(STORAGE_KEYS.books, nextBooks);
        return { book, stories };
      }
      case 'pool-export':
      case 'pool-share-browser':
      case 'pool-share-issue': {
        const books = ensureInitialBooks();
        const b = books.find(x => x.id === payload?.id);
        if (!b || !b.chapters?.length) throw new Error('请先选择一部包含已生成章节的作品。');
        const sharedBy = String(payload?.sharedBy || '').trim() || 'Community Reader';
        const savedSettings = readJson<any>(STORAGE_KEYS.settings, {});
        if (sharedBy !== 'Community Reader') {
          savedSettings.poolNickname = sharedBy;
          writeJson(STORAGE_KEYS.settings, savedSettings);
        }
        const poolId = b.poolId || `pool-${b.preset?.language || 'en'}-${String(b.preset?.level || 'b1').toLowerCase()}-${b.id.slice(0, 8)}`;
        const exportPayload = {
          format: 'leaflight-pool-story',
          version: 1,
          story: {
            poolId,
            sharedBy,
            sharedAt: new Date().toISOString(),
            note: '',
            preset: b.preset,
            title: b.title,
            synopsis: b.synopsis,
            bible: b.bible || '',
            outline: b.outline || [],
            sample: b.sample || b.chapters[0]?.text?.slice(0, 400) || '',
            sampleReadings: b.sampleReadings || [],
            chapters: b.chapters.map((c: any) => ({
              title: c.title,
              text: c.text,
              summary: c.summary || '',
              readings: c.readings || []
            }))
          }
        };
        if (command === 'pool-export') {
          const safeTitle = b.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\u3040-\u30ff_-]+/g, '-').slice(0, 40) || 'story';
          triggerDownload(`${safeTitle}.leaflight-story.json`, JSON.stringify(exportPayload, null, 2));
          return true;
        }
        const issueBody = [
          `### Shared Story: ${b.title}`,
          `- **Language / Level**: ${(b.preset?.language || 'en').toUpperCase()} · ${b.preset?.level || 'B1'}`,
          `- **Genre**: ${b.preset?.genre || 'fiction'}`,
          `- **Chapters**: ${b.chapters.length}`,
          `- **Shared by**: ${sharedBy}`,
          '',
          '```leaflight-story',
          JSON.stringify(exportPayload),
          '```'
        ].join('\n');
        try {
          await navigator.clipboard.writeText(issueBody);
        } catch {
          // Ignore clipboard permission errors
        }
        const issueTitle = encodeURIComponent(`[Story Pool] ${b.title} (${(b.preset?.language || 'en').toUpperCase()} ${b.preset?.level || 'B1'})`);
        window.open(`https://github.com/jayson-sheyue/Leaflight/issues/new?title=${issueTitle}`, '_blank', 'noopener');
        return true;
      }
      case 'export': {
        const books = ensureInitialBooks();
        const b = books.find(x => x.id === payload?.id);
        if (!b) throw new Error('找不到该作品。');
        const safeTitle = b.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\u3040-\u30ff_-]+/g, '-').slice(0, 40) || 'story';
        const txt = [
          b.title,
          b.synopsis,
          '',
          ...(b.chapters || []).flatMap((c: any, idx: number) => [
            `Chapter ${idx + 1}: ${c.title}`,
            '',
            c.text,
            ''
          ])
        ].join('\n');
        triggerDownload(`${safeTitle}.txt`, txt, 'text/plain;charset=utf-8');
        return true;
      }
      case 'backup': {
        const backupPayload = {
          format: 'leaflight-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          books: ensureInitialBooks(),
          writings: readJson<any[]>(STORAGE_KEYS.writings, [])
        };
        triggerDownload(`leaflight-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backupPayload, null, 2));
        return true;
      }
      case 'restore': {
        const text = await pickFileText('.json,application/json');
        if (!text) return false;
        const data = JSON.parse(text);
        if (Array.isArray(data?.books)) {
          const current = ensureInitialBooks();
          const byId = new Map(current.map(b => [b.id, b]));
          for (const incoming of data.books) {
            if (incoming?.id && !byId.has(incoming.id)) {
              byId.set(incoming.id, incoming);
            }
          }
          const merged = [...byId.values()];
          writeJson(STORAGE_KEYS.books, merged);
          return merged;
        }
        throw new Error('无效的备份文件。');
      }
      case 'writing-list': {
        return readJson<any[]>(STORAGE_KEYS.writings, []);
      }
      case 'writing-trash': {
        return readJson<any[]>(STORAGE_KEYS.writingTrash, []);
      }
      case 'writing-new': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const now = new Date().toISOString();
        const draft = {
          id: 'w-' + Date.now().toString(36),
          title: String(payload?.title || '未命名草稿'),
          language: payload?.language === 'ja' ? 'ja' : 'en',
          text: String(payload?.text || ''),
          goal: String(payload?.goal || ''),
          exercise: findWritingExercise(payload?.topicId),
          version: 1,
          createdAt: now,
          updatedAt: now,
          archivedAt: null
        };
        writings.unshift(draft);
        writeJson(STORAGE_KEYS.writings, writings);
        return draft;
      }
      case 'writing-save': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const idx = writings.findIndex(w => w.id === payload?.id);
        if (idx < 0) throw new Error('找不到该写作草稿。');
        const nextExercise =
          payload?.topicId !== undefined ? findWritingExercise(payload.topicId) : writings[idx].exercise || null;
        writings[idx] = {
          ...writings[idx],
          title: payload?.title ?? writings[idx].title,
          language: payload?.language ?? writings[idx].language,
          text: payload?.text ?? writings[idx].text,
          goal: payload?.goal ?? writings[idx].goal,
          exercise: nextExercise,
          version: (writings[idx].version || 1) + 1,
          updatedAt: new Date().toISOString()
        };
        writeJson(STORAGE_KEYS.writings, writings);
        return writings[idx];
      }
      case 'writing-archive': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const idx = writings.findIndex(w => w.id === payload?.id);
        if (idx >= 0) {
          writings[idx] = {
            ...writings[idx],
            archivedAt: payload?.archived ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString()
          };
          writeJson(STORAGE_KEYS.writings, writings);
        }
        return writings[idx] || null;
      }
      case 'writing-delete': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const trash = readJson<any[]>(STORAGE_KEYS.writingTrash, []);
        writeJson(
          STORAGE_KEYS.writings,
          writings.filter(w => w.id !== payload?.id)
        );
        writeJson(
          STORAGE_KEYS.writingTrash,
          trash.filter(w => w.id !== payload?.id)
        );
        return true;
      }
      case 'writing-recover': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const trash = readJson<any[]>(STORAGE_KEYS.writingTrash, []);
        const target = trash.find(w => w.id === payload?.id);
        const remainingTrash = trash.filter(w => w.id !== payload?.id);
        if (target) {
          const { deletedAt: _deleted, ...rest } = target;
          const restored = { ...rest, archivedAt: null, updatedAt: new Date().toISOString() };
          writings.unshift(restored);
          writeJson(STORAGE_KEYS.writings, writings);
          writeJson(STORAGE_KEYS.writingTrash, remainingTrash);
          return restored;
        }
        throw new Error('找不到该写作草稿。');
      }
      case 'writing-reviews': {
        const all = readJson<Record<string, any[]>>(STORAGE_KEYS.writingReviews, {});
        return all[payload?.id || payload?.draftId] || [];
      }
      case 'writing-review': {
        const all = readJson<Record<string, any[]>>(STORAGE_KEYS.writingReviews, {});
        const list = all[payload?.id || payload?.draftId] || [];
        return list.find(r => r.id === payload?.reviewId) || list[0] || null;
      }
      case 'writing-export': {
        const writings = readJson<any[]>(STORAGE_KEYS.writings, []);
        const w = writings.find(x => x.id === payload?.id);
        if (!w) throw new Error('找不到该写作草稿。');
        const safeTitle = (w.title || 'writing').replace(/[^a-zA-Z0-9\u4e00-\u9fa5\u3040-\u30ff_-]+/g, '-').slice(0, 40) || 'writing';
        triggerDownload(`${safeTitle}.txt`, `${w.title}\n\n${w.text}`, 'text/plain;charset=utf-8');
        return true;
      }
      case 'science-source': {
        const sources = Array.isArray((scienceUnits as any).sources) ? (scienceUnits as any).sources : [];
        const found = sources.find((s: any) => s.id === payload?.id);
        if (found?.url) {
          window.open(found.url, '_blank', 'noopener');
        }
        return true;
      }
      case 'window-focus': {
        const active = !!(payload && (payload as {active?: boolean}).active);
        try {
          if (active) {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(() => {});
          } else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
        } catch { /* The browser can reject fullscreen outside a user gesture. The panel still fills the page. */ }
        return true;
      }
      case 'preview':
      case 'create':
      case 'generate':
      case 'generate-batch':
      case 'compare':
      case 'review-writing':
      case 'retry-job': {
        throw new Error('网页预览不提供 AI 生成与评审，请使用 Mac 或 Android 客户端。');
      }
      default:
        return null;
    }
  }

  window.leaflight = {
    onJobs(handler) {
      jobListeners.add(handler);
      return () => jobListeners.delete(handler);
    },
    onClose() {
      // No-op in web browser
    },
    async call(command: string, payload?: unknown) {
      try {
        const value = await handleCommand(command, payload);
        if (['jobs-read', 'cancel'].includes(command)) notifyJobs();
        return { ok: true, value };
      } catch (err) {
        return {
          ok: false,
          value: null,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
  };
}

installWebBridge();
