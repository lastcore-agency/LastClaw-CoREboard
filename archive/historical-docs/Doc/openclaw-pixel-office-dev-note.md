# OpenClaw Pixel Office - Dev Note

## คำตอบตรง ๆ: ทำได้จริงไหม

**ทำได้จริง** แต่ต้องแยกให้ชัดว่าอะไรคือ **ของจริงในเฟสแรก** และอะไรคือ **simulation layer**

ถ้าจะให้เสร็จเร็วและต่อยอดได้:
- **ทำจริงได้เลย**: หน้า Pixel Office, คลิกตัวละคร, เปิด panel ของ agent, เปลี่ยน model, เปิด/ปิด skills/plugins/tools, แสดง status, health, queue, recent task, chat bridge summary
- **ทำจริงได้แต่ควรเป็น Phase 2**: drag & drop layout editor, pathfinding ซับซ้อน, multiplayer presence แบบ realtime หลายคนแก้พร้อมกัน, animation workflow ลึก, in-room voice/video, live co-editing scene
- **ไม่ควรทำเป็นแกนตั้งแต่แรก**: สร้างระบบเกมเต็มรูปแบบ, physics, free movement แบบ open world, custom map editor ระดับ RPG maker, state machine ซับซ้อนเกินจำเป็น

## ข้อสรุปเชิงระบบ

ฟีเจอร์ "จำลองการทำงานแบบผู้พัฒนาอื่น ๆ" ควรออกแบบเป็น:

1. **Agent Persona Simulation UI**  
   ตัวละครแต่ละตัวแทน 1 agent หรือ 1 role เช่น Backend, QA, DevOps, Research

2. **Clickable Character Control Surface**  
   คลิกที่ตัวละครแล้วเปิด drawer / bottom sheet เพื่อ config agent ได้ทันที

3. **Room-based Status Visualization**  
   แต่ละห้องแทน workflow เช่น Planning / Development / QA / DevOps

4. **Event-driven Animation Layer**  
   ตัวละครไม่ต้องเดินอิสระจริงทั้งหมด ใช้วิธีเปลี่ยน state + position preset + activity badge จะเร็วกว่าและพอใช้งานจริง

สรุปคือ **ทำเป็น command-center visualization ที่หน้าตาเหมือน office simulation** ไม่ใช่ทำเป็นเกม

---

## เป้าหมายที่ dev ต้องเข้าใจ

หน้าฟีเจอร์นี้เป็น **Primary Surface** สำหรับ:
- ดูว่า agent ไหนกำลังทำอะไร
- คลิกเพื่อแก้ config ของ agent
- สั่งงาน agent แบบเร็ว
- ดู health / queue / gateway / task state
- ดู simulation ของทีมในรูปแบบ office pixel

ดังนั้นหน้าจอนี้ต้องเป็นลูกผสมของ:
- dashboard
- agent control panel
- lightweight office simulation

ไม่ใช่หน้าโชว์เฉย ๆ

---

## สถาปัตยกรรมที่ควรใช้

### แนวทางที่แนะนำ

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind + Zustand
- **2D Render Layer**: Phaser 3 หรือ PixiJS
- **Realtime**: Socket.IO หรือ native WebSocket
- **Backend BFF**: Next.js route handlers หรือ NestJS
- **Agent/Gateway Integration**: OpenClaw Gateway API / WS
- **State**:
  - UI state = Zustand
  - server cache = TanStack Query
  - realtime room state = WebSocket store

### ข้อแนะนำสำคัญ

สำหรับงานนี้ **Phaser 3** เหมาะกว่า pure canvas ธรรมดา เพราะ:
- จัด scene / sprite / input ง่าย
- รองรับ clickable entity ดี
- มี camera/zoom/pan พร้อม
- dev ทำ office simulation ได้เร็วกว่า

แต่ห้ามปล่อยให้ Phaser กลืนทั้งแอป

ให้ใช้ pattern นี้:
- App shell, forms, sheets, tabs, settings = React/Next UI ปกติ
- Office map / sprites / click interaction = Phaser canvas island

---

## โครงสร้างระบบที่ควรทำจริง

```text
apps/
  web/
    app/
      (mobile)/
        center/page.tsx
        studio/page.tsx
        board/page.tsx
        office/page.tsx
      api/
        agents/
        gateway/
        plugins/
        telegram/
        office/
    components/
      office/
        office-shell.tsx
        office-canvas.tsx
        office-toolbar.tsx
        office-legend.tsx
        character-sheet.tsx
        room-chip.tsx
        task-badge.tsx
        status-pill.tsx
      agent/
        agent-config-sheet.tsx
        agent-model-select.tsx
        agent-plugin-switches.tsx
        agent-skill-list.tsx
        agent-chat-preview.tsx
      system/
        gateway-health-card.tsx
        queue-card.tsx
        event-feed.tsx
    lib/
      office/
        office-scene.ts
        office-sprites.ts
        office-layout.ts
        office-events.ts
        office-presence.ts
      api/
        agents.ts
        gateway.ts
        plugins.ts
      store/
        ui-store.ts
        office-store.ts
        agent-store.ts
      types/
        office.ts
        agent.ts
        gateway.ts

packages/
  ui/
  shared/
  sdk/

services/
  gateway-bridge/
  telegram-bridge/
  plugin-runtime/
  simulation-engine/

assets/
  tilesets/
  sprites/
  avatars/
  maps/
```

---

## Tree แบบ functional

```text
OpenClaw Pixel Office
├── App Shell
│   ├── Bottom Navigation
│   ├── Top Status Bar
│   └── Global Command Drawer
│
├── Office Screen
│   ├── Office Header
│   │   ├── Workspace Selector
│   │   ├── Live Status
│   │   ├── Zoom Control
│   │   └── Filter Agents / Rooms
│   │
│   ├── Pixel Office Canvas
│   │   ├── Rooms
│   │   │   ├── Planning
│   │   │   ├── Development
│   │   │   ├── Testing & QA
│   │   │   ├── DevOps
│   │   │   └── Break Room
│   │   ├── Characters
│   │   │   ├── Agent Avatar
│   │   │   ├── Status Dot
│   │   │   ├── Task Bubble
│   │   │   └── Click Target
│   │   └── Live Decorations
│   │       ├── Monitor State
│   │       ├── Alert Beacon
│   │       └── Queue Badge
│   │
│   ├── Character Action Sheet
│   │   ├── Overview Tab
│   │   ├── Configure Tab
│   │   ├── Skills/Plugins Tab
│   │   └── Chat/Logs Tab
│   │
│   └── System Panels
│       ├── Gateway Health
│       ├── Queue State
│       ├── Recent Events
│       └── Telegram Bridge Preview
│
├── Agent Domain
│   ├── Agent Profiles
│   ├── Agent Runtime State
│   ├── Agent Model Config
│   ├── Agent Tools/Plugins/Skills
│   └── Agent Task Feed
│
├── Simulation Domain
│   ├── Room Mapping
│   ├── Character Placement
│   ├── Activity State Renderer
│   ├── Animation Presets
│   └── Presence Sync
│
└── Integration Domain
    ├── OpenClaw Gateway
    ├── Telegram Bridge
    ├── ClawHub Registry
    └── Plugin Runtime
```

---

## วิธีทำให้ “คลิกตัวละครได้” แบบใช้ได้จริง

### Interaction model

เมื่อแตะตัวละคร:
- เปิด **bottom sheet** บนมือถือ
- โชว์ข้อมูล agent นั้นทันที
- มี 4 แท็บ:
  - Overview
  - Configure
  - Skills
  - Logs/Chat

### ข้อมูลใน Character Sheet

```text
Character Sheet
├── Avatar + Name + Status
├── Role / Team / Room
├── Current Task
├── Current Model
├── Health / Latency / Queue Position
├── Quick Actions
│   ├── Start
│   ├── Pause
│   ├── Restart
│   ├── Reassign Room
│   └── Open Full Config
├── Model Config
│   ├── Provider
│   ├── Model
│   ├── Temperature
│   ├── Max Tokens
│   └── Routing Preset
└── Skills / Plugins / Tools
    ├── Web Search
    ├── File Reader
    ├── Telegram Bridge
    ├── ClawHub Extension
    └── Custom Plugins
```

นี่คือแกนหลักที่ทำได้จริงและตรงความต้องการที่สุด

---

## หลักการจำลอง “ผู้พัฒนาอื่น ๆ” ที่ไม่หลอกและไม่บาน

ไม่ควรทำให้เหมือน NPC AI ซับซ้อนตั้งแต่วันแรก

ให้ใช้โมเดลนี้แทน:

### 1) Agent State
- idle
- thinking
- coding
- testing
- deploying
- reviewing
- blocked
- offline

### 2) Room Assignment
- planning room
- dev room
- qa room
- devops room
- lounge

### 3) Visual Mapping
- ถ้า state = coding -> แสดงนั่งโต๊ะ dev
- ถ้า state = testing -> ย้ายไปห้อง QA preset
- ถ้า state = deploying -> อยู่ DevOps + badge “Deploying”
- ถ้า blocked -> bubble สีแดง / warning icon
- ถ้า offline -> sprite จาง + status gray

### 4) Event Source
- มาจาก gateway event จริง
- ถ้าไม่มี event จริง ใช้ simulation rule fallback

ดังนั้นการ “จำลอง” จะเป็น **state visualization** มากกว่า AI เดินมั่ว ๆ

---

## Data model ที่ dev ควรใช้

```ts
export type AgentState =
  | 'idle'
  | 'thinking'
  | 'coding'
  | 'testing'
  | 'deploying'
  | 'reviewing'
  | 'blocked'
  | 'offline'

export interface OfficeCharacter {
  id: string
  agentId: string
  name: string
  role: 'backend' | 'frontend' | 'qa' | 'devops' | 'research'
  roomId: string
  state: AgentState
  avatarKey: string
  model: string
  health: 'healthy' | 'warning' | 'critical'
  latencyMs: number
  queueCount: number
  currentTask?: string
  plugins: Array<{
    key: string
    enabled: boolean
  }>
}

export interface OfficeRoom {
  id: string
  label: string
  type: 'planning' | 'development' | 'qa' | 'devops' | 'lounge'
  x: number
  y: number
  width: number
  height: number
}
```

---

## API contracts ที่ควรมี

### Read office state

```http
GET /api/office/state
```

response:

```json
{
  "workspace": "main",
  "gateway": {
    "status": "online",
    "latencyMs": 24,
    "cpu": 18,
    "memory": 52,
    "queue": 3
  },
  "rooms": [],
  "characters": [],
  "events": []
}
```

### Update character/agent config

```http
PATCH /api/agents/:id/config
```

### Toggle plugin

```http
POST /api/agents/:id/plugins/:pluginKey/toggle
```

### Move room assignment

```http
POST /api/office/characters/:id/move-room
```

### Realtime stream

```text
WS /api/office/stream
```

events:
- `agent.updated`
- `agent.task.changed`
- `agent.state.changed`
- `agent.plugin.toggled`
- `gateway.health.updated`
- `office.character.moved`
- `telegram.message.received`

---

## สิ่งที่ dev ต้องทำในหน้า Office

## Layout

### Mobile-first
- ด้านบน: title + gateway status + live dot
- ใต้ลงมา: status cards 3-4 ใบ
- ตรงกลาง: office canvas
- ด้านล่าง: sticky tab bar
- interaction ทุกอย่างใช้ bottom sheet

### Tablet/Desktop
- ซ้าย: office canvas
- ขวา: selected character panel

---

## Behavior spec

### คลิกตัวละคร
- highlight sprite
- center camera เบา ๆ
- เปิด bottom sheet
- fetch หรือ bind agent data

### คลิกห้อง
- filter agents ในห้องนั้น
- โชว์ room status
- โชว์ load / queue / task count ของห้อง

### คลิก task bubble
- เปิด task detail
- ดู log ล่าสุด
- jump ไป board/studio ได้

### กด configure
- แก้ model
- ปรับ temperature/max tokens
- เปิด/ปิด skills/plugins/tools
- save แล้ว sync กลับ gateway

---

## ข้อจำกัดที่ต้องแจ้ง dev ตรง ๆ

### ทำได้จริง
- click avatar
- popup config
- room-based simulation
- live status update
- plugin toggles
- model switch
- telegram preview/chat hook

### ทำได้แต่ไม่ควรยัดใน v1
- drag character freely around map
- collision/pathfinding เต็มระบบ
- multi-user room editing พร้อมกัน
- custom tile editor ในแอป
- live scripted behavior generator ต่อ character

### ไม่ควรทำเป็น requirement หลัก
- เกมเดินได้ทั้ง office แบบ RPG
- ระบบ NPC ซับซ้อนจาก LLM ทุกตัว
- simulation ที่ผูกกับ physics / economy / crafting / inventory

---

## MVP ที่แนะนำที่สุด

### MVP scope

```text
MVP Pixel Office
├── 1 static office map
├── 4-8 clickable characters
├── 4 rooms
├── status badge per character
├── bottom sheet config per character
├── model switching
├── skill/plugin/tool toggles
├── gateway health cards
├── recent events
└── basic realtime updates
```

นี่คือเวอร์ชันที่ **ทำได้จริงเร็วสุด** และยังขายภาพ “ทีม agent ทำงานใน office” ได้ครบ

---

## Phase plan ที่ไม่ทำให้แตก

### Phase 1
- static map
- clickable characters
- bottom sheet config
- realtime state sync
- health/status cards

### Phase 2
- room switching animation
- agent task bubbles
- mini logs/chat preview
- telegram bridge in board panel

### Phase 3
- layout presets
- office themes
- scene packs
- advanced room rules

### Phase 4
- collaborative supervisor mode
- custom office editor
- scripted automation scenes

---

## ข้อเสนอ implementation สำหรับ dev

### Character rendering
- ใช้ sprite sheet 32x32 หรือ 48x48
- idle animation 2-4 frames พอ
- ไม่ต้องเยอะ

### Map rendering
- ใช้ tiled JSON map หรือ hardcoded room rectangles ก่อน
- ถ้าต้องรีบมาก ใช้ background image + clickable overlays ได้เลย

### Best fast path

ลำดับที่เร็วที่สุดคือ:
1. ใช้ภาพ office background 1 รูป
2. วาง character sprite เป็น interactive hotspots
3. bind hotspot เข้ากับ agent จริง
4. เปิด config sheet จาก hotspot
5. ค่อยย้ายไป tile-based map ทีหลัง

นี่คือทางที่เร็วสุดและเสี่ยงต่ำสุด

---

## Acceptance criteria

dev ถือว่างานนี้ “เสร็จใช้ได้” เมื่อ:

- ผู้ใช้แตะตัวละครแล้วเปิด config agent ได้
- เปลี่ยน model ได้จากตัวละคร
- เปิด/ปิด skills/plugins/tools ได้จากตัวละคร
- เห็น state ของแต่ละ agent แบบชัดเจน
- ห้องต่าง ๆ สื่อว่าใครกำลังทำงานประเภทไหน
- status ของ gateway / queue / health อัปเดตสด
- หน้าใช้งานบนมือถือได้จริง
- office view ไม่ทำให้เครื่องช้าเกินไป

---

## คำสั่งสุดท้ายถึง dev

ให้สร้างฟีเจอร์นี้เป็น:

> **Pixel Office Command Surface**

ไม่ใช่เกม, ไม่ใช่แค่ dashboard, แต่เป็น **interactive agent control UI**

ลำดับการตัดสินใจที่ถูกต้องคือ:
- เอา interaction ที่ใช้ควบคุมงานได้ก่อน
- เอา simulation ที่สื่อสถานะได้จริงก่อน
- ตัดทุกอย่างที่เป็นของเล่นออกจาก v1

---

## Tree สุดท้ายที่แนะนำให้ส่ง dev

```text
feature/pixel-office/
├── page.tsx
├── office-shell.tsx
├── office-header.tsx
├── office-canvas.tsx
├── office-phaser-scene.ts
├── office-room-overlay.tsx
├── office-character-sprite.tsx
├── office-status-strip.tsx
├── office-event-feed.tsx
├── office-zoom-controls.tsx
├── office-filter-bar.tsx
├── character-sheet/
│   ├── index.tsx
│   ├── character-overview-tab.tsx
│   ├── character-configure-tab.tsx
│   ├── character-skills-tab.tsx
│   ├── character-logs-tab.tsx
│   └── character-quick-actions.tsx
├── hooks/
│   ├── use-office-state.ts
│   ├── use-office-stream.ts
│   ├── use-selected-character.ts
│   └── use-agent-config.ts
├── services/
│   ├── office-api.ts
│   ├── office-ws.ts
│   ├── office-mapper.ts
│   └── office-simulation.ts
├── types/
│   ├── office.ts
│   ├── agent.ts
│   └── gateway.ts
└── assets/
    ├── office-map.png
    ├── sprite-sheet.png
    └── room-overlays.json
```

