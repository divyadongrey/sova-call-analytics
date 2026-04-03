// popup.js

async function init() {
  const local = await chrome.storage.local.get(['setupComplete', 'userName', 'userEmail', 'userTeam', 'teamName', 'teamEmoji']);

  if (!local.setupComplete) {
    document.getElementById('user-state').style.display = 'none';
    document.getElementById('no-setup').style.display = 'block';
    return;
  }

  document.getElementById('user-name').textContent  = local.userName  || '—';
  document.getElementById('user-email').textContent = local.userEmail || '—';
  document.getElementById('team-emoji').textContent = local.teamEmoji || '🎯';

  const pill = document.getElementById('team-pill');
  pill.textContent = local.teamName || local.userTeam || '—';
  pill.className = `team-pill pill-${local.userTeam || 'unknown'}`;
}

window.openMeet       = () => chrome.tabs.create({ url: 'https://meet.google.com' });
window.openAdmin      = () => chrome.runtime.sendMessage({ type: 'OPEN_ADMIN' });
window.openOnboarding = () => chrome.runtime.sendMessage({ type: 'OPEN_ONBOARDING' });

window.reOnboard = async () => {
  if (confirm('This will reset your team selection. Continue?')) {
    await chrome.storage.local.remove(['setupComplete', 'userTeam', 'teamName', 'teamEmoji']);
    chrome.runtime.sendMessage({ type: 'OPEN_ONBOARDING' });
    window.close();
  }
};

init();
