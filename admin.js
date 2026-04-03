// admin.js v3
import { ADMIN_PASSWORD, DEFAULT_CONFIGS, TEAMS, getConfig, setConfigKey, getUsers } from './api.js';

let currentTeam = 'expert_consult';

// ─── Auth ─────────────────────────────────────────────────────────────────────
window.login = function () {
  const pw    = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');

  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('mc_admin', '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-shell').style.display  = 'block';
    loadAll();
  } else {
    errEl.textContent = 'Incorrect password. Try again.';
    document.getElementById('login-pw').value = '';
  }
};

window.logout = function () {
  sessionStorage.removeItem('mc_admin');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-shell').style.display  = 'none';
  document.getElementById('login-pw').value = '';
};

// Restore session if already logged in this browser tab
if (sessionStorage.getItem('mc_admin')) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-shell').style.display  = 'block';
  loadAll();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
window.showTab = function (tabId, navEl) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  navEl.classList.add('active');
  if (tabId === 'users')  loadUsers();
  if (tabId === 'teams')  loadTeamForm(currentTeam);
};

// ─── Load All ─────────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadApiKey(), loadTeamForm(currentTeam)]);
}

// ─── API Key ──────────────────────────────────────────────────────────────────
async function loadApiKey() {
  try {
    const config = await getConfig();
    if (config.apiKey) document.getElementById('api-key-input').value = config.apiKey;
  } catch (e) { console.warn('Load API key failed:', e.message); }
}

window.saveApiKey = async function () {
  const key = document.getElementById('api-key-input').value.trim();
  const ok  = document.getElementById('api-key-ok');
  try {
    await setConfigKey('apiKey', key);
    flash(ok, '✅ Saved to Google Sheet!');
  } catch (e) { flash(ok, '❌ ' + e.message, true); }
};

window.toggleApiKey = function () {
  const inp = document.getElementById('api-key-input');
  const btn = document.querySelector('.key-show');
  const hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  btn.textContent = hidden ? 'Hide' : 'Show';
};

// ─── Team Config ──────────────────────────────────────────────────────────────
window.switchTeamTab = function (teamId, btn) {
  currentTeam = teamId;
  document.querySelectorAll('.team-tab').forEach(t => {
    t.classList.remove('active-ec', 'active-co', 'active-gmt');
  });
  const styleMap = { expert_consult: 'active-ec', coaches: 'active-co', gmt_calls: 'active-gmt' };
  btn.classList.add(styleMap[teamId]);
  loadTeamForm(teamId);
};

async function loadTeamForm(teamId) {
  const team = TEAMS.find(t => t.id === teamId);
  document.getElementById('team-form-title').textContent = `${team?.emoji || ''} ${team?.name || teamId}`;

  const defaults = DEFAULT_CONFIGS[teamId] || {};
  let remote = {};

  try {
    const config = await getConfig();
    const p = teamId + '_';
    remote = {
      meetingType:         config[p + 'meetingType'],
      rubric:              config[p + 'rubric'],
      scorecardDimensions: config[p + 'scorecardDimensions'],
      keywords:            config[p + 'keywords'],
      redFlags:            config[p + 'redFlags'],
    };
  } catch (e) { console.warn('Load team config failed:', e.message); }

  setValue('tf-meeting-type', remote.meetingType         || defaults.meetingType);
  setValue('tf-rubric',       remote.rubric              || defaults.rubric);
  setValue('tf-scorecard',    remote.scorecardDimensions || defaults.scorecardDimensions);
  setValue('tf-keywords',     remote.keywords            || defaults.keywords);
  setValue('tf-redflags',     remote.redFlags            || defaults.redFlags);
}

window.saveTeamConfig = async function () {
  const ok = document.getElementById('team-config-ok');
  const p  = currentTeam + '_';

  const entries = [
    [p + 'meetingType',         getValue('tf-meeting-type')],
    [p + 'rubric',              getValue('tf-rubric')],
    [p + 'scorecardDimensions', getValue('tf-scorecard')],
    [p + 'keywords',            getValue('tf-keywords')],
    [p + 'redFlags',            getValue('tf-redflags')],
  ];

  try {
    // Save each key sequentially (Apps Script handles them one at a time)
    for (const [key, value] of entries) {
      await setConfigKey(key, value);
    }
    flash(ok, '✅ Saved to Google Sheet!');
  } catch (e) { flash(ok, '❌ ' + e.message, true); }
};

window.resetTeamDefaults = function () {
  if (!confirm(`Reset ${currentTeam} to default config? Your customisations will be lost.`)) return;
  const d = DEFAULT_CONFIGS[currentTeam] || {};
  setValue('tf-meeting-type', d.meetingType);
  setValue('tf-rubric',       d.rubric);
  setValue('tf-scorecard',    d.scorecardDimensions);
  setValue('tf-keywords',     d.keywords);
  setValue('tf-redflags',     d.redFlags);
  const ok = document.getElementById('team-config-ok');
  ok.textContent = '↩ Reset to defaults (click Save to apply)';
  setTimeout(() => ok.textContent = '', 3500);
};

// ─── Users ────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const container = document.getElementById('users-content');
  container.innerHTML = '<div class="no-data">Loading users from Google Sheet...</div>';

  try {
    const users = await getUsers();

    if (!users.length) {
      container.innerHTML = '<div class="no-data">No users registered yet. They appear here after completing onboarding.</div>';
      return;
    }

    container.innerHTML = `
      <table class="users-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Team</th><th>Joined</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="color:#e2e8f0;font-weight:600">${u.name || '—'}</td>
              <td>${u.email || '—'}</td>
              <td><span class="team-pill pill-${u.team}">${u.teamName || u.team || '—'}</span></td>
              <td>${u.joinedAt || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="font-size:11px;color:#334155;padding:12px 12px 0">${users.length} user${users.length !== 1 ? 's' : ''} registered</div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="no-data">Failed to load users: ${e.message}</div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getValue(id) { return document.getElementById(id)?.value?.trim() || ''; }
function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function flash(el, msg, isErr = false) {
  el.textContent = msg;
  el.style.color = isErr ? '#ef4444' : '#10b981';
  setTimeout(() => el.textContent = '', 3500);
}
