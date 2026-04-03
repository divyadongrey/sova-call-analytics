// content.js — Meet Coach
// Injected into every meet.google.com page
// Captures captions, tracks talk ratio, runs real-time coaching

(function () {
  'use strict';

  if (document.getElementById('meetcoach-panel')) return; // Prevent double-injection

  // ─── State ─────────────────────────────────────────────────────────────────
  const state = {
    transcript: [],
    speakerWords: {},
    speakerTurns: {},
    totalWords: 0,
    sessionStart: Date.now(),
    isAnalyzing: false,
    analysisTimer: null,
    captionsEnabled: false,
    callActive: false,
    keywordsSpotted: new Set(),
    redFlagsSpotted: new Set(),
    lastSeenText: '',
    panelVisible: true,
    // Team identity
    userTeam: 'gmt_calls',
    userName: '',
    teamName: '',
    teamEmoji: '🎯',
    setupComplete: false,
  };

  let settings = {};

  // ─── Boot ───────────────────────────────────────────────────────────────────
  async function boot() {
    settings = await chrome.storage.sync.get([
      'apiKey', 'myName', 'meetingType', 'scoringRubric', 'keywords', 'redFlags'
    ]);

    // Load team identity from local storage
    const local = await chrome.storage.local.get([
      'setupComplete', 'userTeam', 'userName', 'teamName', 'teamEmoji'
    ]);

    if (!local.setupComplete) {
      // Not set up — show a prompt instead of the full panel
      injectSetupPrompt();
      return;
    }

    state.setupComplete = true;
    state.userTeam  = local.userTeam  || 'gmt_calls';
    state.userName  = local.userName  || '';
    state.teamName  = local.teamName  || local.userTeam || '';
    state.teamEmoji = local.teamEmoji || '🎯';

    // Wait for Meet call UI to appear
    await waitFor(() => document.querySelector('button[aria-label*="Leave" i] , button[aria-label*="microphone" i]'), 15000);
    await sleep(1500); // Let UI settle

    injectPanel();
    observeCaptions();
    scheduleAnalysis();
    watchForCallEnd();
    state.callActive = true;
    startTimer();
  }

  // ─── Caption Observation ────────────────────────────────────────────────────
  function observeCaptions() {
    // Primary: MutationObserver watching all aria-live regions
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        handleMutation(mutation);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
    state.captionObserver = observer;

    // Fallback: periodic scan every 1.5s
    setInterval(scanForCaptions, 1500);

    updateStatus('Enable captions (CC) in Meet toolbar');
  }

  function handleMutation(mutation) {
    const target = mutation.target;
    const liveAncestor = getLiveAncestor(target);
    if (!liveAncestor) return;
    if (isUIChrome(liveAncestor)) return;

    const text = liveAncestor.textContent.trim();
    if (!text || text.length < 4 || text === state.lastSeenText) return;
    if (text.length > 600) return; // Probably UI dump

    processRawCaption(text, liveAncestor);
    state.lastSeenText = text;
  }

  function scanForCaptions() {
    const liveEls = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]');
    for (const el of liveEls) {
      if (isUIChrome(el)) continue;
      const text = el.textContent.trim();
      if (text && text.length >= 4 && text.length < 600 && text !== state.lastSeenText) {
        processRawCaption(text, el);
        state.lastSeenText = text;
      }
    }
  }

  function getLiveAncestor(el) {
    if (!el || !el.closest) return null;
    return el.closest('[aria-live]');
  }

  function isUIChrome(el) {
    if (!el) return true;
    if (el.querySelector('button, input, select')) return true;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.35) return true; // Top 35% = toolbar area
    if (rect.width > window.innerWidth * 0.8) return true;  // Full-width = not a caption
    return false;
  }

  // ─── Caption Parsing ────────────────────────────────────────────────────────
  function processRawCaption(raw, el) {
    let speaker = 'Speaker';
    let text = raw;

    // Pattern 1: "Name: text" (Meet's standard caption format)
    const colonMatch = raw.match(/^([A-Za-z][A-Za-z\s]{1,30}):\s+(.+)$/s);
    if (colonMatch) {
      speaker = colonMatch[1].trim();
      text = colonMatch[2].trim();
    } else {
      // Pattern 2: speaker in preceding sibling/child element
      const speakerEl = el.querySelector('[class*="name" i], [class*="speaker" i]') ||
                        el.previousElementSibling;
      if (speakerEl) {
        const sp = speakerEl.textContent.trim();
        if (sp && sp.length < 40 && sp !== raw) {
          speaker = sp;
          text = raw.replace(sp, '').replace(/^[:\s]+/, '').trim();
        }
      }
    }

    if (!text || text.length < 3) return;

    // De-duplicate partial captions (Meet often sends growing text for same utterance)
    const last = state.transcript[state.transcript.length - 1];
    if (last && last.speaker === speaker) {
      if (text.startsWith(last.text) || last.text.startsWith(text)) {
        last.text = text.length > last.text.length ? text : last.text;
        updateCaptionPreview(speaker, last.text);
        return;
      }
    }

    // New transcript entry
    const entry = { speaker, text, timestamp: Date.now(), timeLabel: elapsed() };
    state.transcript.push(entry);

    // Speaker stats
    const words = text.split(/\s+/).filter(Boolean).length;
    state.speakerWords[speaker] = (state.speakerWords[speaker] || 0) + words;
    state.speakerTurns[speaker] = (state.speakerTurns[speaker] || 0) + 1;
    state.totalWords += words;

    checkKeywords(text);
    updateTalkRatio();
    updateCaptionPreview(speaker, text);

    if (!state.captionsEnabled) {
      state.captionsEnabled = true;
      updateStatus('🟢 Capturing — analyzing shortly');
      // First analysis after 60s of data
      setTimeout(runAnalysis, 60000);
    }
  }

  // ─── Keyword Checking ───────────────────────────────────────────────────────
  function checkKeywords(text) {
    const lower = text.toLowerCase();
    const kws = (settings.keywords || 'budget,timeline,decision maker,pain point,challenge,goal,ROI,competitor,contract')
      .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const flags = (settings.redFlags || 'not interested,too expensive,already using,no budget,call me back,send an email')
      .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

    kws.forEach(kw => {
      if (kw && lower.includes(kw) && !state.keywordsSpotted.has(kw)) {
        state.keywordsSpotted.add(kw);
        addKeywordChip(kw, 'keyword');
        toast(`✅ Keyword: "${kw}"`, 'keyword');
      }
    });

    flags.forEach(flag => {
      if (flag && lower.includes(flag) && !state.redFlagsSpotted.has(flag)) {
        state.redFlagsSpotted.add(flag);
        addKeywordChip(flag, 'redflag');
        toast(`🚩 Red flag: "${flag}"`, 'redflag');
      }
    });
  }

  // ─── Panel Injection ────────────────────────────────────────────────────────
  function injectSetupPrompt() {
    const el = document.createElement('div');
    el.id = 'meetcoach-setup-prompt';
    el.style.cssText = 'position:fixed;top:76px;right:14px;width:240px;background:rgba(14,16,22,0.96);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;z-index:9998;box-shadow:0 12px 48px rgba(0,0,0,0.5);font-family:-apple-system,sans-serif;color:#e2e8f0;';
    el.innerHTML = `
      <div style="font-size:14px;font-weight:800;margin-bottom:6px">🎯 Meet Coach</div>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:14px;line-height:1.5">Complete your setup to start getting real-time coaching.</p>
      <button onclick="(()=>{chrome.runtime.sendMessage({type:'OPEN_ONBOARDING'})})()" style="all:unset;display:block;width:100%;box-sizing:border-box;text-align:center;padding:10px;background:linear-gradient(135deg,#10b981,#059669);border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Complete Setup →</button>
    `;
    document.body.appendChild(el);
  }

  function injectPanel() {
    const panel = document.createElement('div');
    panel.id = 'meetcoach-panel';
    const teamBadge = `<span id="mc-team-badge" class="mc-team-badge mc-team-${state.userTeam}">${state.teamEmoji} ${state.teamName}</span>`;
    panel.innerHTML = `
      <div id="mc-header">
        <span id="mc-logo">🎯 Meet Coach</span>
        <div id="mc-header-right">
          ${teamBadge}
          <span id="mc-timer">00:00</span>
          <button id="mc-toggle" title="Collapse">◀</button>
        </div>
      </div>

      <div id="mc-body">
        <div id="mc-status">Initializing...</div>

        <div class="mc-section">
          <div class="mc-label">LIVE SCORE</div>
          <div id="mc-score-row">
            <div id="mc-score-num">—</div>
            <div id="mc-score-reason">Waiting for data...</div>
          </div>
        </div>

        <div class="mc-section">
          <div class="mc-label">TALK RATIO</div>
          <div class="mc-ratio-row">
            <span class="mc-ratio-name" id="mc-name-you">You</span>
            <div class="mc-track"><div class="mc-fill mc-fill-you" id="mc-fill-you"></div></div>
            <span class="mc-ratio-pct" id="mc-pct-you">0%</span>
          </div>
          <div class="mc-ratio-row">
            <span class="mc-ratio-name" id="mc-name-them">Them</span>
            <div class="mc-track"><div class="mc-fill mc-fill-them" id="mc-fill-them"></div></div>
            <span class="mc-ratio-pct" id="mc-pct-them">0%</span>
          </div>
        </div>

        <div class="mc-section">
          <div class="mc-label">CALL LANGUAGE</div>
          <div id="mc-lang-row">
            <span id="mc-lang-badge" class="mc-lang-badge mc-lang-unknown">Detecting...</span>
            <span id="mc-lang-breakdown"></span>
          </div>
          <div id="mc-lang-note"></div>
        </div>

        <div class="mc-section">
          <div class="mc-label">KEYWORDS SPOTTED</div>
          <div id="mc-chips"><span class="mc-empty">None yet</span></div>
        </div>

        <div class="mc-section">
          <div class="mc-label">COACHING INSIGHT</div>
          <div id="mc-insight">Waiting for analysis...</div>
        </div>

        <div class="mc-section">
          <div class="mc-label">LIVE CAPTION</div>
          <div id="mc-caption">Waiting for speech...</div>
        </div>

        <button id="mc-report-btn" disabled>📋 Generate Full Report</button>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('mc-toggle').addEventListener('click', togglePanel);
    document.getElementById('mc-report-btn').addEventListener('click', generateReport);
  }

  function togglePanel() {
    const body = document.getElementById('mc-body');
    const btn = document.getElementById('mc-toggle');
    const panel = document.getElementById('meetcoach-panel');
    state.panelVisible = !state.panelVisible;
    body.style.display = state.panelVisible ? 'block' : 'none';
    btn.textContent = state.panelVisible ? '◀' : '▶';
    panel.style.width = state.panelVisible ? '280px' : '52px';
  }

  // ─── Panel Updaters ─────────────────────────────────────────────────────────
  function updateStatus(msg) { $('mc-status').textContent = msg; }

  function startTimer() {
    setInterval(() => {
      $('mc-timer').textContent = ms2time(Date.now() - state.sessionStart);
    }, 1000);
  }

  function updateTalkRatio() {
    if (!state.totalWords) return;
    const myName = (settings.myName || '').toLowerCase();
    const speakers = Object.entries(state.speakerWords).sort((a, b) => b[1] - a[1]);

    let youWords = 0, themWords = 0;
    let youName = 'You', themName = 'Them';

    const youEntry = myName
      ? speakers.find(([n]) => n.toLowerCase().includes(myName))
      : null;

    if (youEntry) {
      youWords = youEntry[1];
      themWords = state.totalWords - youWords;
      youName = youEntry[0].split(' ')[0];
      const them = speakers.find(([n]) => n !== youEntry[0]);
      if (them) themName = them[0].split(' ')[0];
    } else if (speakers.length) {
      youWords = speakers[0][1];
      themWords = state.totalWords - youWords;
      youName = speakers[0][0].split(' ')[0];
      if (speakers[1]) themName = speakers[1][0].split(' ')[0];
    }

    const youPct = Math.round((youWords / state.totalWords) * 100);
    const themPct = 100 - youPct;

    setText('mc-name-you', youName);
    setText('mc-name-them', themName);
    setText('mc-pct-you', `${youPct}%`);
    setText('mc-pct-them', `${themPct}%`);

    setWidth('mc-fill-you', youPct);
    setWidth('mc-fill-them', themPct);

    // Dynamic color: green = good listening, amber = borderline, red = talking too much
    const fill = $('mc-fill-you');
    if (fill) fill.style.background = youPct > 65 ? '#ef4444' : youPct > 50 ? '#f59e0b' : '#10b981';
  }

  function updateCaptionPreview(speaker, text) {
    const el = $('mc-caption');
    if (el) el.innerHTML = `<strong>${speaker}:</strong> ${text.slice(0, 110)}${text.length > 110 ? '…' : ''}`;
  }

  function addKeywordChip(word, type) {
    const container = $('mc-chips');
    if (!container) return;
    container.querySelector('.mc-empty')?.remove();
    const chip = document.createElement('span');
    chip.className = `mc-chip mc-chip-${type}`;
    chip.textContent = word;
    chip.title = `Spotted at ${elapsed()}`;
    container.appendChild(chip);
  }

  function updateLanguage(language, breakdown, note) {
    const badge = $('mc-lang-badge');
    const breakdownEl = $('mc-lang-breakdown');
    const noteEl = $('mc-lang-note');

    if (!badge) return;

    badge.textContent = language || 'Unknown';
    badge.className = 'mc-lang-badge';
    if (language === 'Hinglish') badge.classList.add('mc-lang-hinglish');
    else if (language === 'Hindi') badge.classList.add('mc-lang-hindi');
    else badge.classList.add('mc-lang-english');

    if (breakdownEl) breakdownEl.textContent = breakdown || '';
    if (noteEl) noteEl.textContent = note || '';
  }

  function updateScoreDisplay(score, reason) {
    const numEl = $('mc-score-num');
    if (!numEl) return;
    numEl.textContent = score;
    numEl.style.color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
    setText('mc-score-reason', reason || '');
  }

  function updateInsight(insight, suggestion) {
    const el = $('mc-insight');
    if (!el) return;
    el.innerHTML = `<p class="mc-insight-text">${insight}</p>${suggestion ? `<p class="mc-suggestion">💡 ${suggestion}</p>` : ''}`;
  }

  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = `mc-toast mc-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('mc-toast-show'));
    setTimeout(() => { t.classList.remove('mc-toast-show'); setTimeout(() => t.remove(), 350); }, 3200);
  }

  // ─── Analysis ───────────────────────────────────────────────────────────────
  function scheduleAnalysis() {
    // Recurring analysis every 60 seconds once captions are flowing
    state.analysisTimer = setInterval(() => {
      if (state.captionsEnabled && state.transcript.length >= 3) runAnalysis();
    }, 60000);
  }

  async function runAnalysis() {
    if (state.isAnalyzing) return;
    state.isAnalyzing = true;
    updateStatus('🔄 Analyzing...');

    const cutoff = Date.now() - 120000;
    const recentTranscript = state.transcript
      .filter(e => e.timestamp > cutoff)
      .map(e => `[${e.timeLabel}] ${e.speaker}: ${e.text}`)
      .join('\n');

    const speakerStats = buildSpeakerStats();

    const result = await chrome.runtime.sendMessage({
      type: 'ANALYZE_TRANSCRIPT',
      payload: {
        transcript: recentTranscript,
        speakerStats,
        team: state.userTeam,
      }
    });

    state.isAnalyzing = false;

    if (!result || result.error) {
      updateStatus(`⚠️ ${result?.error || 'Analysis failed'}`);
      return;
    }

    if (result.score) updateScoreDisplay(result.score, result.scoreReason);
    if (result.topInsight) updateInsight(result.topInsight, result.suggestion);
    if (result.language) updateLanguage(result.language, result.languageBreakdown, result.languageNote);

    (result.keywordsSpotted || []).forEach(kw => {
      if (!state.keywordsSpotted.has(kw)) { state.keywordsSpotted.add(kw); addKeywordChip(kw, 'keyword'); }
    });
    (result.redFlagsSpotted || []).forEach(flag => {
      if (!state.redFlagsSpotted.has(flag)) { state.redFlagsSpotted.add(flag); addKeywordChip(flag, 'redflag'); }
    });

    updateStatus(`Last update ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    const btn = $('mc-report-btn');
    if (btn) btn.disabled = false;
  }

  // ─── Post-Call Report ───────────────────────────────────────────────────────
  async function generateReport() {
    const btn = $('mc-report-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating report...'; }

    const fullTranscript = state.transcript
      .map(e => `[${e.timeLabel}] ${e.speaker}: ${e.text}`)
      .join('\n');

    const result = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPORT',
      payload: {
        transcript: fullTranscript,
        speakerStats: buildSpeakerStats(),
        team: state.userTeam,
        duration: Date.now() - state.sessionStart,
      }
    });

    if (btn) { btn.disabled = false; btn.textContent = '📋 Generate Full Report'; }

    if (!result || result.error) { alert('Error: ' + (result?.error || 'Unknown')); return; }
    showReportModal(result);
  }

  function showReportModal(r) {
    document.getElementById('mc-report-modal')?.remove();

    const gradeColor = { 'A+': '#10b981', 'A': '#10b981', 'B': '#22c55e', 'C': '#f59e0b', 'D': '#ef4444', 'F': '#dc2626' };
    const color = gradeColor[r.grade] || '#6b7280';

    const modal = document.createElement('div');
    modal.id = 'mc-report-modal';
    modal.innerHTML = `
      <div id="mc-report-box">
        <div id="mc-report-head">
          <h2>📋 Post-Call Report</h2>
          <button id="mc-rclose">✕</button>
        </div>
        <div id="mc-report-score-block">
          <div id="mc-rgrade" style="color:${color}">${r.grade}</div>
          <div id="mc-rscore">${r.overallScore}<span>/10</span></div>
        </div>
        <p id="mc-rsummary">${r.summary || ''}</p>
        <div class="mc-rs">
          <h3>🗣️ Call Language</h3>
          <p><strong style="color:#a5b4fc">${r.language || 'Unknown'}</strong>${r.languageBreakdown ? ` — ${r.languageBreakdown}` : ''}</p>
          ${r.languageNote ? `<p style="margin-top:6px">${r.languageNote}</p>` : ''}
        </div>
        <div class="mc-rs">
          <h3>✅ Strengths</h3>
          <ul>${(r.strengths || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="mc-rs">
          <h3>🎯 Areas to Improve</h3>
          <ul>${(r.improvements || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="mc-rs">
          <h3>📌 Next Steps</h3>
          <ul>${(r.nextSteps || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="mc-rs">
          <h3>🧑‍🏫 Coaching Notes</h3>
          <p>${r.coachingNotes || ''}</p>
        </div>
        <button id="mc-rcopy">📋 Copy to Clipboard</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('mc-rclose').onclick = () => modal.remove();
    document.getElementById('mc-rcopy').onclick = () => {
      const text = `MEET COACH REPORT\n${'─'.repeat(40)}\nScore: ${r.overallScore}/10 (${r.grade})\n\n${r.summary}\n\n✅ STRENGTHS\n${(r.strengths||[]).map(s=>`• ${s}`).join('\n')}\n\n🎯 IMPROVEMENTS\n${(r.improvements||[]).map(s=>`• ${s}`).join('\n')}\n\n📌 NEXT STEPS\n${(r.nextSteps||[]).map(s=>`• ${s}`).join('\n')}\n\n🧑‍🏫 COACHING NOTES\n${r.coachingNotes}`;
      navigator.clipboard.writeText(text).then(() => toast('Copied!', 'keyword'));
    };
  }

  // ─── Call End Detection ─────────────────────────────────────────────────────
  function watchForCallEnd() {
    const check = setInterval(() => {
      const leaveBtn = document.querySelector('button[aria-label*="Leave" i]');
      if (!leaveBtn && state.callActive && state.transcript.length > 2) {
        state.callActive = false;
        clearInterval(state.analysisTimer);
        clearInterval(check);
        updateStatus('Call ended — generating report...');
        setTimeout(generateReport, 2500);
      }
    }, 3000);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function buildSpeakerStats() {
    return Object.entries(state.speakerWords).map(([name, words]) => ({
      name, words,
      turns: state.speakerTurns[name] || 0,
      percentage: Math.round((words / (state.totalWords || 1)) * 100)
    }));
  }

  function $(id) { return document.getElementById(id); }
  function setText(id, t) { const el = $(id); if (el) el.textContent = t; }
  function setWidth(id, pct) { const el = $(id); if (el) el.style.width = `${pct}%`; }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function elapsed() { return ms2time(Date.now() - state.sessionStart); }
  function ms2time(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    const p = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${p(m % 60)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
  }

  function waitFor(fn, timeout = 10000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (fn()) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(check, 500);
      };
      check();
    });
  }

  // ─── Go ─────────────────────────────────────────────────────────────────────
  boot().catch(console.error);

})();
