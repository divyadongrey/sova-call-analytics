// background.js — Meet Coach v3
// Handles: Claude API calls + Google Sheets proxy (CORS-free)

import { SCRIPT_URL, DEFAULT_CONFIGS } from './api.js';

// ─── First Install → Open Onboarding ─────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'SHEETS_REQUEST') {
    proxyToSheets(msg.action, msg.params || {})
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'ANALYZE_TRANSCRIPT') {
    handleAnalyze(msg.payload).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'GENERATE_REPORT') {
    handleReport(msg.payload).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'OPEN_ONBOARDING') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }

  if (msg.type === 'OPEN_ADMIN') {
    chrome.tabs.create({ url: chrome.runtime.getURL('admin.html') });
  }
});

// ─── Google Sheets Proxy ──────────────────────────────────────────────────────
// Service worker has no CORS restrictions — all sheet calls route through here

async function proxyToSheets(action, params) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheets request failed: ${res.status}`);
  return res.json();
}

// ─── Config Cache ─────────────────────────────────────────────────────────────
let _cache = null;
let _cacheTs = 0;
const CACHE_MS = 5 * 60 * 1000;

async function getSheetConfig() {
  if (_cache && Date.now() - _cacheTs < CACHE_MS) return _cache;
  try {
    const result = await proxyToSheets('getConfig', {});
    _cache = result?.config || {};
    _cacheTs = Date.now();
  } catch (e) {
    console.warn('[MeetCoach] Config fetch failed, using cache/defaults:', e.message);
    _cache = _cache || {};
  }
  return _cache;
}

async function getTeamConfig(teamId) {
  const flat = await getSheetConfig();
  const defaults = DEFAULT_CONFIGS[teamId] || DEFAULT_CONFIGS.gmt_calls;

  // Sheet keys are like: "expert_consult_rubric", "expert_consult_keywords", etc.
  const p = teamId + '_';
  return {
    apiKey:              flat['apiKey']               || '',
    meetingType:         flat[p + 'meetingType']      || defaults.meetingType,
    rubric:              flat[p + 'rubric']            || defaults.rubric,
    keywords:            flat[p + 'keywords']         || defaults.keywords,
    redFlags:            flat[p + 'redFlags']         || defaults.redFlags,
    scorecardDimensions: flat[p + 'scorecardDimensions'] || defaults.scorecardDimensions,
  };
}

// ─── Claude API ───────────────────────────────────────────────────────────────
async function callClaude(prompt, apiKey, maxTokens = 1000) {
  if (!apiKey) throw new Error('API key not set — admin needs to configure it in the Admin Panel');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Claude API error ${res.status}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text || '';
  return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
}

// ─── Live Analysis ────────────────────────────────────────────────────────────
async function handleAnalyze({ transcript, speakerStats, team }) {
  const cfg = await getTeamConfig(team || 'gmt_calls');

  const prompt = `You are an expert ${cfg.meetingType} coach at Sova Health (India's gut health company). Analyze this call transcript and return ONLY raw JSON — no markdown, no preamble.

TEAM: ${team}
MEETING TYPE: ${cfg.meetingType}

SCORING RUBRIC:
${cfg.rubric}

SCORECARD DIMENSIONS:
${cfg.scorecardDimensions}

KEYWORDS TO TRACK: ${cfg.keywords}
RED FLAGS TO WATCH: ${cfg.redFlags}

SPEAKER STATS:
${JSON.stringify(speakerStats, null, 2)}

RECENT TRANSCRIPT (last ~2 min):
${transcript || '(No transcript yet — ensure captions are enabled in Meet)'}

LANGUAGE DETECTION: Sova calls are often in Hindi, English, or Hinglish (Hindi-English mix). Detect which, estimate the split. All feedback must be in English.

Return ONLY this exact JSON:
{
  "score": <integer 1–10>,
  "scoreReason": "<one sentence>",
  "scorecardBreakdown": "<score per dimension>",
  "talkRatioFeedback": "<one sentence on speaking balance>",
  "language": "<English|Hindi|Hinglish>",
  "languageBreakdown": "<e.g. ~60% Hindi, ~40% English>",
  "languageNote": "<one coaching sentence on language use>",
  "keywordsSpotted": ["<keyword>"],
  "redFlagsSpotted": ["<flag>"],
  "topInsight": "<single most important observation right now>",
  "suggestion": "<one specific action for next 2 minutes>"
}`;

  return callClaude(prompt, cfg.apiKey, 1000);
}

// ─── Post-Call Report ─────────────────────────────────────────────────────────
async function handleReport({ transcript, speakerStats, team, duration }) {
  const cfg  = await getTeamConfig(team || 'gmt_calls');
  const mins = Math.round((duration || 0) / 60000);

  const prompt = `You are an expert ${cfg.meetingType} coach at Sova Health. Generate a comprehensive post-call report. Return ONLY raw JSON — no markdown, no preamble.

TEAM: ${team}
MEETING TYPE: ${cfg.meetingType}
DURATION: ${mins} minutes

SCORING RUBRIC:
${cfg.rubric}

SCORECARD DIMENSIONS:
${cfg.scorecardDimensions}

KEYWORDS: ${cfg.keywords}
RED FLAGS: ${cfg.redFlags}

SPEAKER STATS:
${JSON.stringify(speakerStats, null, 2)}

FULL TRANSCRIPT:
${transcript || '(No transcript captured)'}

LANGUAGE: Detect if English / Hindi / Hinglish. All report content in English.

Return ONLY this exact JSON:
{
  "overallScore": <1–10>,
  "grade": "<A+|A|B|C|D|F>",
  "scorecardBreakdown": "<score per dimension>",
  "language": "<English|Hindi|Hinglish>",
  "languageBreakdown": "<split estimate>",
  "languageNote": "<coaching note on language use>",
  "summary": "<2–3 sentence call summary>",
  "strengths": ["<s1>", "<s2>", "<s3>"],
  "improvements": ["<i1>", "<i2>", "<i3>"],
  "keyMoments": [
    { "time": "<MM:SS>", "type": "positive|negative", "note": "<what happened>" }
  ],
  "nextSteps": ["<action1>", "<action2>"],
  "coachingNotes": "<detailed coaching paragraph — specific, actionable, empathetic>"
}`;

  return callClaude(prompt, cfg.apiKey, 2000);
}
