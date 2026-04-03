// api.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared config + Google Sheets API helpers (via Apps Script)
// Replaces firebase-api.js — completely free, no database needed
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️  Paste your deployed Apps Script URL here (see README for instructions)
export const SCRIPT_URL = 'https://script.google.com/a/macros/sova.health/s/AKfycbz9EV9oQMrYI8Qw3AaJoHzgpKgsBSUzlgmz8dP_vV24WPYVZQ4AaIqAIrhJYBF6MWBX/exec';

export const ADMIN_PASSWORD = 'sovahealth@123';

export const TEAMS = [
  { id: 'expert_consult', name: 'Expert Consult', color: '#10b981', emoji: '🧬' },
  { id: 'coaches',        name: 'Coaches',         color: '#6366f1', emoji: '🎯' },
  { id: 'gmt_calls',      name: 'GMT Calls',       color: '#f59e0b', emoji: '📞' },
];

// Default team configs — admin can override via the admin panel
export const DEFAULT_CONFIGS = {
  expert_consult: {
    meetingType: 'Expert Consultation',
    rubric: `The expert should listen actively and ask diagnostic questions before giving any advice. Understand the patient's specific gut health symptoms, lifestyle, and goals. Clearly explain the Gut Microbiome Test value and link it to the patient's situation. Handle concerns with empathy. Speak less than 35% of the time. Always end with a specific next step — booking a test, follow-up call, or sending resources.`,
    keywords: 'symptoms, gut health, microbiome, test, results, diet, digestion, bloating, energy, immunity, inflammation, probiotic, personalised',
    redFlags: 'not sure, expensive, think about it, maybe later, just browsing, not interested, already tried, will see',
    scorecardDimensions: 'Diagnostic questioning (0-3), Empathy & rapport (0-2), Product explanation clarity (0-2), Objection handling (0-2), Next step closure (0-1)',
  },
  coaches: {
    meetingType: 'Coaching / 1:1',
    rubric: `Coach should help the coachee identify blockers and develop their own solutions — avoid prescribing answers. Use open-ended questions exclusively in the first half of the call. Coach should speak less than 30% of the time. Agree on specific, measurable action items with deadlines. Leave the coachee feeling accountable, motivated, and clear on what to do next.`,
    keywords: 'goal, blocker, action, by when, accountability, progress, challenge, support, commitment, next step, deadline, plan',
    redFlags: 'not sure, no time, too busy, not my responsibility, will try, hopefully, maybe',
    scorecardDimensions: 'Open questioning (0-2), Active listening (0-2), Action item clarity (0-2), Accountability framing (0-2), Coachee motivation (0-2)',
  },
  gmt_calls: {
    meetingType: 'GMT Sales Call',
    rubric: `Rep should uncover the prospect's gut health pain points in the first 5 minutes — never pitch before understanding the problem. Clearly link the GMT to their specific symptoms using their own words. Handle price objections by emphasising personalised insights and long-term health ROI. Never pitch for more than 2 minutes straight. Always close with a specific next step and a confirmed date/time. Rep should speak less than 40% of the time.`,
    keywords: 'test, results, symptoms, price, discount, buy, book, schedule, gut health, microbiome, personalised, doctor, diagnosis',
    redFlags: 'too expensive, not interested, already tried, no time, call later, think about it, send email, busy, already have',
    scorecardDimensions: 'Pain discovery (0-3), GMT explanation (0-2), Objection handling (0-2), Talk ratio (0-2), Clear close (0-1)',
  },
};

// ─── API helpers (send messages to background.js which proxies to Apps Script)
// Background service worker bypasses CORS — all sheet calls go through it.

export async function apiGet(action, params = {}) {
  return chrome.runtime.sendMessage({ type: 'SHEETS_REQUEST', action, params });
}

// Convenience wrappers matching the old firebase-api interface
export async function getConfig() {
  const res = await apiGet('getConfig');
  return res?.config || {};
}

export async function setConfigKey(key, value) {
  return apiGet('setConfig', { key, value });
}

export async function getUsers() {
  const res = await apiGet('getUsers');
  return res?.users || [];
}

export async function registerUser({ email, name, team, teamName, joinedAt }) {
  return apiGet('registerUser', { email, name, team, teamName, joinedAt });
}
