# Coach Booking Platform – Deployment Guide

> **No Google Cloud project required.** The backend runs entirely inside your
> Google Sheet via Apps Script. Setup takes ~5 minutes.

## Architecture Overview

```
Customer Browser
    │
    ▼
Next.js App (Vercel)
    ├── /book             → Customer booking flow
    ├── /confirmation     → Booking confirmation
    ├── /login            → Coach/Admin login
    ├── /dashboard        → Coach portal
    ├── /admin            → Admin dashboard
    └── /api/*            → Next.js API routes
            │
            ▼
    Google Apps Script Web App   ← runs inside your Google Sheet
            │
            ├── Coaches sheet    (coach profiles)
            ├── Bookings sheet   (all bookings)
            ├── BlockedSlots     (manually blocked slots)
            └── CoachAuth        (hashed passwords)

    SMTP / Nodemailer  → email confirmations (optional)
```

---

## Google Sheets Schema

### Sheet 1: `Coaches`
| Column | Field | Description |
|--------|-------|-------------|
| A | id | Unique coach ID (e.g. C001) |
| B | name | Full name |
| C | email | Email address |
| D | languages | Comma-separated (e.g. "Hindi,English") |
| E | specialization | Short title |
| F | bio | Description shown on card |
| G | imageUrl | Profile photo URL |
| H | calendarId | Leave blank (not required) |
| I | isActive | true / false |
| J | role | coach / admin |

### Sheet 2: `Bookings`
| Column | Field | Description |
|--------|-------|-------------|
| A | id | Auto-generated BK-timestamp |
| B | customerName | |
| C | customerEmail | |
| D | customerPhone | |
| E | preferredLanguage | |
| F | coachId | |
| G | coachName | |
| H | date | YYYY-MM-DD |
| I | slot | e.g. "11:00 AM – 12:00 PM" |
| J | status | confirmed / cancelled / rescheduled |
| K | timestamp | ISO timestamp |
| L | confirmationId | 8-char alphanumeric |
| M | calendarEventId | Leave blank |
| N | notes | Optional |

### Sheet 3: `BlockedSlots`
| Column | Field |
|--------|-------|
| A | coachId |
| B | date |
| C | slot |
| D | blockedBy |
| E | timestamp |

### Sheet 4: `CoachAuth`
| Column | Field |
|--------|-------|
| A | coachId |
| B | email |
| C | passwordHash (bcrypt) |
| D | role (coach / admin) |
| E | name |

---

## Step-by-Step Setup

### Step 1 — Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like **Coach Booking**.

### Step 2 — Add the Apps Script backend

1. Inside the sheet, click **Extensions → Apps Script**.
2. Delete any existing code in the editor.
3. Open `apps-script/Code.gs` from this project and paste the entire contents.
4. Click **Save** (floppy disk icon).

### Step 3 — Run `setupSheets()` once

1. In the Apps Script editor, select **`setupSheets`** from the function dropdown.
2. Click **Run**.
3. Grant the requested permissions when prompted (the script only accesses your own sheet).
4. Open **View → Execution log**.
5. Copy the **`BOOKING_SECRET`** UUID printed in the log — you will need it in Step 5.

This automatically creates all 4 sheets with headers and adds 3 sample coaches.

### Step 4 — Deploy as a Web App

1. In the Apps Script editor click **Deploy → New Deployment**.
2. Click the gear icon next to **Type** and choose **Web App**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** and copy the **Web App URL**.

> Every time you edit `Code.gs` you must click **Deploy → Manage Deployments → Edit → New Version** to publish the changes.

### Step 5 — Add coach data

Fill in the `Coaches` sheet with your real coaches (replace the sample rows).

Add login credentials to `CoachAuth`. Generate a bcrypt password hash:
```bash
node scripts/hash-password.js MySecurePassword123
# Paste the output hash into column C of CoachAuth
```

### Step 6 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
# From Step 4
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# From Step 3 (Execution log)
APPS_SCRIPT_SECRET=paste-the-uuid-here

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-random-secret

# Your local or production URL
NEXTAUTH_URL=http://localhost:3000
```

Email (optional — leave blank to skip confirmations):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="Coach Booking <your-email@gmail.com>"
```

### Step 7 — Run locally

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

### Step 8 — Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for automatic deploys.

**Add all environment variables** in:
Vercel Dashboard → Your Project → Settings → Environment Variables

Set `NEXTAUTH_URL` to your live Vercel URL (e.g. `https://your-app.vercel.app`).

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/coaches?language=Hindi` | None | List coaches (filtered by language) |
| GET | `/api/slots?coachId=C001&date=2024-01-15` | None | Get slot availability |
| POST | `/api/bookings` | None | Create a booking |
| GET | `/api/bookings?date=2024-01-15` | Coach/Admin | List bookings |
| PATCH | `/api/bookings/:id` | Coach/Admin | Update booking status |
| POST | `/api/slots/block` | Coach/Admin | Block a slot |
| DELETE | `/api/slots/block` | Coach/Admin | Unblock a slot |
| GET | `/api/admin/coaches` | Admin only | List all coaches (with private fields) |

---

## Security

- All coach passwords are **bcrypt hashed** (cost factor 10) — plain passwords are never stored
- JWT sessions via NextAuth — credentials never travel after login
- Role-based access: coaches can only see/modify their own data; admins see everything
- Apps Script write endpoints are protected by a **secret token** stored in Script Properties
- The secret token is never exposed to the browser — only used server-to-server
- Input validated with Zod schemas on all POST endpoints

---

## Optional Enhancements

### WhatsApp Notifications
Integrate Twilio or WATI:
```bash
npm install twilio
```
Add to `lib/whatsapp.ts` and call it alongside `sendBookingConfirmation()`.

### Timezone Handling
Set `BOOKING_TIMEZONE=America/New_York` (or any IANA timezone) in env vars.

### Buffer Time Between Slots
Edit `ALL_SLOTS` in both `types/index.ts` and `apps-script/Code.gs` to add gaps.

### Reschedule/Cancel Links
Generate signed tokens (use `crypto.createHmac`) and include them in confirmation emails.

---

## Recommended Libraries

| Purpose | Library |
|---------|---------|
| Date manipulation | `date-fns` |
| Input validation | `zod` |
| Authentication | `next-auth` |
| Email | `nodemailer` |
| Password hashing | `bcryptjs` |
| Styling | Tailwind CSS (included) |
| Charts (admin) | `recharts` (add if needed) |
| WhatsApp | `twilio` (add if needed) |
