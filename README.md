# Memoria

A doctor-approved photo and voice story game for people with dementia, with a caregiver present and a doctor in control of story content.

> **Fictional-data prototype only.** Memoria is a student hackathon prototype, not a medical device or emergency service. Do not use real patient information or photos.

## What it does

1. A doctor creates a patient login and adds photos with captions.
2. Gemini drafts a short photo story using the doctor's prompt and captions.
3. The doctor edits and approves the draft, then assigns it to the patient.
4. A caregiver signs in on the patient's device, confirms they are present, and starts the story.
5. The patient listens to each scene, sees its photo, and chooses an answer to one recall question.
6. The session is saved and summarized for doctor review. The patient can send an alert to the doctor's dashboard.

Stories follow a backend-enforced lifecycle: `DRAFT → APPROVED → ASSIGNED → COMPLETED`. A doctor must reset an approved or assigned story to draft before editing. Patient endpoints return only assigned stories and photos referenced by those stories.

## Roles

| Role | Account | Permissions |
|---|---|---|
| Doctor | Doctor login | Creates patients and logins, uploads photos, drafts/edits/approves/assigns stories, reviews sessions and acknowledges alerts |
| Patient | Login created by doctor | Reads assigned stories, starts a session only after confirming a caregiver is present, answers recall questions, sends a caregiver alert |
| Caregiver | No separate account | Uses the patient login on the patient's device and confirms their presence before a story starts |

## Stack

- Client: React + TypeScript + Vite (`client/`)
- API: Node.js + Express + TypeScript (`server/`)
- Validation: Zod for request bodies and Gemini output
- Database: SQLite via Prisma
- AI: Gemini via `@google/genai`; key is server-side only
- Narration: browser Web Speech API (`SpeechSynthesis`), English only

## Setup

**Prerequisites:** Node.js 20+ and npm. A Google AI Studio key is needed only for Gemini story drafting and summaries; the app and seed demo work without it.

1. Clone and install dependencies:

   ```bash
   git clone <your-repo-url> memoria
   cd memoria
   npm install
   ```

2. Optional: configure the server environment:

   ```bash
   cp .env.example server/.env
   ```

   Add your Google AI Studio key to `server/.env` as `GEMINI_API_KEY`. The key must never be put in the client or committed. The local database URL and client origin are already in `.env.example`. The server defaults to the local SQLite file when `DATABASE_URL` is not set, so this step is optional for a local demo. Without a Gemini key, sign-in and seeded stories still work, but new AI drafts and summaries are unavailable.

3. Create the SQLite database and demo logins:

   ```bash
   npm run db:generate
   npm run db:migrate --workspace @memoria/server -- --name init
   npm run db:seed
   ```

4. Start the API and Vite client together:

   ```bash
   npm run dev
   ```

   Open <http://localhost:5173>. The API health endpoint is <http://localhost:3000/health>.

5. Sign in with fictional demo accounts:

   - Doctor: `doctor@demo.local` / `demo-doctor`
   - Patient: `patient@demo.local` / `demo-patient`

The seed creates four simple placeholder photos and three stories (one each in DRAFT, APPROVED, and ASSIGNED status). The seed can be run repeatedly.

## Doctor workflow

- Create a patient login from the Patients page.
- Upload JPEG, PNG, WebP, or GIF photos (maximum 5 MB) and add captions.
- Enter a short prompt and draft a story. Every generated block is labelled **AI-generated, for doctor review**.
- Review and edit the DRAFT scenes before approving. Only APPROVED stories can be assigned.
- Reset an APPROVED or ASSIGNED story to DRAFT before editing it.
- Review session summaries and acknowledge patient alerts from their dashboard pages.

3D/VR has a clearly marked **Coming soon** card on the doctor dashboard only.

## Patient workflow

- Sign in on the patient's device with the patient login.
- Check the required caregiver-present confirmation before starting.
- View assigned stories one scene at a time. Use the listen button for browser narration, read the on-screen text, and select an answer to continue.
- Use the persistent **Call my caregiver** button to send an alert to the doctor's dashboard. If it is not acknowledged after two minutes, the patient screen displays: “Your caregiver has been told. Please wait here, or ask someone nearby.”

Voice availability depends on the browser/device. English is the only language in this prototype.

## API overview

- Auth: `POST /auth/login`, `GET /auth/me`
- Doctor patient/photo/story flows: `GET|POST /patients`, `POST /patients/:id/photos`, `POST /patients/:id/stories/generate`, `PATCH /stories/:id`, `POST /stories/:id/reset`, `POST /stories/:id/approve`, `POST /stories/:id/assign`
- Doctor review: `GET /alerts`, `POST /alerts/:id/acknowledge`, `GET /sessions`, `GET /sessions/:id/summary`
- Patient: `GET /me/stories`, `GET /me/photos`, `POST /sessions`, `POST /sessions/:id/complete`, `POST /alerts`, `GET /me/alerts/:id`

Request body parsing and Gemini responses are validated. The API applies Helmet, CORS restricted to the configured client origin, a login rate limit, and a 100 KB JSON limit. Photo uploads are content-sniffed and limited to 5 MB.

## Safety and limitations

- Use fictional patients, names, images, and captions only. Gemini requests contain the doctor's prompt and photo captions with fictional photo IDs; patient names and database IDs are not sent.
- Never use this prototype to diagnose, treat, or make medication decisions. It does not claim to treat, cure, or slow dementia.
- Doctor review is required before a generated story reaches a patient. Session summaries are labelled for doctor review.
- AI output is not a safety net. Patient alerts appear on the doctor's dashboard and are not emergency notifications. This prototype does not contact a caregiver directly.
- Demo passwords and local JWT configuration are for local development only. The app is not hardened for public deployment.
- Gemini free-tier policies and rate limits can change. Review Google's current terms before using the service; real patient data is out of scope.
- No caregiver accounts, Hindi voice, weekly reports, direct email/WhatsApp notifications, daily-life monitoring, or 3D/VR experience are implemented.
- The prototype has not been clinically validated and makes no claim of therapeutic benefit.

## Validation commands

```bash
npm test
npm run build
```

## License

To be decided by the team before public release.
