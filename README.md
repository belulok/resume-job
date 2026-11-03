# CV Studio

Resume editor with a live, print-accurate preview. The left panel holds a form editor and an AI chat, the right panel the paged preview with an inspect mode. Save and export (PDF, Word, TXT, JSON) are in the top right.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

### AI chat

The chat uses the first provider it finds:

1. **Claude API**: set `ANTHROPIC_API_KEY` in `.env.local`. The model defaults to `claude-opus-5-5`; override it with `CV_AI_MODEL`.
2. **Claude Code CLI**: if no key is set and the `claude` CLI is installed and logged in, the server calls it locally (`claude -p` with tools disabled).

The model returns JSON-Patch style operations against the resume JSON. Each AI change is applied as one undoable step and highlighted in the preview.

### PDF export

PDFs are rendered by headless Chrome from `/print`, which uses the same layout code as the preview, so the PDF matches the preview page for page. The app finds Chrome, Edge, Brave or Chromium automatically; set `CHROME_PATH` if yours is elsewhere. If no browser is found, the app opens the print dialog instead.

## Jobs: daily Telegram scan and tailored CVs (`/jobs`)

`/jobs` shows only your job list. Setup lives under **Settings** (`/jobs/settings`).

1. **Connect Telegram.** Put `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `.env.local`. In **Settings**, enter your phone number, then the code Telegram sends you, then your 2FA password if you have one. The session is saved only in `data/telegram/session` (mode 600) and the app only reads chats.
2. **Choose groups.** The picker lists your groups and channels, with likely job groups first. You can also add public channels by `@username`.
3. **Scan.** Use **Scan** in the header, or let it run daily at the time you set. To go further back, use **Re-scan the last N days** in Settings (or `npm run jobs:scan -- --days 30`); jobs you already have aren't duplicated. The daily scan runs while the app is running, and a missed slot runs as soon as the app starts. Each scan:
   1. Reads new messages since the last scan (the first scan looks back *N* days).
   2. Drops messages that don't look like jobs, and duplicate reposts.
   3. Keeps only jobs that match your field, level and location (see below) and extracts each one with Claude: title, company, salary, apply link, and 12–30 weighted ATS keywords.
   4. Opens each job's page. When it shows the job, its full description replaces the post's (Telegram posts are often one line) and the keywords are taken from it.
   5. Scores your **saved** base CV against those keywords.
   6. Tailors a copy of the CV for the best jobs above *Min fit* (up to *Max/scan*), for up to 3 rounds or until it reaches the *Target %*. The rest are listed as *Not tailored*; tailor them with one click.

**My field** (Settings → *Matching*) decides which jobs a scan keeps. Leave it empty to use the job titles and skills from your base CV, or describe it yourself, e.g. *Software engineering: full-stack, backend, AI/LLM*. Jobs in a different line of work (sales, accounting, admin, …) are skipped and only counted in *Last run*. A different tech stack or salary doesn't count as a different field; *Min fit* handles those. Seniority only counts if your field mentions it, e.g. *Level: senior, no internships*. **Where I can work** (also under *Matching*) skips jobs you can't take from where you are, e.g. *Based in Malaysia. Remote only, worldwide or APAC*: on-site or hybrid roles, and remote roles limited to other countries or to people with work authorization elsewhere. The job page also says where the job is based. Jobs you can't take, and closed listings, are dismissed (see *All*), the rest are marked *Open to you* or *Location not verified*. Some pages can't be read by the scan (CryptoJobsList and LinkedIn block it): those jobs say *This is only the Telegram post*, with **Read page in Chrome** (the apply bot reads it in your browser) and **Paste description**. Either one re-tailors the CV to the full description. Reposts of the same role at the same company are merged.

Messages are read once, so changing these affects new messages only (use **Re-scan** to apply them to older ones). Pasted jobs are never filtered.
4. **Review and apply.** Open a tailored CV in the editor. It shows a live match score, and edits autosave to that job. Download the PDF, or mark the job applied. Or use **Auto-fill application** (below).

**Match score** = weighted keyword coverage, the same idea ATS checkers use. Required keywords count 3×, important ones 2×, and nice-to-have 1×. Matching ignores punctuation and plurals and accepts aliases. Tailoring rephrases and re-orders your real experience using the job's wording, but never invents employers, titles, dates, metrics or skills. Keywords it can't add truthfully are listed under *Not on your CV*. If you actually have one, add it under **Extra facts about me** and re-tailor.

You can also **Paste a job** from LinkedIn, JobStreet or an email.

### Auto-fill applications (apply bot)

**Auto-fill application** on a job runs the apply bot, `npm run apply -- <job-id>` in [own-stagehand](../own-stagehand) (set `APPLY_BOT_DIR` in `.env.local` if it lives elsewhere). It opens the job in your own Chrome (Stagehand, signed-in profile) and:

1. Reads the job page and sends it here: a full description replaces a one-line post and the CV is re-tailored to it.
2. Finds the application form: embedded forms, Ashby / Lever application URLs, the Apply button, *Sign in with Google*. Other sign-ins and sign-ups are left to you in the window.
3. Reads every field and asks CV Studio for answers: your **Application profile** (Settings), answers saved from earlier forms, and your tailored CV for open questions. Nothing is made up: consent boxes, diversity questions and anything it can't answer truthfully are left empty.
4. Fills the form and attaches the tailored CV as a PDF. Required fields it left are outlined in orange and listed on the job.
5. Stops. **You review and click Submit.** When the confirmation page shows, the job is marked applied and the answers you typed are saved for next time.

Bot checks and CAPTCHAs are never bypassed: the bot waits while you complete them. Progress shows on the job; **Stop** closes the window. Logs are in `data/jobs/apply-logs/`. The form is read and filled from the page itself; the local Ollama model (`qwen3.5:4b`, the bot's default) only steps in for an Apply button or dropdown it can't find. Answers are written by CV Studio's AI, the same one that tailors CVs.

**Scan when the app is closed (optional, macOS):** `npm run jobs:daily:install` sets up a launchd job at your scan time. `npm run jobs:daily:uninstall` removes it. Logs go to `data/jobs/scan.log`. `npm run jobs:scan` runs one scan from the terminal.

## How it works

| Piece | Where |
| --- | --- |
| Resume model (sections → entries → blocks, `**bold**` / `*italic*` markup) | `src/lib/resume/types.ts` |
| Reference content (transcribed from *Sebastian resume Jan 2026.pdf*) | `src/lib/resume/default-resume.ts` |
| Classic template (US Letter, Calibri 8pt / Verdana 16pt, pt-based CSS) | `src/templates/classic/` |
| Measure + paginate (each column flows independently; entries are never split, headings stay with their first entry) | `src/components/resume/ResumeDocument.tsx`, `src/lib/resume/units.ts` |
| Inspector overlay, selection toolbar, quick edit | `src/components/editor/preview/Preview.tsx` |
| AI prompt / providers | `src/lib/ai/` · `src/app/api/chat/route.ts` |
| Exports | `src/lib/export/` · `src/app/api/export/pdf/route.ts` |

Calibri isn't free to ship, so the template falls back to **Carlito** (bundled), which has the same metrics. Line breaks match Calibri exactly. If Calibri is installed, it is used.

## Storage

- Every edit autosaves to `localStorage` as a draft.
- **Save** (⌘S) also writes `data/resume.json`.
- On load the app uses the draft first, then the saved file, then the template.

## Shortcuts

⌘S save · ⌘Z / ⇧⌘Z undo/redo · click = select · double-click = edit text · ⌥-click = select parent · ⌫ delete selection · Esc deselect · ⌘/Ctrl + scroll = zoom · Enter in a bullet = new bullet

| Jobs piece | Where |
| --- | --- |
| Telegram (GramJS user client, login, chats, messages) | `src/lib/telegram/client.ts` · `src/app/api/telegram/` |
| Job extraction (messages → jobs + ATS keywords) | `src/lib/jobs/extract.ts` |
| ATS similarity score (shared by server and live editor) | `src/lib/jobs/score.ts` |
| Tailoring loop | `src/lib/jobs/tailor.ts` |
| Job page reader (full description, keywords, location) | `src/lib/jobs/verify.ts` |
| Application answers, apply bot runs | `src/lib/jobs/apply.ts` · `src/app/api/jobs/[id]/{page,answers,application}/` |
| Scan pipeline, scheduler, storage (`data/jobs/`) | `src/lib/jobs/scan.ts` · `runner.ts` · `store.ts` · `src/instrumentation.ts` |
