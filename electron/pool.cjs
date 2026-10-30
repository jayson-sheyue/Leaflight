const { randomUUID, createHash } = require('node:crypto');
const { validatePreset, validChapter } = require('./store.cjs');
const { normalizeBook, normalizeGenerated, normalizeText } = require('./text.cjs');
const { analyze, normalizeReadings } = require('./difficulty.cjs');
const SEED_STORIES = require('./pool-seed.json');

const DEFAULT_REPO = 'jayson-sheyue/Leaflight';

function computePoolId(story) {
  if (typeof story?.poolId === 'string' && /^[a-z0-9][a-z0-9._-]{2,80}$/i.test(story.poolId.trim())) {
    return story.poolId.trim().toLowerCase();
  }
  const lang = story?.preset?.language || 'en';
  const level = story?.preset?.level || 'B1';
  const title = String(story?.title || '').trim().toLowerCase();
  const firstChapter = String(story?.chapters?.[0]?.title || '').trim().toLowerCase();
  const digest = createHash('sha256').update(`${lang}:${level}:${title}:${firstChapter}`).digest('hex').slice(0, 12);
  return `pool-${lang}-${level.toLowerCase()}-${digest}`;
}

function validatePoolStory(raw) {
  const input = raw?.story && typeof raw.story === 'object' ? raw.story : raw;
  if (!input || typeof input !== 'object') throw Error('共享书池作品数据无效。');
  const cleaned = normalizeGenerated(input);
  if (typeof cleaned.title !== 'string' || !cleaned.title.trim() || cleaned.title.length > 300) {
    throw Error('共享书池作品标题无效。');
  }
  if (!Array.isArray(cleaned.chapters) || !cleaned.chapters.length || cleaned.chapters.length > 100) {
    throw Error('共享书池作品必须包含至少 1 个有效章节。');
  }
  const chapters = cleaned.chapters.map((c, idx) => {
    if (!c || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 300 || typeof c.text !== 'string' || c.text.trim().length < 80 || c.text.length >= 150000) {
      throw Error('共享书池作品章节内容不完整。');
    }
    const summary = typeof c.summary === 'string' && c.summary.trim() ? normalizeText(c.summary.trim()).slice(0, 2000) : normalizeText(c.title.trim());
    return {
      title: normalizeText(c.title.trim()),
      text: normalizeText(c.text.trim()),
      summary,
      readings: normalizeReadings(c.readings),
      index: idx
    };
  });

  const rawPreset = cleaned.preset && typeof cleaned.preset === 'object' ? cleaned.preset : {};
  const lang = ['en', 'ja'].includes(rawPreset.language) ? rawPreset.language : 'en';
  const defaultLevel = lang === 'ja' ? 'N4' : 'B1';
  const level = typeof rawPreset.level === 'string' ? rawPreset.level : defaultLevel;
  const genre = ['fantasy', 'mystery', 'science fiction', 'adventure', 'slice of life', 'romance'].includes(rawPreset.genre) ? rawPreset.genre : 'slice of life';
  const words = Number.isInteger(rawPreset.words) ? Math.min(lang === 'ja' ? 6000 : 3000, Math.max(300, rawPreset.words)) : (lang === 'ja' ? 900 : 600);
  const outlineRaw = Array.isArray(cleaned.outline) && cleaned.outline.every(x => typeof x === 'string' && x.trim())
    ? cleaned.outline.map(x => normalizeText(x.trim()).slice(0, 500))
    : chapters.map(c => c.title);
  const totalChapters = Math.min(100, Math.max(chapters.length, outlineRaw.length, Number.isInteger(rawPreset.totalChapters) ? rawPreset.totalChapters : chapters.length));
  const outline = [...outlineRaw];
  while (outline.length < totalChapters) {
    const ch = chapters[outline.length];
    outline.push(ch ? ch.title : `Chapter ${outline.length + 1}`);
  }
  const preferences = typeof rawPreset.preferences === 'string' ? rawPreset.preferences.slice(0, 3000) : '';
  const preset = validatePreset({ language: lang, level, genre, words, totalChapters, preferences });

  const synopsis = typeof cleaned.synopsis === 'string' && cleaned.synopsis.trim()
    ? normalizeText(cleaned.synopsis.trim()).slice(0, 4000)
    : chapters[0].summary;
  const bible = typeof cleaned.bible === 'string' ? normalizeText(cleaned.bible.trim()).slice(0, 6000) : '';
  const sample = typeof cleaned.sample === 'string' && cleaned.sample.trim()
    ? normalizeText(cleaned.sample.trim()).slice(0, 20000)
    : chapters[0].text.split(/\n\s*\n/).slice(0, 2).join('\n\n');
  const sampleReadings = normalizeReadings(cleaned.sampleReadings ?? chapters[0].readings);
  const sharedBy = typeof cleaned.sharedBy === 'string' && cleaned.sharedBy.trim()
    ? cleaned.sharedBy.trim().slice(0, 60)
    : 'Leaflight Reader';
  const sharedAt = typeof cleaned.sharedAt === 'string' && !Number.isNaN(Date.parse(cleaned.sharedAt))
    ? new Date(cleaned.sharedAt).toISOString()
    : '2026-04-20T00:00:00.000Z';
  const note = typeof cleaned.note === 'string' ? cleaned.note.trim().slice(0, 280) : '';
  const sourceUrl = typeof cleaned.sourceUrl === 'string' && /^https:\/\/github\.com\//i.test(cleaned.sourceUrl)
    ? cleaned.sourceUrl
    : undefined;
  const poolId = computePoolId({ ...cleaned, preset, chapters });

  return {
    poolId,
    sharedBy,
    sharedAt,
    note,
    ...(sourceUrl ? { sourceUrl } : {}),
    preset,
    title: normalizeText(cleaned.title.trim()),
    synopsis,
    bible,
    outline: outline.slice(0, totalChapters),
    sample,
    sampleReadings,
    chapters: chapters.map(({ title, text, summary, readings }) => ({ title, text, summary, readings }))
  };
}

function formatIssueBody(storyInput) {
  const story = storyInput?.story && typeof storyInput.story === 'object' ? storyInput.story : storyInput;
  const langLabel = (story.preset?.language || 'en').toUpperCase();
  const payloadJson = JSON.stringify({ format: 'leaflight-pool-story', version: 1, story }, null, 2);
  return [
    `### ${story.title}`,
    '',
    `- **Language / Level**: ${langLabel} · ${story.preset?.level || 'B1'}`,
    `- **Genre**: ${story.preset?.genre || 'slice of life'}`,
    `- **Chapters**: ${story.chapters?.length || 0} / ${story.preset?.totalChapters || story.chapters?.length || 0}`,
    `- **Shared by**: ${story.sharedBy || 'Leaflight Reader'}`,
    ...(story.note ? [`- **Reader Note**: ${story.note}`] : []),
    '',
    `> ${story.synopsis || ''}`,
    '',
    '```leaflight-story',
    payloadJson,
    '```'
  ].join('\n');
}

function sanitizeForPool(book, meta = {}) {
  if (!book || typeof book !== 'object') throw Error('找不到要分享的作品。');
  const normalized = normalizeBook(book);
  if (!Array.isArray(normalized.chapters) || !normalized.chapters.length || !normalized.chapters.every(validChapter)) {
    throw Error('请先生成至少 1 个完整章节后再分享到公共书池。');
  }
  const opts = typeof meta === 'string' ? { sharedBy: meta } : (meta || {});
  const sharedBy = typeof opts.sharedBy === 'string' && opts.sharedBy.trim()
    ? opts.sharedBy.trim().slice(0, 60)
    : 'Leaflight Reader';
  const note = typeof opts.note === 'string' ? opts.note.trim().slice(0, 280) : '';
  const sharedAt = new Date().toISOString();
  const story = validatePoolStory({
    poolId: normalized.poolId,
    sharedBy,
    sharedAt,
    note,
    preset: normalized.preset,
    title: normalized.title,
    synopsis: normalized.synopsis || normalized.chapters[0].summary || normalized.title,
    bible: normalized.bible || '',
    outline: Array.isArray(normalized.outline) && normalized.outline.length ? normalized.outline : normalized.chapters.map(c => c.title),
    sample: normalized.sample || normalized.chapters[0].text.split(/\n\s*\n/).slice(0, 2).join('\n\n'),
    sampleReadings: normalized.sampleReadings || normalized.chapters[0].readings || [],
    chapters: normalized.chapters.map(c => ({
      title: c.title,
      text: c.text,
      summary: c.summary || c.title,
      readings: normalizeReadings(c.readings)
    }))
  });

  const langLabel = (story.preset.language || 'en').toUpperCase();
  const issueTitle = `[Story Pool] (${langLabel} ${story.preset.level}) ${story.title}`;
  const issueBody = formatIssueBody(story);

  const repo = typeof opts.repo === 'string' && opts.repo.trim() ? opts.repo.trim() : DEFAULT_REPO;
  const fullUrl = `https://github.com/${repo}/issues/new?labels=story-pool&title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
  const fallbackBody = [
    `### ${story.title}`,
    '',
    `> 已自动将完整作品 JSON 复制到剪贴板。请在下方直接粘贴（macOS 按 Cmd+V / Windows 按 Ctrl+V）后点击 Submit new issue 即可！`,
    '',
    '<!-- 请在此处粘贴剪贴板中的内容 -->'
  ].join('\n');
  const newIssueUrl = fullUrl.length <= 7200
    ? fullUrl
    : `https://github.com/${repo}/issues/new?labels=story-pool&title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(fallbackBody)}`;

  return {
    story,
    exportPayload: { format: 'leaflight-pool-story', version: 1, story },
    issueTitle,
    issueBody,
    newIssueUrl,
    urlTruncated: fullUrl.length > 7200
  };
}

function poolStoryToBook(rawStory) {
  const s = validatePoolStory(rawStory);
  const now = new Date().toISOString();
  const chapters = s.chapters.map(c => {
    const readings = normalizeReadings(c.readings);
    return {
      id: randomUUID(),
      title: c.title,
      text: c.text,
      summary: c.summary || c.title,
      readings,
      calibrationUsed: 0,
      difficulty: analyze(c.text, s.preset, 0, readings),
      createdAt: now
    };
  });
  return normalizeBook({
    id: randomUUID(),
    source: 'pool',
    poolId: s.poolId,
    sharedBy: s.sharedBy,
    preset: s.preset,
    title: s.title,
    synopsis: s.synopsis,
    bible: s.bible,
    outline: s.outline,
    sample: s.sample,
    sampleReadings: normalizeReadings(s.sampleReadings),
    sampleDifficulty: analyze(s.sample, s.preset, 0, s.sampleReadings),
    feedback: [],
    memory: chapters.at(-1)?.summary || s.synopsis,
    chapters,
    progress: { chapter: 0, fraction: 0 },
    bookmarks: [],
    createdAt: now,
    updatedAt: now
  });
}

function extractStoryFromIssue(issue) {
  if (!issue || typeof issue.body !== 'string') return null;
  const fenceMatch = issue.body.match(/```(?:leaflight-story|json)\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : issue.body.trim();
  if (!candidate.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(candidate);
    const raw = parsed?.story && typeof parsed.story === 'object' ? parsed.story : parsed;
    return validatePoolStory({
      ...raw,
      sharedBy: raw.sharedBy || issue.user?.login || 'GitHub Reader',
      sharedAt: raw.sharedAt || issue.created_at || new Date().toISOString(),
      sourceUrl: issue.html_url || raw.sourceUrl
    });
  } catch {
    return null;
  }
}

function listPoolStories({ cached = [] } = {}) {
  const merged = new Map();
  for (const item of SEED_STORIES) {
    try {
      const valid = validatePoolStory(item);
      merged.set(valid.poolId, valid);
    } catch {
      // Ignore malformed seed entries
    }
  }
  if (Array.isArray(cached)) {
    for (const item of cached) {
      try {
        const valid = validatePoolStory(item);
        merged.set(valid.poolId, valid);
      } catch {
        // Ignore malformed cache entries
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
}

async function fetchJsonWithTimeout(url, options = {}, fetchImpl = global.fetch, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemotePool({ repo = DEFAULT_REPO, cached = [], fetchImpl = global.fetch } = {}) {
  const current = listPoolStories({ cached });
  const byId = new Map(current.map(s => [s.poolId, s]));
  let online = false;

  if (typeof fetchImpl === 'function') {
    try {
      const indexData = await fetchJsonWithTimeout(
        `https://raw.githubusercontent.com/${repo}/main/community-pool/index.json`,
        { headers: { Accept: 'application/json' } },
        fetchImpl
      );
      online = true;
      const items = Array.isArray(indexData?.stories) ? indexData.stories : [];
      for (const item of items.slice(0, 40)) {
        if (item && Array.isArray(item.chapters) && item.chapters.length) {
          try {
            const valid = validatePoolStory(item);
            byId.set(valid.poolId, valid);
          } catch {}
        } else if (item?.poolId && !byId.has(item.poolId) && /^[a-z0-9][a-z0-9._-]{2,80}$/i.test(item.poolId)) {
          try {
            const fullStory = await fetchJsonWithTimeout(
              `https://raw.githubusercontent.com/${repo}/main/community-pool/stories/${item.poolId}.json`,
              { headers: { Accept: 'application/json' } },
              fetchImpl
            );
            const valid = validatePoolStory(fullStory);
            byId.set(valid.poolId, valid);
          } catch {}
        }
      }
    } catch {
      // Continue to GitHub Issues fallback
    }

    try {
      const issues = await fetchJsonWithTimeout(
        `https://api.github.com/repos/${repo}/issues?state=open&per_page=30`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Leaflight-Story-Pool'
          }
        },
        fetchImpl
      );
      online = true;
      if (Array.isArray(issues)) {
        for (const issue of issues) {
          if (issue?.pull_request) continue;
          const hasLabel = Array.isArray(issue?.labels) && issue.labels.some(l => ['story-pool', 'community-story'].includes(typeof l === 'string' ? l : l?.name));
          const hasTitlePrefix = typeof issue?.title === 'string' && issue.title.includes('[Story Pool]');
          const hasFence = typeof issue?.body === 'string' && /```leaflight-story/i.test(issue.body);
          if (!hasLabel && !hasTitlePrefix && !hasFence) continue;
          const extracted = extractStoryFromIssue(issue);
          if (extracted) byId.set(extracted.poolId, extracted);
        }
      }
    } catch {
      // Offline or rate-limited; keep local + seed stories
    }
  }

  const stories = [...byId.values()].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  return {
    stories,
    online,
    syncedAt: new Date().toISOString()
  };
}

async function publishToGitHub(book, { sharedBy, note, token, repo = DEFAULT_REPO, fetchImpl = global.fetch } = {}) {
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    throw Error('请先填写 GitHub Token，或使用「免 Token 浏览器投稿」。');
  }
  const { story, issueTitle, issueBody } = sanitizeForPool(book, { sharedBy, note, repo });
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cleanToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Leaflight-Story-Pool',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const endpoint = `https://api.github.com/repos/${repo}/issues`;

  let res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: issueTitle, body: issueBody, labels: ['story-pool'] })
  });

  if (res.status === 403 || res.status === 422) {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: issueTitle, body: issueBody })
    });
  }

  if (!res.ok) {
    if (res.status === 401) throw Error('GitHub Token 无效或已过期，请检查权限（需具备 public_repo 或 Issues 写入权限）。');
    if (res.status === 403 || res.status === 429) throw Error('GitHub 接口请求受限或 Token 缺少 Issues 写入权限。');
    throw Error(`上传至 GitHub 公共书池失败（HTTP ${res.status}）。`);
  }

  const data = await res.json();
  return {
    url: data.html_url || `https://github.com/${repo}/issues`,
    number: data.number || 0,
    story: { ...story, ...(data.html_url ? { sourceUrl: data.html_url } : {}) }
  };
}

module.exports = {
  DEFAULT_REPO,
  SEED_STORIES,
  computePoolId,
  validatePoolStory,
  formatIssueBody,
  sanitizeForPool,
  poolStoryToBook,
  extractStoryFromIssue,
  listPoolStories,
  fetchRemotePool,
  publishToGitHub
};
