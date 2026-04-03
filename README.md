# 🎯 Meet Coach — Sova Health (v3)

AI-powered real-time call coaching for Google Meet.
**Backend: Google Sheets + Apps Script — 100% free, no database needed.**

---

## Setup (~10 minutes, one-time)

### Step 1 — Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → click **+** to create a new sheet
2. Name it `Sova Meet Coach`
3. That's it — the script will create the `config` and `users` tabs automatically

### Step 2 — Create the Apps Script

1. Inside the sheet: click **Extensions → Apps Script**
2. Delete everything in the editor
3. Open `Code.gs` from this repo → **copy the entire file** → paste it into the Apps Script editor
4. Click 💾 **Save** (name it anything, e.g. `Meet Coach Backend`)

### Step 3 — Deploy as a Web App

1. In Apps Script: click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Type" → select **Web app**
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. Click **Authorize access** → choose your Google account → Allow
6. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXX.../exec
   ```

### Step 4 — Paste the URL into the extension

Open `meet-coach/api.js`, find line 8, replace the placeholder:

```js
// Before
export const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// After (your actual URL)
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXXXXXX.../exec';
```

Save the file.

### Step 5 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Meet Coach v3"
git remote add origin https://github.com/YOUR-ORG/sova-meet-coach.git
git push -u origin main
```

---

## Installing the extension (team members)

1. Download / clone the repo
2. Open Chrome → `chrome://extensions`
3. Toggle **Developer mode** (top right)
4. Click **Load unpacked** → select the `meet-coach` folder
5. **Onboarding opens automatically** — enter name, email, select team → done

No API keys, no configuration required for team members.

---

## Admin setup (do this once after install)

1. Click the 🎯 extension icon → **🔐 Admin Panel**
2. Password: `sovahealth@123`
3. **API Key tab** → paste your Anthropic API key → Save
4. **Team Configs tab** → customise rubric, keywords, red flags per team → Save

Changes are stored in the Google Sheet and picked up by all users within 5 minutes.

Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

---

## How data is stored

Everything lives in your Google Sheet — no external database:

| Sheet | What's stored |
|-------|--------------|
| `config` | API key + team rubrics, keywords, red flags |
| `users` | Name, email, team, join date for each registered user |

You can view and edit data directly in the sheet anytime.

---

## During a call

1. Join Google Meet → panel appears automatically (top right)
2. **Enable captions** (CC button in Meet toolbar) — required for transcript capture
3. Panel updates every 60s with live score + coaching tip
4. Keyword/red flag toasts appear in real time
5. **Generate Full Report** fires automatically when call ends

---

## File structure

```
meet-coach/              ← Load this folder in Chrome
├── manifest.json
├── api.js               ← Apps Script URL + team config + API helpers
├── background.js        ← Service worker: Claude API + Sheets proxy
├── content.js           ← Meet panel: captions, analysis, UI
├── panel.css
├── onboarding.html/js   ← First-run: name, email, team
├── admin.html/js        ← Admin: API key + team configs + users
├── popup.html/js
Code.gs                  ← Paste this into Apps Script
README.md
```

---

## Teams

| Team | Focus | Default Rubric |
|------|-------|----------------|
| 🧬 Expert Consult | Patient consultations | Diagnostic questioning, empathy, next step |
| 🎯 Coaches | 1:1 coaching | Open questions, <30% talk time, accountability |
| 📞 GMT Calls | Sales calls | Pain discovery, GMT pitch, <40% talk time |

Admin password: `sovahealth@123`

---

## Updating configs (no reinstall needed)

Admin edits rubric/keywords via the Admin Panel → saved to Google Sheet → all users pick it up on their next analysis (within 5 min). No code changes, no redistribution.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Panel not appearing | Reload Meet tab, check extension is enabled |
| "API key not set" | Admin → API Key tab → paste and save |
| No transcript | Enable captions (CC button) in Meet |
| Sheets error | Re-check Script URL in `api.js`, re-deploy the web app |
| Score not updating | Analysis starts after 60s of captured transcript |

---

## Stack

- Chrome Extension (Manifest V3, ES Modules)
- Claude claude-sonnet-4-20250514 via Anthropic API  
- Google Apps Script + Google Sheets (free, no limits for this use case)
- Zero external databases, zero ongoing costs
