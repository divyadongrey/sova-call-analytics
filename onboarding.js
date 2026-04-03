// onboarding.js v3
import { TEAMS, registerUser } from './api.js';

let selectedTeam = null;

function show(id) { document.getElementById(id).classList.add('active'); }
function hide(id) { document.getElementById(id).classList.remove('active'); }

window.goStep2 = function () {
  const name  = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const errEl = document.getElementById('email-error');

  if (!name) { errEl.textContent = 'Please enter your name'; errEl.style.display = 'block'; return; }
  if (!email || !email.includes('@')) {
    errEl.textContent = 'Please enter a valid work email';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  hide('step-1');
  show('step-2');
};

window.goStep1 = function () {
  hide('step-2');
  show('step-1');
};

window.selectTeam = function (card) {
  document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedTeam = card.dataset.team;
  document.getElementById('team-error').style.display = 'none';
};

window.completeSetup = async function () {
  if (!selectedTeam) {
    document.getElementById('team-error').style.display = 'block';
    return;
  }

  const name    = document.getElementById('user-name').value.trim();
  const email   = document.getElementById('user-email').value.trim();
  const btn     = document.getElementById('step2-btn');
  const loadEl  = document.getElementById('loading');
  const teamMeta = TEAMS.find(t => t.id === selectedTeam);

  btn.disabled = true;
  loadEl.style.display = 'block';

  // Save to Google Sheet (fire and forget — don't block on failure)
  registerUser({
    email,
    name,
    team: selectedTeam,
    teamName: teamMeta?.name || selectedTeam,
    joinedAt: Date.now(),
  }).catch(e => console.warn('[MeetCoach] Sheet registration failed:', e.message));

  // Save locally — this is what the extension reads
  await chrome.storage.local.set({
    setupComplete: true,
    userName:  name,
    userEmail: email,
    userTeam:  selectedTeam,
    teamName:  teamMeta?.name  || selectedTeam,
    teamEmoji: teamMeta?.emoji || '🎯',
  });

  btn.disabled = false;
  loadEl.style.display = 'none';
  hide('step-2');
  show('step-3');
};

window.openMeet = function () {
  chrome.tabs.create({ url: 'https://meet.google.com' });
};
