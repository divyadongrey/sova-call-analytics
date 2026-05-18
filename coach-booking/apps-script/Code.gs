// ═══════════════════════════════════════════════════════════════════════════
//  Coach Booking Platform — Apps Script Backend
//
//  SETUP (one-time, ~5 minutes):
//  1. Open your Google Sheet → Extensions → Apps Script
//  2. Paste this entire file, replacing any existing code
//  3. Click Deploy → New Deployment → Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  4. Click Deploy → copy the Web App URL
//  5. Paste the URL into your .env.local as APPS_SCRIPT_URL
//
//  No Google Cloud project. No service account. No API keys.
// ═══════════════════════════════════════════════════════════════════════════

const SHEETS = {
  COACHES:      'Coaches',
  BOOKINGS:     'Bookings',
  BLOCKED:      'BlockedSlots',
  AUTH:         'CoachAuth',
  INVITES:      'Invites',
};

const ALL_SLOTS = [
  '11:00 AM – 12:00 PM',
  '12:00 PM – 1:00 PM',
  '1:00 PM – 2:00 PM',
  '2:00 PM – 3:00 PM',
  '3:00 PM – 4:00 PM',
  '4:00 PM – 5:00 PM',
];

// ─── GET: read operations ─────────────────────────────────────────────────────

function doGet(e) {
  try {
    const action = e.parameter.action || '';

    if (action === 'ping')            return ok({ status: 'connected' });
    if (action === 'getCoaches')      return getCoaches(e.parameter);
    if (action === 'getSlots')        return getSlots(e.parameter);
    if (action === 'getBookings')     return requireToken(e, getBookings);
    if (action === 'getCoachAuth')    return requireToken(e, getCoachAuth);
    if (action === 'validateInvite')  return validateInvite(e.parameter);

    return err('Unknown action: ' + action);
  } catch (ex) {
    return err(ex.message);
  }
}

// ─── POST: write operations ───────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || '';

    if (action === 'createBooking')       return createBooking(body);
    if (action === 'updateBookingStatus') return requireTokenBody(body, updateBookingStatus);
    if (action === 'blockSlot')           return requireTokenBody(body, blockSlot);
    if (action === 'unblockSlot')         return requireTokenBody(body, unblockSlot);
    if (action === 'generateInvite')      return requireTokenBody(body, generateInvite);
    if (action === 'consumeInvite')       return consumeInvite(body);

    return err('Unknown action: ' + action);
  } catch (ex) {
    return err(ex.message);
  }
}

// ─── Token guard ──────────────────────────────────────────────────────────────
// Store your secret in: Project Settings → Script Properties → BOOKING_SECRET

function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('BOOKING_SECRET') || 'change-me-in-script-properties';
}

function requireToken(e, fn) {
  if (e.parameter.token !== getSecret()) return err('Unauthorized');
  return fn(e.parameter);
}

function requireTokenBody(body, fn) {
  if (body.token !== getSecret()) return err('Unauthorized');
  return fn(body);
}

// ─── Coaches ──────────────────────────────────────────────────────────────────

function getCoaches(params) {
  const sheet = getSheet(SHEETS.COACHES);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length < 2) return ok({ coaches: [] });

  const language = (params.language || '').toLowerCase();
  let coaches = rows.slice(1)
    .filter(r => r[0] && String(r[8]).toLowerCase() === 'true')
    .map(r => ({
      id:             String(r[0]),
      name:           String(r[1]),
      email:          String(r[2]),
      languages:      String(r[3]).split(',').map(l => l.trim()).filter(Boolean),
      specialization: String(r[4]),
      bio:            String(r[5]),
      imageUrl:       String(r[6]),
    }));

  if (language) {
    coaches = coaches.filter(c => c.languages.some(l => l.toLowerCase() === language));
  }
  return ok({ coaches });
}

// ─── Slots ────────────────────────────────────────────────────────────────────

function getSlots(params) {
  const { coachId, date } = params;
  if (!coachId || !date) return err('coachId and date required');

  // Booked slots
  const bookings = getBookingRows();
  const booked = new Set(
    bookings
      .filter(b => b[5] === coachId && b[7] === date && b[9] !== 'cancelled')
      .map(b => b[8])
  );

  // Blocked slots
  const blocked = getBlockedRows();
  const blockedSet = new Set(
    blocked.filter(b => b[0] === coachId && b[1] === date).map(b => b[2])
  );

  const slots = ALL_SLOTS.map(label => ({
    label,
    available: !booked.has(label) && !blockedSet.has(label),
  }));

  return ok({ slots, date });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

function getBookings(params) {
  const { coachId, date, role } = params;
  let rows = getBookingRows();

  if (date)    rows = rows.filter(r => r[7] === date);
  if (coachId && role !== 'admin') rows = rows.filter(r => r[5] === coachId);

  const bookings = rows.map(r => ({
    id:               r[0],  customerName:      r[1],
    customerEmail:    r[2],  customerPhone:     r[3],
    preferredLanguage:r[4],  coachId:           r[5],
    coachName:        r[6],  date:              r[7],
    slot:             r[8],  status:            r[9],
    timestamp:        r[10], confirmationId:    r[11],
    calendarEventId:  r[12], notes:             r[13],
  }));

  return ok({ bookings });
}

function createBooking(body) {
  const { customerName, customerEmail, customerPhone, preferredLanguage, coachId, coachName, slot, date, confirmationId } = body;

  if (!customerName || !customerEmail || !coachId || !slot || !date) {
    return err('Missing required fields');
  }

  // Double-booking check
  const rows = getBookingRows();
  const conflict = rows.some(r => r[5] === coachId && r[7] === date && r[8] === slot && r[9] !== 'cancelled');
  if (conflict) return err('Slot already booked');

  // Blocked check
  const blocked = getBlockedRows();
  if (blocked.some(b => b[0] === coachId && b[1] === date && b[2] === slot)) {
    return err('Slot is blocked');
  }

  const id = 'BK-' + Date.now();
  const sheet = getSheet(SHEETS.BOOKINGS);
  sheet.appendRow([
    id, customerName, customerEmail, customerPhone, preferredLanguage,
    coachId, coachName, date, slot, 'confirmed',
    new Date().toISOString(), confirmationId, '', '',
  ]);

  return ok({ id, confirmationId });
}

function updateBookingStatus(body) {
  const { bookingId, status } = body;
  const sheet = getSheet(SHEETS.BOOKINGS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === bookingId) {
      sheet.getRange(i + 1, 10).setValue(status);
      return ok({ updated: bookingId });
    }
  }
  return err('Booking not found');
}

// ─── Blocked Slots ────────────────────────────────────────────────────────────

function blockSlot(body) {
  const { coachId, date, slot, blockedBy } = body;
  if (!coachId || !date || !slot) return err('Missing fields');
  getSheet(SHEETS.BLOCKED).appendRow([coachId, date, slot, blockedBy || '', new Date().toISOString()]);
  return ok({ blocked: slot });
}

function unblockSlot(body) {
  const { coachId, date, slot } = body;
  const sheet = getSheet(SHEETS.BLOCKED);
  const rows  = sheet.getDataRange().getValues();

  // Delete matching rows in reverse order
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === coachId && rows[i][1] === date && rows[i][2] === slot) {
      sheet.deleteRow(i + 1);
    }
  }
  return ok({ unblocked: slot });
}

// ─── Coach Auth ───────────────────────────────────────────────────────────────

function getCoachAuth(params) {
  const email = (params.email || '').toLowerCase();
  if (!email) return err('Missing email');

  const sheet = getSheet(SHEETS.AUTH);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === email) {
      return ok({
        coachId:      rows[i][0],
        email:        rows[i][1],
        passwordHash: rows[i][2],
        role:         rows[i][3] || 'coach',
        name:         rows[i][4] || '',
      });
    }
  }
  return err('Coach not found');
}

// ─── Invite Links ─────────────────────────────────────────────────────────────
// Invites sheet columns: token | coachId | email | role | name | used | expiresAt | createdAt

function generateInvite(body) {
  const { coachId, email, role, name } = body;
  if (!coachId || !email) return err('coachId and email required');

  const token     = Utilities.getUuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const createdAt = new Date().toISOString();

  getSheet(SHEETS.INVITES).appendRow([token, coachId, email, role || 'coach', name || '', 'false', expiresAt, createdAt]);
  return ok({ token, expiresAt });
}

function validateInvite(params) {
  const { token } = params;
  if (!token) return err('Token required');

  const sheet = getSheet(SHEETS.INVITES);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === token) {
      if (rows[i][5] === 'true') return err('Invite already used');
      if (new Date(rows[i][6]) < new Date()) return err('Invite expired');
      return ok({ coachId: rows[i][1], email: rows[i][2], role: rows[i][3], name: rows[i][4] });
    }
  }
  return err('Invalid invite token');
}

function consumeInvite(body) {
  const { token, passwordHash } = body;
  if (!token || !passwordHash) return err('Token and passwordHash required');

  const inviteSheet = getSheet(SHEETS.INVITES);
  const inviteRows  = inviteSheet.getDataRange().getValues();

  let inviteRow = null;
  let inviteIdx = -1;
  for (let i = 1; i < inviteRows.length; i++) {
    if (inviteRows[i][0] === token) {
      if (inviteRows[i][5] === 'true') return err('Invite already used');
      if (new Date(inviteRows[i][6]) < new Date()) return err('Invite expired');
      inviteRow = inviteRows[i];
      inviteIdx = i + 1;
      break;
    }
  }
  if (!inviteRow) return err('Invalid invite token');

  const coachId = inviteRow[1];
  const email   = inviteRow[2];
  const role    = inviteRow[3];
  const name    = inviteRow[4];

  // Upsert into CoachAuth
  const authSheet = getSheet(SHEETS.AUTH);
  const authRows  = authSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < authRows.length; i++) {
    if (String(authRows[i][1]).toLowerCase() === email.toLowerCase()) {
      authSheet.getRange(i + 1, 3).setValue(passwordHash);
      found = true;
      break;
    }
  }
  if (!found) {
    authSheet.appendRow([coachId, email, passwordHash, role, name]);
  }

  // Mark invite as used
  inviteSheet.getRange(inviteIdx, 6).setValue('true');
  return ok({ email });
}

// ─── Setup: create all sheets + headers ──────────────────────────────────────
// Run this function once from the Apps Script editor: Run → setupSheets

function setupSheets() {
  const defs = [
    {
      name: SHEETS.COACHES,
      headers: ['id','name','email','languages','specialization','bio','imageUrl','calendarId','isActive','role'],
      sample: [
        ['C001','Priya Sharma','priya@example.com','Hindi,English','Career Coaching','Certified career coach with 10+ years experience','https://i.pravatar.cc/150?img=47','','true','coach'],
        ['C002','Rajan Mehta','rajan@example.com','Gujarati,English','Life Coaching','Life coach specializing in work-life balance','https://i.pravatar.cc/150?img=12','','true','coach'],
        ['C003','Anita Rao','anita@example.com','Telugu,English,Hindi','Business Coaching','Business strategy and entrepreneurship coach','https://i.pravatar.cc/150?img=32','','true','coach'],
      ],
    },
    {
      name: SHEETS.BOOKINGS,
      headers: ['id','customerName','customerEmail','customerPhone','preferredLanguage','coachId','coachName','date','slot','status','timestamp','confirmationId','calendarEventId','notes'],
    },
    {
      name: SHEETS.BLOCKED,
      headers: ['coachId','date','slot','blockedBy','timestamp'],
    },
    {
      name: SHEETS.AUTH,
      headers: ['coachId','email','passwordHash','role','name'],
      note: 'Populated automatically when coaches accept their invite link',
    },
    {
      name: SHEETS.INVITES,
      headers: ['token','coachId','email','role','name','used','expiresAt','createdAt'],
    },
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  defs.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      Logger.log('Created sheet: ' + def.name);
    }
    const existing = sheet.getLastRow();
    if (existing === 0) {
      const rows = [def.headers];
      if (def.sample) rows.push(...def.sample);
      sheet.getRange(1, 1, rows.length, def.headers.length).setValues(rows);
      // Bold the header row
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
      Logger.log('Added headers to: ' + def.name);
    }
  });

  // Set the secret token in Script Properties
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('BOOKING_SECRET')) {
    const token = Utilities.getUuid();
    props.setProperty('BOOKING_SECRET', token);
    Logger.log('Generated BOOKING_SECRET: ' + token);
    Logger.log('Add this to your .env.local as APPS_SCRIPT_SECRET=' + token);
  } else {
    Logger.log('BOOKING_SECRET already set: ' + props.getProperty('BOOKING_SECRET'));
  }

  Logger.log('Setup complete! Check the Execution log for your secret token.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getBookingRows() {
  const sheet = getSheet(SHEETS.BOOKINGS);
  const rows  = sheet.getDataRange().getValues();
  return rows.length < 2 ? [] : rows.slice(1).filter(r => r[0]);
}

function getBlockedRows() {
  const sheet = getSheet(SHEETS.BLOCKED);
  const rows  = sheet.getDataRange().getValues();
  return rows.length < 2 ? [] : rows.slice(1).filter(r => r[0]);
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
