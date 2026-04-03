// ═══════════════════════════════════════════════════════════════
//  Code.gs — Sova Meet Coach backend
//  Paste this entire file into script.google.com
//  Deploy as: Web app → Execute as: Me → Access: Anyone
// ═══════════════════════════════════════════════════════════════

const CONFIG_SHEET = 'config';
const USERS_SHEET  = 'users';

// ─── GET Handler (all operations use GET to avoid CORS issues) ───────────────

function doGet(e) {
  try {
    const action = e.parameter.action || '';

    if (action === 'getConfig')      return getConfig();
    if (action === 'getUsers')       return getUsers();
    if (action === 'setConfig')      return setConfig(e.parameter.key, e.parameter.value);
    if (action === 'registerUser')   return registerUser(e.parameter);
    if (action === 'ping')           return ok({ status: 'connected' });

    return err('Unknown action: ' + action);
  } catch (e) {
    return err(e.message);
  }
}

// ─── Read config sheet → { apiKey, expert_consult_rubric, ... } ──────────────

function getConfig() {
  const sheet = getOrCreateSheet(CONFIG_SHEET);
  const rows  = sheet.getDataRange().getValues();
  const config = {};
  rows.forEach(([key, value]) => { if (key) config[String(key)] = String(value); });
  return ok({ config });
}

// ─── Read users sheet → [{ email, name, team, teamName, joinedAt }, ...] ─────

function getUsers() {
  const sheet = getOrCreateSheet(USERS_SHEET);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length < 2) return ok({ users: [] });
  const headers = rows[0];
  const users = rows.slice(1)
    .filter(row => row[0]) // skip empty rows
    .map(row => {
      const u = {};
      headers.forEach((h, i) => { u[h] = row[i]; });
      return u;
    });
  return ok({ users });
}

// ─── Write a single key-value to config sheet ─────────────────────────────────

function setConfig(key, value) {
  if (!key) return err('Missing key');
  const sheet = getOrCreateSheet(CONFIG_SHEET);
  const rows  = sheet.getDataRange().getValues();

  // Update existing row
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return ok({ updated: key });
    }
  }
  // Or append new row
  sheet.appendRow([key, value]);
  return ok({ added: key });
}

// ─── Register / update a user in users sheet ─────────────────────────────────

function registerUser({ email, name, team, teamName, joinedAt }) {
  if (!email) return err('Missing email');
  const sheet = getOrCreateSheet(USERS_SHEET);
  const rows  = sheet.getDataRange().getValues();

  // Ensure header row exists
  if (rows.length === 0 || rows[0][0] !== 'email') {
    sheet.getRange(1, 1, 1, 5).setValues([['email', 'name', 'team', 'teamName', 'joinedAt']]);
  }

  // Check for existing user by email
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(email).toLowerCase()) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[email, name, team, teamName, joinedAt]]);
      return ok({ updated: email });
    }
  }

  // New user
  sheet.appendRow([email, name, team, teamName, new Date(Number(joinedAt)).toLocaleString('en-IN')]);
  return ok({ registered: email });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
