# JobApply AI — Step-Based Workflow Refactor

Redesign the current single-page UI into a multi-page dashboard application with a clear step-based flow: **Dashboard → Apply → Analysis → Email**.

---

## Architecture Overview

```
/               → Dashboard (navigation cards)
/apply          → Apply Page (job input + resume upload + AI modal)
/analysis       → Analysis Page (job details | resume rankings)
/email          → Email Page (editable email + send)
/library        → Resume Library (unchanged)
/history        → Application History (unchanged)
/profile        → User Profile (new placeholder page)
```

State shared across the Apply → Analysis → Email flow will be persisted in **`sessionStorage`** and passed via a shared React context (`AppContext`) so each page can access `jobResult`, `matchResult`, etc. without prop drilling.

---

## Proposed Changes

### Global State & Context

#### [NEW] `frontend/lib/AppContext.js`
A React context that stores and exposes:
- `jobResult`, `matchResult`, `resumes`, `gmailConnected`
- Setter functions + `resetFlow()`
- On mount, hydrates from `sessionStorage` so a browser refresh doesn't lose state.

#### [MODIFY] `frontend/pages/_app.js`
Wrap `<Component>` with `<AppProvider>` and `<Toast>` component so all pages share auth + data state.

---

### Pages

#### [MODIFY] `frontend/pages/index.js` — Dashboard
Replace current everything-on-one-page layout with a beautiful **two-section card grid**:

**Section: Job Automation**
- Apply with JD / LinkedIn Post → navigates to `/apply`
- Auto Send DM to HR → coming soon card
- Auto Apply Easy Apply Jobs → coming soon card

**Section: User**
- Resume Library → `/library`
- Application History → `/history`
- User Profile → `/profile`

Each card has icon, title, description, and a glowing hover effect. Header shows Gmail SMTP status + Logout. Retains Google login gate.

#### [NEW] `frontend/pages/apply.js` — Apply Page
Two-column layout:
- **Left**: `JobInputPanel` (existing, adapted — textarea + LinkedIn URL tab)
- **Right**: `ResumeUploadPanel` (existing, unchanged)
- **Bottom**: "Analyze Job with AI" button (full-width primary)
- On click → shows **AI Analysis Modal** with real-time pipeline progress, then redirects to `/analysis`

#### [NEW] `frontend/pages/analysis.js` — Analysis Page
Two-column layout:
- **Left** (60%): `JobAnalysisPanel` — job title, company, skills, responsibilities
- **Right** (40%): Resume rankings list with % badges, best resume highlighted
- **Bottom**: "Proceed to Send Email" primary button → navigates to `/email`
- Back button → `/apply`

#### [NEW] `frontend/pages/email.js` — Email Page
- Auto-generates email on mount if not already generated
- Shows editable subject + body + recipient
- **Send Email** button (full-width success)
- **Cancel** button → back to `/analysis`
- On send success → inline success banner, then option to go back to dashboard

#### [NEW] `frontend/pages/library.js` — Resume Library Page
Standalone page wrapping the existing `ResumeLibrary` + `ResumeUploadPanel`. Header + back button.

#### [NEW] `frontend/pages/history.js` — Application History Page
Standalone page wrapping `ApplicationHistoryPanel`. Header + back button.

#### [NEW] `frontend/pages/profile.js` — User Profile Page
New page showing user avatar, name, email from Google auth, and Gmail SMTP status. Simple but polished.

---

### New Components

#### [NEW] `frontend/components/AnalysisProgressModal.jsx`
A full-screen backdrop modal that shows step-by-step pipeline messages as they arrive, referencing the existing `StepRow` from `AIPipelineProgress`. Closes automatically when analysis completes. Sequential messages animate in with a slide-up effect.

#### [NEW] `frontend/components/layout/PageLayout.jsx`
Shared layout wrapper used by all inner pages:
- Sticky header (logo, page title, back button, Gmail status, user menu)
- Centered max-width content area
- Footer

---

### Styling

#### [MODIFY] `frontend/styles/globals.css`
Add:
- `.nav-card` — dashboard card styles with gradient border + hover glow
- `.modal-backdrop` — fixed overlay with blur
- `.modal-box` — glass card for modal content
- `.page-hero` — page title + subtitle section
- `.step-badge` — numbered step indicator (1 → 2 → 3 → 4)

---

## Data Flow

```
/apply
  └─► user clicks "Analyze Job with AI"
        └─► AnalysisProgressModal opens (steps animate in)
              └─► calls /api/job/analyze → /api/job/match-resumes
                    └─► saves jobResult + matchResult to AppContext + sessionStorage
                          └─► modal closes → router.push('/analysis')

/analysis
  └─► reads jobResult + matchResult from AppContext
        └─► user clicks "Proceed to Send Email"
              └─► router.push('/email')

/email
  └─► auto-calls /api/email/generate on mount
        └─► user edits → clicks "Send Email"
              └─► calls /api/email/send → shows success banner
```

---

## User Review Required

> [!IMPORTANT]
> **Session persistence strategy**: State is stored in React context + `sessionStorage`. This means state survives page navigation but is lost on a full browser close/re-open. If you want persistence across sessions, we can switch to `localStorage`. Let me know your preference.

> [!IMPORTANT]
> **"Auto Send DM to HR" and "Auto Apply Easy Apply Jobs"** — these are shown as "Coming Soon" cards on the dashboard since they don't have backend implementations yet. Confirm if you want them clickable or greyed out.

> [!NOTE]
> The existing `ResumeUploadPanel.jsx` component is reused on the `/apply` page unchanged. 
> The existing `ResumeLibrary.jsx`, `ApplicationHistoryPanel.jsx`, and `EmailPreviewPanel.jsx` are reused on their dedicated pages.

---

## Verification Plan

### Automated Checks
- `npm run build` to confirm no compilation errors after all pages are created.

### Manual Verification (Browser)
1. Visit `/` → see dashboard with two sections of cards
2. Click "Apply with JD / LinkedIn Post" → navigate to `/apply`
3. Paste a job description, click "Analyze Job with AI" → modal animates step-by-step
4. After analysis → auto-redirected to `/analysis` showing job details on left, resume scores on right
5. Click "Proceed to Send Email" → `/email` with pre-filled editable email
6. Click "Send Email" → success message appears
7. Click "Resume Library" on dashboard → `/library` with full library UI
8. Click "Application History" → `/history` with past applications
