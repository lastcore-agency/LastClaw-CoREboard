# OpenClaw Pixel Office App

Mobile-first React app for an OpenClaw command center with a clickable pixel-office view.

## What this package includes

- Clickable agent characters
- Agent detail panel with tabs: Status / Configure / Skills / Chat
- Model switching UI
- Skills / plugins / tools toggles
- Telegram bridge panel
- Mock OpenClaw adapter ready to replace with real API + WebSocket
- Mobile-first layout that still works on desktop

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

## Real OpenClaw integration

This app runs immediately with mock data when `VITE_USE_MOCK=true`.

To connect to a real backend:

1. Set `VITE_USE_MOCK=false`
2. Point `VITE_OPENCLAW_API_BASE` to your API
3. Point `VITE_OPENCLAW_WS_URL` to your websocket gateway
4. Replace the stub methods in `src/lib/openclaw.ts` with your real contracts

## Expected backend contracts

```http
GET    /agents
GET    /agents/:agentId
PATCH  /agents/:agentId/config
POST   /agents/:agentId/runtime/restart
POST   /agents/:agentId/runtime/pause
```

WebSocket events:

- `agent:update`
- `agent:health`
- `gateway:update`

## Project tree

```txt
openclaw-pixel-office-app/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ .env.example
├─ README.md
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ styles.css
   ├─ types.ts
   ├─ data/
   │  └─ mockAgents.ts
   ├─ lib/
   │  └─ openclaw.ts
   └─ components/
      ├─ PixelOffice.tsx
      ├─ AgentPanel.tsx
      ├─ StatusCards.tsx
      └─ BottomNav.tsx
```
