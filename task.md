# Task: Step-Based Workflow Refactor

## Phase 1 — Foundation
- [x] Create `frontend/lib/AppContext.js` (shared state + sessionStorage)
- [x] Modify `frontend/pages/_app.js` (wrap with AppProvider + Toast)
- [x] Add new CSS classes to `frontend/styles/globals.css`

## Phase 2 — Shared Components
- [x] Create `frontend/components/layout/PageLayout.jsx`
- [x] Create `frontend/components/AnalysisProgressModal.jsx`

## Phase 3 — Pages
- [x] Rewrite `frontend/pages/index.js` → Dashboard with nav cards
- [x] Create `frontend/pages/apply.js`
- [x] Create `frontend/pages/analysis.js`
- [x] Create `frontend/pages/email.js`
- [x] Create `frontend/pages/library.js`
- [x] Create `frontend/pages/history.js`
- [x] Create `frontend/pages/profile.js`

## Phase 4 — Verify
- [x] Check build for errors — `npm run build` → EXIT_CODE: 0, all 9 routes compile cleanly
- [x] Bug fix: `profile.js` missing `useRouter` import (ReferenceError crash)
- [x] Bug fix: `apply.js` — wired `AnalysisProgressModal` component per plan (was using inline modal)
- [x] Bug fix: `apply.js` — removed unused `error` state + `handleLogin` destructuring
- [x] Browser smoke test — dashboard and pages render correctly
