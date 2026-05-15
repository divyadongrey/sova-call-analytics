# Coach Booking Platform – Deployment Guide

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
    └── /api/*            → Backend API routes
            │
            ├── Google Sheets API  (data storage)
            ├── Google Calendar API (events)
            └── SMTP / Nodemailer  (email confirmations)
```

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
| H | calendarId | Google Calendar ID (optional) |
| I | isActive | true/false |
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
| I | slot | "11:00 AM – 12:00 PM" |
| J | status | confirmed / cancelled / rescheduled |
| K | timestamp | ISO timestamp |
| L | confirmationId | 8-char alphanumeric |
| M | calendarEventId | Google Calendar event ID |
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
| D | role (coach/admin) |
| E | name |

---

## Step-by-Step Setup

### 1. Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "coach-booking")
3. Enable these APIs:
   - Google Sheets API
   - Google Calendar API
4. Create a **Service Account**:
   - IAM & Admin → Service Accounts → Create
   - Name: `coach-booking-sa`
   - Download the JSON key file
5. **Share your Google Sheet** with the service account email (Editor access)
6. If using Calendar: share each coach's Google Calendar with the service account (Editor)

### 2. Google Sheets Setup

1. Create a new Google Sheet
2. Copy the Spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Run the setup script to create all sheets and headers:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_EMAIL=sa@project.iam.gserviceaccount.com \
   GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" \
   GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id \
   node scripts/setup-sheets.js
   ```

### 3. Add Coach Data

Fill in the `Coaches` sheet with your coaches.

Add credentials to `CoachAuth`:
```bash
node scripts/hash-password.js MySecurePassword123
# Copy the hash output into the CoachAuth sheet
```

### 4. Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in all values:
- `GOOGLE_SHEETS_SPREADSHEET_ID` – from step 2
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` – from the service account JSON key
- `GOOGLE_PRIVATE_KEY` – from the JSON key (keep the `\n` escapes)
- `NEXTAUTH_SECRET` – run `openssl rand -base64 32` to generate
- `NEXTAUTH_URL` – your Vercel URL (e.g. `https://your-app.vercel.app`)
- SMTP credentials for email confirmations

### 5. Local Development

```bash
cd coach-booking
npm install
npm run dev
# Visit http://localhost:3000
```

### 6. Vercel Deployment

```bash
npm install -g vercel
vercel login
vercel --prod
```

Or connect your GitHub repo in the Vercel dashboard and it will auto-deploy.

**Add all environment variables** in Vercel Dashboard → Settings → Environment Variables.

> **Important:** For `GOOGLE_PRIVATE_KEY`, paste the raw value including newlines — Vercel handles the escaping.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/coaches?language=Hindi` | None | List coaches |
| GET | `/api/slots?coachId=C001&date=2024-01-15` | None | Get slot availability |
| POST | `/api/bookings` | None | Create a booking |
| GET | `/api/bookings?date=2024-01-15` | Coach/Admin | List bookings |
| PATCH | `/api/bookings/:id` | Coach/Admin | Update booking status |
| POST | `/api/slots/block` | Coach/Admin | Block a slot |
| DELETE | `/api/slots/block` | Coach/Admin | Unblock a slot |
| GET | `/api/admin/coaches` | Admin only | List all coaches with private data |

---

## Security

- All coach passwords are **bcrypt hashed** (cost factor 10)
- JWT sessions via NextAuth — no passwords stored in sessions
- Role-based access: coaches can only see/modify their own data
- API routes validate session and role before any data access
- Input validated with Zod schemas on all POST endpoints
- Google Sheets credentials never exposed to the browser

---

## Optional Enhancements

### WhatsApp Notifications
Integrate Twilio or WATI:
```bash
npm install twilio
```
Add to `lib/whatsapp.ts` and call after booking confirmation.

### Timezone Handling
Set `BOOKING_TIMEZONE=America/New_York` (or any IANA timezone) in env vars.
The calendar event creation already reads this env var.

### Buffer Time Between Slots
Modify `ALL_SLOTS` in `types/index.ts` to leave 15-min gaps.

### Reschedule/Cancel Links
Generate signed tokens (use `crypto.createHmac`) and include in confirmation emails.

---

## Recommended Libraries

| Purpose | Library |
|---------|---------|
| Date manipulation | `date-fns` |
| Form validation | `zod` |
| Authentication | `next-auth` |
| Google APIs | `googleapis` |
| Email | `nodemailer` |
| Password hashing | `bcryptjs` |
| UI components | Tailwind CSS (included) |
| Charts (admin) | `recharts` (add if needed) |
