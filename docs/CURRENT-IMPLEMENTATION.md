# Current Implementation

## Architecture Summary
```text
Browser
   ↓
LastClaw
   ↓
Runtime Contract / Normalized State
   ↓
OpenClawAdapter   (current)
   ↓
Current SiX / OpenClaw
```

## Locations
- **Current frontend entry:** `src/main.tsx`, `src/App.tsx`
- **Current backend entry:** `server/index.ts`
- **Runtime adapter location:** `server/runtime/RuntimeAdapter.ts`
- **OpenClaw adapter location:** `server/runtime/OpenClawAdapter.ts`
- **Presentation/Visual Office location:** `src/components/visual-office/VisualOffice.tsx`
- **Current tests:** `server/test/`
- **Deployment/service files:** N/A (local node/vite execution via `package.json` scripts)
