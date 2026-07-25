# Last CoRE OpenClaw Mobile Command Center — Fullstack Spec (Dev Handoff)

> เอกสารนี้เป็นสเปก **ตัวทำจริง** สำหรับส่งให้ dev ลงมือทำทันที  
> เป้าหมายคือ **เร็ว, ใช้ได้จริง, ต่อได้ไกล, มือถือเป็นหลัก**  
> โครงสร้างที่เลือกคือ **1 monorepo + 1 mobile-first PWA + 1 operator sidecar**  
> ไม่แยกเป็น 3 โปรเจกต์ เพราะจะทำให้ auth, deployment, state, และ integration บานทันที

---

## 1) Executive Decision

### สรุปสั้นที่สุด
ให้สร้างระบบเป็น **แอปเดียว** แต่มี **3 surface หลัก** ภายในแอป:

1. **Center** — หน้าคุย/สั่งงาน/คุม command center
2. **Studio** — หน้าตั้งค่า agent / model / skills / plugins / tools / channels
3. **Board** — หน้าสถานะรวม, health, gateway, sessions, jobs, usage

ทั้งหมดใช้ **OpenClaw Gateway WebSocket** เป็น backbone หลัก  
และเพิ่ม **operator sidecar** ตัวเล็กสำหรับงานที่ไม่ควรยัดเข้า browser ตรง ๆ เช่น plugin lifecycle, local diagnostics, service restart

---

## 2) สิ่งที่ต้องตัดให้ขาดตั้งแต่แรก

## ทำ
- ทำเป็น **mobile-first PWA**
- ใช้ **single codebase**
- ใช้ **WebSocket กับ OpenClaw Gateway** เป็นช่องทางหลัก
- ใช้ **schema-driven settings** เท่าที่ทำได้
- ทำ **Telegram แบบ bridge / mirrored session**
- ทำ **ClawHub install/search** สำหรับ skills
- ทำ **plugin install/enable/disable** ผ่าน sidecar
- ทำ **preset board** ไม่ทำ dashboard builder ตั้งแต่แรก

## ไม่ทำใน v1
- ไม่ embed Telegram เต็มตัวในเว็บ
- ไม่ทำ pixel office / virtual office / 3D / scene-based UI
- ไม่ทำ drag-and-drop dashboard builder แบบ LobsterBoard
- ไม่ทำ separate backend ใหญ่
- ไม่ทำ database กลางตั้งแต่วันแรก ถ้ายังไม่จำเป็น
- ไม่ทำ onboarding model provider แบบใหม่ทั้งหมดในเว็บ
- ไม่ทำ full marketplace moderation logic เอง
- ไม่ทำ multi-tenant SaaS architecture ตั้งแต่รอบแรก

## คำเตือนที่ต้องล็อกไว้
### 2.1 Telegram “ยกหน้าต่าง Telegram Group มาไว้ในเว็บ” แบบเต็มตัว
**ไม่ใช่ทางที่ควรทำ**
- Telegram Widgets และ Mini Apps ไม่ได้ออกแบบมาเพื่อ “เอา Telegram ทั้งตัวมารันในเว็บของเรา”
- ทางที่ถูกต้องคือ **เชื่อมผ่าน OpenClaw Telegram channel → กลายเป็น session/topic → แสดงใน Center**

### 2.2 ถ้าแยกเป็น 3 เว็บ 3 stack
**เสียเวลาแน่นอน**
- auth ซ้ำ
- deployment ซ้ำ
- state management แยก
- mobile UX แตก
- debugging ยาวขึ้นทันที

### 2.3 plugin auto-enable แบบไม่ review
**ไม่ควรทำ**
- plugin เข้า trusted runtime ของ gateway
- อย่างน้อยต้องมี metadata, source, version, risk note, และ confirm step

---

## 3) Product Goal

สร้างแอปควบคุม OpenClaw สำหรับมือถือ ที่ผู้ใช้สามารถ:

- สลับ model ได้
- ดู/แก้ config ได้
- ตั้งค่า agent ได้
- เปิด/ปิด skills / plugins / tools ได้
- ติดตั้ง ClawHub ได้
- คุม Telegram group/topic ผ่าน session mirror ได้
- ดูสถานะ gateway / agent / channel / session / health / logs / usage ได้
- สั่งงานจากมือถือได้ง่ายภายใน 2–3 tap

---

## 4) Core Architecture

```text
[ Mobile Browser / PWA ]
        |
        |  WebSocket
        v
[ OpenClaw Gateway ]
        |
        | local runtime / channels / models / agents / sessions / skills
        |
        +---- [ Telegram Channel ]
        |
        +---- [ ClawHub / Skills ]
        |
        +---- [ Plugins Runtime ]
        |
        +---- [ Sidecar HTTP/Unix Socket ]
```

### หลักการ
- **Frontend ไม่เป็นเจ้าของ business state หลัก**
- state จริงอยู่ที่ OpenClaw Gateway
- frontend เก็บแค่:
  - UI preferences
  - cached view models
  - optimistic action states
  - local drafts / search filters / board layout preset choice

### sidecar มีไว้ทำอะไร
sidecar ทำเฉพาะงานที่ browser ไม่ควรทำเอง:
- plugin install/enable/disable/update
- service restart / reload
- local diagnostics
- read-only system metrics ที่ gateway ไม่ expose พอ
- safe command wrapping

> sidecar ต้องเป็น **thin wrapper** ไม่ใช่ backend ใหม่ทั้งก้อน

---

## 5) Recommended Tech Stack

## Frontend
- **Vite**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Zustand**
- **TanStack Query** (เฉพาะ query cache ที่ไม่ขัดกับ WS state)
- **React Router**
- **shadcn/ui** หรือชุด component minimal ที่คล้ายกัน
- **Recharts** สำหรับ board chart
- **PWA support** (vite-plugin-pwa)

## Sidecar
เลือกอันใดอันหนึ่ง:
- **Node.js + Fastify**
- หรือ **Go** ถ้า dev ทีมถนัดและต้องการ binary เดียว

> ถ้าต้องการทำเร็วที่สุดและแชร์ type กับ frontend: ใช้ **Node.js + TypeScript**

## Infra
- Reverse proxy: **Caddy** หรือ **Nginx**
- Deploy แบบง่าย:  
  - frontend build เป็น static  
  - serve ภายใต้ gateway control UI root หรือ reverse proxy path เดียวกัน
- Optional:
  - Docker Compose
  - systemd service สำหรับ gateway และ sidecar

---

## 6) Final Product Shape

## แอปเดียว มี 3 surface
ใช้ **bottom navigation** เป็นหลักบนมือถือ

```text
[ Center ] [ Studio ] [ Board ]
```

### 6.1 Center
ใช้คุย / สั่งงาน / คุม session

### 6.2 Studio
ใช้คอนฟิกระบบ

### 6.3 Board
ใช้ดูภาพรวมการทำงานและสุขภาพระบบ

---

## 7) Information Architecture

## 7.1 Center
### เป้าหมาย
หน้าหลักที่เปิดแล้ว “เห็นและสั่งงานได้ทันที”

### โครงสร้าง
- Top bar
  - current workspace / gateway label
  - gateway status dot
  - reconnect button
  - model quick switch
  - active agent quick switch
- Session list
  - Direct sessions
  - Telegram group sessions
  - Telegram topic sessions
  - Pinned sessions
- Chat panel
  - message stream
  - tool call cards
  - system events
  - attachments
- Composer
  - text input
  - slash command helper
  - attach file
  - send
- Quick sheet
  - session actions
  - reset
  - compact
  - trace on/off
  - verbose on/off
  - usage mode
- Session detail sheet
  - session metadata
  - token/cost snapshot
  - mapped agent
  - mapped model
  - channel info
  - health markers

### ต้องมีฟีเจอร์
- create new session
- open existing session
- stream response
- switch agent per session
- switch model per session หรือ default model
- show tool events แบบอ่านง่าย
- show approvals / pending actions ถ้ามี
- Telegram mirrored sessions แยกตาม group/topic

---

## 7.2 Studio
### เป้าหมาย
หน้าตั้งค่าระบบที่ dev/user ใช้งานได้จริงบนมือถือ

### เมนูย่อย
1. Providers & Models
2. Agents
3. Skills
4. Plugins
5. Tools
6. Channels
7. Gateway Settings
8. Security / Access
9. Diagnostics

### รูปแบบ UI
- list view
- detail sheet / full-screen sheet
- switch-heavy UI
- schema form
- grouped cards
- search/filter

### 7.2.1 Providers & Models
ต้องมี:
- list runtime-allowed models
- show current default model
- set default model
- channel-specific model (ถ้าจะเปิดในรอบถัดไป)
- agent-specific preferred model
- reasoning profile preset (ถ้ามี abstraction layer)
- provider status / validation state

### 7.2.2 Agents
ต้องมี:
- list agents
- create/update/delete agent
- overview
- assigned channels
- enabled skills
- enabled tools
- workspace/files summary
- default model
- status badge

### 7.2.3 Skills
ต้องมี:
- search skills
- detail skill
- install skill from ClawHub
- update skill
- enable/disable per agent
- show version/source/requirements
- show safety note/permission hint

### 7.2.4 Plugins
ต้องมี:
- installed plugins list
- available plugin sources (manual / registry / local)
- install plugin
- enable / disable plugin
- update plugin
- restart/reload requirement state
- source + version + publisher + capability tags
- warning sheet ก่อนเปิดใช้งาน

> plugins ให้ผ่าน sidecar

### 7.2.5 Tools
ต้องมี:
- tools catalog
- tools effective by agent
- grouped by source:
  - core
  - plugin
- toggle ถ้าระบบรองรับในระดับ agent/config
- dependency relation
- last error / unavailable reason

### 7.2.6 Channels
ต้องมี:
- channel list
- status
- login state
- account state
- Telegram config
- group/topic mapping
- agent routing
- require mention on/off
- direct/group enable/disable

### 7.2.7 Gateway Settings
ต้องมี:
- schema-driven renderer
- config tree
- patch/apply flow
- diff preview
- validate before apply
- rollback snapshot อย่างน้อยระดับ local draft

### 7.2.8 Security / Access
ต้องมี:
- token status
- paired device list (ถ้าดึงได้)
- role/scopes summary
- local sidecar protection status
- confirm-sensitive-action modal

### 7.2.9 Diagnostics
ต้องมี:
- websocket connection state
- protocol version
- gateway version
- last errors
- plugin runtime issues
- restart/reload controls
- health summary

---

## 7.3 Board
### เป้าหมาย
เห็นภาพรวมระบบในหน้าเดียว แบบไม่ต้อง build dashboard เอง

### Board v1 = preset board เท่านั้น
ไม่ drag/drop

### sections
1. **Gateway Health**
2. **Channels**
3. **Agents**
4. **Sessions**
5. **Jobs / Cron**
6. **Usage / Cost**
7. **Recent Logs**
8. **Alerts**

### cards ที่ต้องมี
- gateway up/down
- websocket connected/disconnected
- protocol version
- active channels count
- Telegram state
- active agents
- unhealthy agents
- active sessions
- queued/pending actions
- cron run status
- usage summary
- cost summary
- last error feed

### board modes
- compact mobile
- tablet expanded
- optional wallboard mode ภายหลัง

---

## 8) Mobile UX Rules (ต้องล็อก)

1. ทุกอย่างต้องกดได้ใน 1 มือ
2. ใช้ bottom nav เป็นหลัก
3. ใช้ sheet แทน modal desktop
4. ห้ามยัด sidebar ถาวร
5. action สำคัญต้องอยู่ไม่เกิน 2 tap
6. status ที่สำคัญต้องเห็นจากหน้าแรก
7. ใช้สีสถานะชัด:
   - green = healthy
   - amber = degraded
   - red = broken
8. composer ต้องติดล่างแบบแชทจริง
9. long form config ต้องมี search/filter/section jump
10. แยก “read state” กับ “danger action” ชัดเจน

---

## 9) Fullstack Repository Structure

```text
lastcore-openclaw-center/
├─ apps/
│  ├─ mobile-web/
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ router/
│  │  │  │  ├─ providers/
│  │  │  │  └─ store/
│  │  │  ├─ pages/
│  │  │  │  ├─ center/
│  │  │  │  ├─ studio/
│  │  │  │  ├─ board/
│  │  │  │  └─ settings/
│  │  │  ├─ features/
│  │  │  │  ├─ gateway/
│  │  │  │  ├─ sessions/
│  │  │  │  ├─ chat/
│  │  │  │  ├─ agents/
│  │  │  │  ├─ models/
│  │  │  │  ├─ skills/
│  │  │  │  ├─ plugins/
│  │  │  │  ├─ tools/
│  │  │  │  ├─ channels/
│  │  │  │  ├─ board/
│  │  │  │  └─ diagnostics/
│  │  │  ├─ components/
│  │  │  │  ├─ ui/
│  │  │  │  ├─ layout/
│  │  │  │  ├─ cards/
│  │  │  │  ├─ sheets/
│  │  │  │  └─ charts/
│  │  │  ├─ lib/
│  │  │  │  ├─ ws/
│  │  │  │  ├─ format/
│  │  │  │  ├─ schema/
│  │  │  │  └─ guards/
│  │  │  ├─ hooks/
│  │  │  ├─ styles/
│  │  │  ├─ types/
│  │  │  └─ main.tsx
│  │  ├─ vite.config.ts
│  │  ├─ tailwind.config.ts
│  │  └─ package.json
│  │
│  └─ sidecar/
│     ├─ src/
│     │  ├─ server/
│     │  ├─ routes/
│     │  ├─ services/
│     │  │  ├─ plugin-service.ts
│     │  │  ├─ gateway-service.ts
│     │  │  ├─ system-service.ts
│     │  │  └─ auth-service.ts
│     │  ├─ adapters/
│     │  │  ├─ cli/
│     │  │  └─ shell/
│     │  ├─ middleware/
│     │  ├─ types/
│     │  └─ index.ts
│     └─ package.json
│
├─ packages/
│  ├─ shared-types/
│  │  ├─ src/
│  │  │  ├─ gateway.ts
│  │  │  ├─ board.ts
│  │  │  ├─ studio.ts
│  │  │  └─ sidecar.ts
│  │  └─ package.json
│  │
│  ├─ ui-kit/
│  │  ├─ src/
│  │  └─ package.json
│  │
│  └─ config/
│     ├─ eslint/
│     ├─ tsconfig/
│     └─ package.json
│
├─ infra/
│  ├─ caddy/
│  ├─ nginx/
│  ├─ docker/
│  └─ systemd/
│
├─ docs/
│  ├─ architecture.md
│  ├─ ws-method-map.md
│  ├─ env.md
│  ├─ deploy.md
│  └─ runbook.md
│
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

---

## 10) Frontend Module Design

## 10.1 app/store
แยก store ตาม concern:
- `useGatewayStore`
- `useSessionStore`
- `useChatStore`
- `useModelStore`
- `useAgentStore`
- `useSkillStore`
- `usePluginStore`
- `useToolStore`
- `useChannelStore`
- `useBoardStore`
- `useUiStore`

## 10.2 WebSocket client layer
โฟลเดอร์ `src/lib/ws/`

ไฟล์แนะนำ:
- `gatewayClient.ts`
- `gatewayConnection.ts`
- `gatewayMethods.ts`
- `gatewayEvents.ts`
- `eventNormalizer.ts`
- `reconnectManager.ts`
- `authHandshake.ts`

### ความสามารถที่ต้องมี
- connect
- reconnect with backoff
- resubscribe / refresh after reconnect
- request-response map
- event dispatch
- timeout handling
- protocol version guard
- auth token/device info injection
- network degraded UI signaling

## 10.3 Schema renderer
ใช้กับ config/settings
- boolean → switch
- enum → select
- string → input
- secret → masked input
- object → collapsible section
- array → repeatable item editor
- uiHints support
- diff preview

---

## 11) Sidecar Design

## 11.1 Sidecar Scope
sidecar **ห้าม** กลายเป็น business backend ใหม่  
ให้เป็นแค่ operator utility bridge

## 11.2 Required endpoints
```text
GET    /health
GET    /version
GET    /diagnostics
GET    /plugins
POST   /plugins/install
POST   /plugins/enable
POST   /plugins/disable
POST   /plugins/update
POST   /gateway/restart
POST   /gateway/reload
GET    /system/summary
GET    /logs/recent
```

## 11.3 Plugin service responsibilities
- wrapper around `openclaw` CLI หรือ safe shell command
- capture stdout/stderr
- normalize result
- add timeout
- add allowlist
- reject dangerous arbitrary shell command

## 11.4 Security for sidecar
- bind to localhost only
- require shared secret / signed local token
- optional unix socket
- CSRF not enough — ต้องมี auth layer
- no arbitrary command endpoint
- strict allowlist only

---

## 12) State Ownership

## Gateway-owned state
- runtime status
- models available
- sessions
- agent state
- channel state
- tools/skills effective state
- usage/cost/runtime events
- health
- cron/jobs
- logs/events

## Frontend-owned state
- selected tab
- local search/filter
- pinned boards/cards
- unsaved config draft
- unsent composer draft
- UI theme/layout prefs
- recently opened sessions

## Sidecar-owned state
- none long-term
- only ephemeral command execution result
- optional command history buffer (very short-lived)

---

## 13) Data Contracts / Domain Models

## 13.1 GatewayStatus
```ts
type GatewayStatus = {
  connected: boolean
  protocolVersion: number
  serverVersion?: string
  connId?: string
  latencyMs?: number
  lastSeenAt?: string
  health: "healthy" | "degraded" | "down"
}
```

## 13.2 ModelSummary
```ts
type ModelSummary = {
  id: string            // provider/model
  provider: string
  name: string
  default?: boolean
  available: boolean
  tags?: string[]
}
```

## 13.3 AgentSummary
```ts
type AgentSummary = {
  id: string
  name: string
  description?: string
  defaultModel?: string
  enabledSkills: number
  enabledTools: number
  health: "healthy" | "degraded" | "down"
  activeSessions?: number
}
```

## 13.4 SessionSummary
```ts
type SessionSummary = {
  id: string
  title?: string
  agentId?: string
  modelId?: string
  channel?: "local" | "telegram" | "other"
  peerId?: string
  kind?: "dm" | "group" | "topic"
  unread?: number
  active: boolean
  updatedAt: string
}
```

## 13.5 SkillSummary
```ts
type SkillSummary = {
  slug: string
  title: string
  version?: string
  source: "clawhub" | "local"
  installed: boolean
  enabled?: boolean
  risk?: "low" | "review" | "unknown"
}
```

## 13.6 PluginSummary
```ts
type PluginSummary = {
  name: string
  version?: string
  source?: string
  installed: boolean
  enabled: boolean
  restartRequired?: boolean
  capabilities?: string[]
  risk?: "low" | "review" | "unknown"
}
```

---

## 14) Gateway Integration Map

> ตรงนี้คือแกนสำคัญที่ dev ต้องใช้เป็นฐาน

## ใช้ผ่าน WebSocket method families
ฝั่ง UI ต้อง map กับ gateway methods หลัก เช่น:
- `connect`
- `status`
- `health`
- `models.list`
- `usage.status`
- `usage.cost`
- `channels.status`
- `agents.list/create/update/delete`
- `sessions.*`
- `skills.search`
- `skills.detail`
- `skills.install`
- `tools.catalog`
- `tools.effective`
- `cron.*`
- `logs.*` (ถ้ามีใน runtime path ที่เลือกใช้)
- `config.get`
- `config.patch`
- `config.apply`
- `config.schema`

## event families ที่ UI ต้องรองรับ
- presence / connection
- health
- sessions changed
- message stream
- cron/activity
- usage updates
- log/error events

> implementation จริงให้ dev ยึดชื่อ method จาก protocol version ที่ใช้อยู่ใน gateway ตัวล่าสุด ณ ตอนลงมือ

---

## 15) Telegram Integration Strategy

## เป้าหมายจริง
ไม่ใช่ “เอา Telegram มาฝัง”
แต่คือ “ให้ Telegram คุยผ่าน OpenClaw แล้ว UI เราคุมได้เหมือน command center”

## flow
```text
Telegram DM / Group / Topic
        ↓
OpenClaw Telegram Channel
        ↓
Gateway Session / Topic Session
        ↓
Center Session List
        ↓
Operator reply from Center
        ↓
Gateway sends back to Telegram
```

## ต้องรองรับ
- group sessions
- forum topics
- per-topic agent routing
- require mention per group/topic
- session title derived from group/topic
- topic session key mapping
- thread-aware reply target

## UI ที่ต้องมี
- Telegram account status card
- groups list
- topics list
- mapped agent badge
- mention required badge
- open in session action
- rebind topic to agent action

---

## 16) ClawHub / Skills Strategy

## v1 ต้องทำ
- search skill
- view detail
- install
- enable/disable per agent or workspace level (ตาม runtime ที่รองรับ)
- update
- source + version + metadata view

## UI rule
ก่อน install ต้องแสดง:
- slug
- title
- version
- source
- requirements
- risk note
- install target

## ห้าม
- one-tap hidden install
- auto-enable ทุกอย่างทันทีโดยไม่เห็น metadata

---

## 17) Plugin Strategy

## สำคัญ
plugin lifecycle ให้ทำผ่าน **sidecar**

## v1 plugin actions
- list installed
- install
- enable
- disable
- update
- show restart required

## reason
เพราะ plugin เป็น runtime capability layer ไม่ควรปล่อย browser คุม shell/host ตรง ๆ

## UI rule
ทุก plugin card ต้องมี:
- name
- version
- source
- capabilities
- enabled state
- installed state
- restart required
- open docs/source
- danger confirm

---

## 18) Config Strategy

## หลัก
config ต้องทำแบบ **schema-first where possible**

## flow
1. fetch schema
2. fetch current config
3. render form
4. edit in local draft
5. preview diff
6. apply patch
7. show result
8. refresh runtime state

## ต้องมี
- unsaved change warning
- per-section save
- full apply
- validation error display
- rollback to last fetched snapshot

---

## 19) Board Data Model

## Board sections

### Gateway
- connected
- protocol
- version
- latency
- uptime

### Channels
- telegram up/down
- logged in/out
- active groups
- active topics

### Agents
- total
- healthy
- degraded
- error

### Sessions
- active
- idle
- pending approval
- last message time

### Usage
- today tokens
- current window
- estimated cost

### Jobs
- cron active
- last run
- failed runs

### Logs
- last errors
- warnings
- plugin issues
- reconnect events

---

## 20) Suggested Routing

```text
/
├─ /center
│  ├─ /center/:sessionId
│  └─ /center/new
├─ /studio
│  ├─ /studio/models
│  ├─ /studio/agents
│  ├─ /studio/skills
│  ├─ /studio/plugins
│  ├─ /studio/tools
│  ├─ /studio/channels
│  ├─ /studio/config
│  └─ /studio/diagnostics
└─ /board
   ├─ /board/overview
   ├─ /board/usage
   ├─ /board/logs
   └─ /board/alerts
```

บนมือถือ route เหล่านี้อาจแสดงเป็น full-screen sheet มากกว่า page แยกจริงบางส่วนได้

---

## 21) Auth & Access

## Gateway
- ใช้ token/device-based handshake ตาม gateway protocol
- UI ต้องรองรับ pairing / auth fail / reconnect fail state

## Sidecar
- localhost only
- secret-based auth
- action allowlist
- timeout
- audit log เฉพาะ action สำคัญ

## Browser
- ห้ามเก็บ secret แบบ plain ถ้าเลี่ยงได้
- ถ้าจำเป็นต้องเก็บ local token ให้ใช้ secure storage pattern ตาม environment ที่ deploy
- production ต้องอยู่หลัง TLS

---

## 22) Persistence Strategy

## v1
ไม่ต้องมี DB กลางเพิ่ม ถ้ายังไม่จำเป็น

ใช้:
- Gateway runtime/config เป็น source of truth
- browser localStorage / IndexedDB สำหรับ UI preference
- sidecar ephemeral memory สำหรับ command state

## ค่อยเพิ่ม DB เมื่อ
- ต้องมี custom board layouts หลายชุด
- ต้องมี audit history ของ operator actions
- ต้องมี collaboration หลาย operator
- ต้องมี task/workboard persistence จริง

ถ้าต้องเพิ่มในรอบถัดไป:
- PostgreSQL
- Prisma / Drizzle
- เก็บเฉพาะ app-specific state ไม่ซ้ำกับ gateway runtime

---

## 23) Deployment Strategy

## Option A — เร็วสุด
- build frontend เป็น static
- serve ภายใต้ reverse proxy path เดียวกับ gateway
- sidecar รัน local ในเครื่องเดียวกับ gateway

## Option B — ยังเร็วแต่เป็นระบบขึ้น
- Docker Compose
- services:
  - gateway
  - mobile-web
  - sidecar
  - reverse-proxy

## reverse proxy path แนะนำ
```text
/           -> mobile-web
/ws         -> gateway websocket
/sidecar    -> sidecar http (internal only or protected)
```

หรือถ้าใช้ control UI root ของ gateway:
- ชี้ frontend build ไปยัง control UI root
- ให้ frontend เรียก gateway ผ่าน same-origin ws

---

## 24) Environment Variables

```bash
# mobile-web
VITE_GATEWAY_WS_URL=wss://your-domain/ws
VITE_SIDECAR_BASE_URL=/sidecar
VITE_APP_NAME=Last CoRE Command Center
VITE_DEFAULT_LOCALE=th

# sidecar
SIDECAR_PORT=8787
SIDECAR_BIND=127.0.0.1
SIDECAR_SHARED_SECRET=change_me
OPENCLAW_BIN=/usr/local/bin/openclaw
OPENCLAW_CONFIG_PATH=/home/lastcore/.openclaw/openclaw.json
ALLOW_GATEWAY_RESTART=true
ALLOW_PLUGIN_INSTALL=true
```

---

## 25) Critical Screens (Dev Must Build)

## Center
- session list
- chat stream
- composer
- session action sheet
- model quick switch
- agent quick switch
- connection status chip

## Studio
- model list page
- agent list + detail
- skill marketplace list + detail
- plugin list + install flow
- tools catalog page
- channels / Telegram mapping page
- config schema page
- diagnostics page

## Board
- overview page
- usage page
- alerts/logs page

---

## 26) Acceptance Criteria

## 26.1 Center
- ผู้ใช้เปิดจากมือถือแล้วเห็น session list ภายใน 3 วินาทีหลัง connect สำเร็จ
- เปลี่ยน session ได้ภายใน 1 tap
- ส่งข้อความได้
- เห็น streaming response ได้
- สลับ model และ agent ได้จากหน้า Center
- Telegram group/topic session เปิดคุยต่อได้

## 26.2 Studio
- เห็น model catalog ได้
- เปลี่ยน default model ได้
- เห็น agent list และแก้ config พื้นฐานได้
- ค้นและติดตั้ง skill จาก ClawHub ได้
- enable/disable plugin ได้ผ่าน sidecar
- เห็น tools catalog/effective tools ได้
- ปรับ Telegram group/topic mapping ได้
- แก้ config ผ่าน form ได้

## 26.3 Board
- เห็น gateway health ได้
- เห็น channel status ได้
- เห็น session count และ agent health ได้
- เห็น usage/cost summary ได้
- เห็น recent errors/logs ได้

---

## 27) Implementation Plan (ล็อกให้จบเร็ว)

## Milestone 1 — ใช้งานได้จริง
**เป้าหมาย:** เปิดมือถือแล้วคุมได้ทันที

### ทำ
- monorepo setup
- mobile-web shell
- gateway ws connect
- Center chat
- session list
- model quick switch
- agent quick switch
- Board overview basic
- basic diagnostics
- deploy path เดียวกับ gateway

### ห้ามแถม
- animation เยอะ
- custom theme system ใหญ่
- drag/drop
- pixel office
- DB

---

## Milestone 2 — ครบตามโจทย์หลัก
**เป้าหมาย:** ตั้งค่า agent + skills + channels + Telegram ได้จริง

### ทำ
- Studio pages
- config schema form
- models page
- agents page
- skills search/detail/install
- tools catalog
- Telegram mapping UI
- sidecar + plugin lifecycle controls

---

## Milestone 3 — พร้อมต่อยอด
**เป้าหมาย:** ระบบนิ่งและพร้อมใช้จริงระยะกลาง

### ทำ
- board usage/cost/logs
- alerts
- retry/reconnect polish
- sidecar hardening
- local audit trail (optional)
- board presets เพิ่ม
- tablet optimization

---

## 28) Engineering Rules

1. อย่า hardcode protocol shape ถ้ามี schema/method discovery ใช้ได้
2. อย่าให้ UI รู้ shell command ตรง ๆ
3. อย่าแยก service ถ้ายังไม่ได้ประโยชน์ชัด
4. อย่าใช้ global giant store ก้อนเดียว
5. ทุก dangerous action ต้องมี confirm
6. ทุก runtime action ต้องมี loading + success + error state
7. reconnect ต้องมี backoff
8. chat stream ต้องไม่ block ทั้งหน้า
9. mobile first จริง ไม่ใช่ desktop ย่อ
10. code ต้องออกแบบให้สลับ transport layer ได้ถ้าภายหลังมี native app

---

## 29) Suggested Folder-Level Ownership

## Frontend team
- UI shell
- WS integration
- Center
- Studio forms
- Board
- local state
- UX polish

## Fullstack / platform team
- sidecar
- reverse proxy
- deploy
- service lifecycle
- environment config
- gateway integration validation

---

## 30) Dev Notes for Immediate Start

### เริ่มจากนี้
1. สร้าง monorepo
2. เปิด `apps/mobile-web`
3. ทำ layout + bottom nav
4. ทำ ws connect + health chip
5. ทำ Center session list + chat
6. ทำ Board overview
7. ทำ Studio > Models / Agents / Config
8. ค่อยเพิ่ม Skills / Plugins / Telegram mapping

### ถ้าทีมจะใช้ mock ก่อน
ให้ mock data แค่ 3 หมวด:
- gateway
- session
- agent

หลังจากนั้นต่อเข้าของจริงผ่าน gateway ws ทันที

---

## 31) Final Architectural Verdict

## คำตอบที่ตัดจบ
โครงสร้างที่ควรทำคือ:

- **1 Monorepo**
- **1 Mobile-first PWA**
- **3 Surface ในแอปเดียว: Center / Studio / Board**
- **OpenClaw Gateway WebSocket เป็นแกน**
- **Telegram ใช้ bridge/mirror ผ่าน sessions**
- **ClawHub ใช้สำหรับ skills discovery/install**
- **plugin lifecycle ผ่าน sidecar**
- **preset board เท่านั้นใน v1**
- **ไม่แยก 3 โปรเจกต์**
- **ไม่ฝัง Telegram เต็มตัว**
- **ไม่ทำ visual office / pixel office / dashboard builder ตั้งแต่แรก**

นี่คือจุดสมดุลที่ **เร็วสุด**, **เสถียรสุด**, และ **ต่อยอดได้จริง** โดยไม่หลุด scope

---

## 32) Reference Basis (สำหรับ dev อ่านต่อ)

### Official / Primary
- OpenClaw Gateway Protocol  
  https://github.com/openclaw/openclaw/blob/main/docs/gateway/protocol.md

- OpenClaw Telegram Channel Docs  
  https://github.com/openclaw/openclaw/blob/main/docs/channels/telegram.md

- OpenClaw ClawHub Docs  
  https://github.com/openclaw/openclaw/blob/main/docs/tools/clawhub.md

- OpenClaw Plugin Docs  
  https://github.com/openclaw/openclaw/blob/main/docs/tools/plugin.md

- OpenClaw Getting Started  
  https://github.com/openclaw/openclaw/blob/main/docs/start/getting-started.md

- Telegram Widgets  
  https://core.telegram.org/widgets

- Telegram Mini Apps  
  https://core.telegram.org/bots/webapps

### Reference Repos / Inspiration Only
- Mission Control  
  https://github.com/crshdn/mission-control

- OpenClaw bot review  
  https://github.com/xmanrui/OpenClaw-bot-review

- openclaw-desktop  
  https://github.com/rshodoskar-star/openclaw-desktop

- claw-empire  
  https://github.com/GreenSheep01201/claw-empire

- ClawWork  
  https://github.com/HKUDS/ClawWork

- openclaw-office  
  https://github.com/WW-AI-Lab/openclaw-office

- Star Office UI  
  https://github.com/ringhyacinth/Star-Office-UI

- LobsterBoard  
  https://github.com/Curbob/LobsterBoard
