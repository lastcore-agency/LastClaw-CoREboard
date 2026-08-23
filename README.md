# LastClaw Board

> **Human control surface for a real AI workforce.**  
> LastClaw Board turns runtime state, agents, sessions, workspaces, channels, chat and diagnostics into a visual operating interface that a human can actually use.

**Current stable release:** `v0.4.0`  
**Canonical branch:** `main`  
**Stable commit:** `49600292f592e908a2937fa6c43da26dae711a47`

---

## 1. What this project is

LastClaw Board is a **visual control and work interface** that sits above an agent runtime.

The current production-backed implementation connects to **OpenClaw** through a server-side Runtime Adapter. The browser does not speak directly to the OpenClaw Gateway and does not receive Gateway credentials.

```text
Browser / Mobile
      │
      ▼
LastClaw Board
UI + Server API
      │
      ▼
Runtime Adapter
      │
      ▼
OpenClaw Gateway
      │
      ├── Agents
      ├── Sessions
      ├── Channels
      ├── Workspaces
      ├── Tools
      └── Model execution
```

The current repository proves the Board against a real OpenClaw deployment first. The UI is being kept separate from raw OpenClaw-specific payloads so that a future runtime can be connected through another adapter instead of rebuilding the Board.

> **Design principle:** the Board is not the Runtime, and the Runtime is not the Board.

---

## 2. Product goal

The long-term goal is not to build another runtime inspector.

The Board should let a business owner or operator work with an AI team in human terms:

```text
Select Team / Agent
      ↓
Give Objective
      ↓
See Current Work
      ↓
Redirect / Approve / Stop
      ↓
Receive Result + Evidence
      ↓
Review Learning
```

Technical runtime details still matter, but they belong behind the operational experience rather than being the primary product.

For the current version, LastClaw Board focuses on proving truthful runtime integration and a usable Visual Office.

---

## 3. Current status — v0.4.0

`v0.4.0` is the clean stable baseline after the Modern Motion V3 work and repository cleanup.

### Implemented now

- Visual Office with the current SiX-SQUAD presentation pack
- real runtime-backed agent discovery
- canonical presentation mapping such as runtime `main` → presentation `sirius`
- Gateway health and `LIVE` / `CACHED` / stale semantics
- agent session counts from runtime truth
- real channel/account telemetry
- Agent Inspector
- Chat workroom and native LastClaw sessions
- server-side `chat.send` path to OpenClaw
- safe server-side transcript reading/fallback
- Studio / workspace access
- Diagnostics
- SSE/event bridge for runtime activity
- communication bubbles driven by real normalized events
- responsive desktop/mobile Visual Office
- production build and Linux VM deployment
- server-side credential isolation and redaction
- tests for runtime normalization, identity mapping, channels, delivery queue and security-sensitive fields

### Explicitly not treated as implemented

The following are direction / future work, not claims about `v0.4.0`:

- SiX Harness runtime
- HarnessAdapter
- ten-team LastBoss organization control
- complete Approval workflow engine
- governed T-MEM promotion UI
- generic multi-runtime deployment
- automatic cross-team learning
- full business-outcome workflow engine

README sections labelled **Future Direction** describe architecture intent only.

---

## 4. Runtime truth rules

LastClaw must not make the interface look healthier or busier than the runtime actually is.

### Core rules

```text
0       = verified zero
UNKNOWN = unknown / not exposed / insufficient evidence
OFFLINE = runtime evidence says offline
LIVE    = current runtime source
CACHED  = last known safe state, not current truth
```

### Important distinctions

- `UNKNOWN` is **not** `OFFLINE`.
- Channel connection is **not** agent activity.
- Session existence is **not** proof that an agent is working now.
- Heartbeat disabled is informational; it is not an offline signal.
- A delivery queue warning does not automatically make Gateway health fail.
- LastClaw does not invent task names, dialogue, activity or assistant responses.
- Runtime/presentation identity mapping must preserve the real runtime ID.

The visual layer consumes normalized Board state; components should not infer live runtime truth independently.

---

## 5. Current OpenClaw architecture

OpenClaw's Gateway is the runtime control plane and is treated as the source of truth for sessions, routing and channel connections.

The expected same-host deployment is:

```text
Phone / Mac / Browser
        │
        │ Tailscale / private access
        ▼
six-squad VM
        │
        │ :3001
        ▼
LastClaw Board
        │
        │ server-side only
        ▼
OpenClaw Runtime Adapter
        │
        │ ws://127.0.0.1:18789
        ▼
OpenClaw Gateway
```

### Ports

| Port | Purpose |
|---|---|
| `3001` | LastClaw Board web/API service |
| `18789` | OpenClaw Gateway default WebSocket/control surface |

The browser should never need the OpenClaw Gateway token.

When LastClaw and OpenClaw run on the same VM, the Gateway should normally remain loopback-first:

```env
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

Remote users access **LastClaw**, not the raw Gateway.

---

## 6. Runtime Adapter boundary

OpenClaw-specific code belongs behind the Runtime Adapter.

Conceptually:

```text
OpenClaw raw payload
      ↓
OpenClawAdapter
      ↓
Normalized Board Contract
      ↓
UI
```

The UI should consume normalized objects such as:

```text
Agent
Session
Channel
Health
Work
Event
Result
```

and should not depend on:

```text
raw Gateway JSON
OpenClaw RPC message shape
filesystem session paths
Gateway secrets
hardcoded runtime IDs
presentation aliases embedded inside UI components
```

This boundary is important because the next runtime should be added by implementing another adapter, not by rewriting the Visual Office.

---

## 7. Identity and presentation

The real runtime identity and the presentation identity are separate concepts.

Example:

```text
runtimeAgentId: main
presentationId: sirius
channelAccountId: sirius
```

The runtime ID must be preserved for commands, sessions, diagnostics and evidence.

Presentation metadata may provide:

- display name
- role
- character asset
- room placement
- channel account association
- UI labels

Do not globally hardcode `main → sirius` in generic runtime code. Mapping belongs in presentation/runtime configuration.

---

## 8. Visual Office

The Visual Office is the main human-facing surface of the current Board.

### Current responsibilities

- render the real team presentation
- reflect truthful normalized runtime state
- let the user select an agent
- expose agent work surfaces
- show real activity/messages when available
- preserve desktop/mobile responsiveness
- keep technical runtime detail behind the primary interaction

### UX direction

The desired interaction is:

```text
Tap Agent
   ↓
Current Work
   ↓
[Command]
[Redirect]
[Run Flow]
[Workspace]
[Model]
[Latest Result]
[Learning]
[Advanced]
```

The owner should not need to understand session keys, runtime IDs, heartbeat internals or channel transport details for routine work.

---

## 9. Agent Inspector

The Inspector is the bridge between simple human-facing work controls and deeper runtime information.

Primary information should answer:

- Who is this agent?
- What role does it have?
- What is it doing?
- What can I ask it to do?
- What result did it produce?

Advanced/diagnostic information may include:

- runtime agent ID
- session count
- Gateway state
- channel telemetry
- model
- workspace
- heartbeat
- diagnostics

Runtime information must come from the shared normalized Runtime state rather than isolated mock fields.

---

## 10. Chat

LastClaw Chat is an internal work surface.

The intended path is:

```text
User
 ↓
LastClaw Chat
 ↓
Server API
 ↓
OpenClawAdapter
 ↓
Gateway chat.send
 ↓
Agent / Model Provider
 ↓
real response
 ↓
normalized response / transcript
 ↓
LastClaw timeline
```

### Truth rule

LastClaw does **not** manufacture an assistant answer when the runtime/model provider did not return one.

A successful send and a successful assistant response are separate facts.

For example:

```text
CHAT_REQUEST_ACCEPTED = true
MODEL_PROVIDER_FAILURE = true
ASSISTANT_RESPONSE_CREATED = false
```

is a valid truthful state.

---

## 11. Events and Office activity

Runtime events are normalized server-side before reaching the browser.

```text
Gateway event
    ↓
Server normalization
    ↓
SSE / Board event
    ↓
Visual Office / Chat / Diagnostics
```

The UI may show:

- runtime activity
- safe real message text
- tool/result state
- connection changes

The UI must not create scripted dialogue merely to make the Office look alive.

---

## 12. Workspace and memory access

Workspace access is server-side and restricted.

Expected OpenClaw home:

```env
OPENCLAW_HOME=/home/lastcore/.openclaw
```

Workspace requests must resolve to approved runtime workspace roots.

Security requirements include:

- reject path traversal
- reject arbitrary absolute paths
- do not expose `.env`, credentials or secret runtime state
- do not let the browser select arbitrary transcript files
- resolve transcript/workspace locations from validated runtime/session records

B-MEM and T-MEM are product/domain concepts and are not equivalent to exposing the runtime filesystem directly.

---

## 13. Security model

### Never expose Gateway secrets to the browser

Correct:

```text
Browser
  ↓
LastClaw API
  ↓
Gateway token used server-side
  ↓
OpenClaw
```

Incorrect:

```text
Browser
  ↓
Gateway directly with token
```

Do not place Gateway credentials in any browser-exposed `VITE_*` variable.

### Additional rules

- redact credentials from API responses
- redact hidden reasoning/system prompts where applicable
- validate workspace paths
- normalize transcript content server-side
- limit transcript size/message count
- do not commit `.env`, auth profiles, logs or runtime databases
- do not use `git add -A` during cleanup/deployment work

---

## 14. Repository layout

The current implementation is intentionally kept obvious at repository root.

```text
src/                    Frontend application
server/                 LastClaw server/API + runtime integration
public/                 Active production visual assets
docs/                   Current implementation documentation
archive/                Historical specs and legacy assets
index.html               Vite entry
vite.config.ts           Vite configuration
tsconfig*.json           TypeScript configuration
package.json             Scripts/dependencies
package-lock.json        Reproducible dependency lock
```

Historical/reference material is moved to `archive/` rather than mixed with active implementation.

See:

```text
docs/CURRENT-IMPLEMENTATION.md
archive/README.md
```

for the current/legacy boundary.

---

## 15. Development

### Requirements

Use a Node version compatible with the current repository and OpenClaw deployment.

The current OpenClaw documentation recommends Node 24, with Node 22.14+ as a compatibility baseline.

### Install

```bash
npm ci
```

### Run tests

```bash
npm test
```

### Production build

```bash
npm run build
```

The production build covers both the Vite frontend and the TypeScript API/server build.

### Local development

The repository has separate web/API development scripts. Check `package.json` for the current exact script names before changing process topology.

Common development flow used by this project:

```bash
npm run dev:api
npm run dev:web
```

Do not change runtime/Gateway ports merely to make a local UI test convenient.

---

## 16. Production deployment

Current reference deployment:

```text
Host: six-squad
OS: Linux / GCP VM
OpenClaw service: openclaw-gateway.service
LastClaw service: lastclaw-coreboard.service
LastClaw port: 3001
Gateway port: 18789
```

Typical verification:

```bash
systemctl --user is-active openclaw-gateway.service
systemctl --user is-active lastclaw-coreboard.service

curl -fsS http://127.0.0.1:18789/healthz
curl -fsS http://127.0.0.1:3001/api/runtime/health
```

A healthy Gateway alone is not proof that every Board control path works. Validate the specific path being changed: agents, chat, workspace, channels, events, etc.

---

## 17. Validation checklist

Before considering a change ready:

```bash
npm test
npm run build
git diff --check
git status --short
```

For runtime-facing changes also verify against the real VM:

- Board service is active
- Gateway is live
- `/api/runtime/health` is truthful
- real agents are discovered
- identity mapping is correct
- no secrets appear in browser/API payloads
- mobile and desktop UI still render
- commands reach the intended runtime agent
- provider/runtime failures remain distinguishable from Board failures

Do not mark an SSE/message feature as proven from a generic connection event alone.

---

## 18. Version history

| Version | Commit | Milestone |
|---|---|---|
| `v0.1.0` | `d874882` | Pixel Office origin baseline |
| `v0.2.0` | `8e99d8c` | Command Center shell |
| `v0.3.0` | `01f1588` | OpenClaw Runtime Adapter |
| `v0.4.0` | `4960029` | Modern Motion V3 clean baseline |

Historical tag retained:

```text
pixel-office-origin-v0.1.0
```

### Branch policy

```text
main
= latest approved stable version

dev/next
= next integration line

feature/*
= isolated feature work

fix/*
= isolated bug fixes
```

A version is represented by a Git tag/release, not by a long-lived UI branch name.

---

## 19. Historical naming note

The repository name:

```text
LastClaw-CoREboard
```

and the Linux service name:

```text
lastclaw-coreboard.service
```

are historical identifiers.

The current product discussed in this repository is **LastClaw Board**.

Do not infer a separate architectural subsystem from the old `coreboard` naming.

---

## 20. Preserved experimental work

`feature/flow-presence` contains unique experimental work that was intentionally preserved instead of automatically merging into stable `main`.

It must be reviewed before reuse.

Do not assume an old branch is newer or more correct because its name contains `v2`, `v3`, `flow`, `command-center`, etc. Git ancestry, tests and runtime evidence are authoritative.

---

## 21. Future direction — Board-Luna / runtime-neutral Board

The future architecture should keep the same human-facing Board while allowing a different runtime underneath.

```text
                    Board
                      │
                      ▼
             Board Runtime Contract
                      │
           ┌──────────┴──────────┐
           │                     │
           ▼                     ▼
   OpenClawAdapter         HarnessAdapter
       CURRENT                FUTURE
           │                     │
           ▼                     ▼
      OpenClaw              SiX Harness
```

Principle:

> **Design for Harness. Implement against OpenClaw first. Keep UI runtime-agnostic.**

Visual Office should be reused. Runtime wiring should be replaceable.

---

## 22. Future direction — LastBoss Command Board

The next product-level evolution is an organization control surface rather than a runtime dashboard.

Target top-level worlds:

```text
TEAMS
WORK
COMMAND
APPROVAL
T-MEM
```

Target flow:

```text
Last Boss
   ↓
Choose Team
   ↓
Assign Objective
   ↓
See Progress
   ↓
Approve / Redirect
   ↓
Result + Evidence
   ↓
Learning Candidate
   ↓
T-MEM Review / Promotion
```

This is future direction. It is not a claim that these capabilities are complete in `v0.4.0`.

---

## 23. T-MEM direction

Team learning should not automatically become global memory.

Desired governance:

```text
Work
 ↓
Evidence
 ↓
Learning Candidate
 ↓
Distillation
 ↓
Human Review
 ↓
T-MEM
 ↓
Scoped Distribution
```

No evidence means the information should not be promoted as trusted organizational memory.

Future T-MEM tooling should support:

- scope
- versioning
- promotion
- rejection
- rollback
- targeted distribution
- evidence links

---

## 24. Design principles

### Truth over appearance

Never fake health, activity, dialogue or work just to make the Board look active.

### Outcome before diagnostics

The primary interface should help a human get work done. Runtime internals belong under Advanced/Diagnostics.

### Runtime-independent UI

Visual Office and business workflows consume normalized contracts, not OpenClaw internals.

### Server-side secrets

The browser is never a trusted holder of Gateway credentials.

### Evidence before learning

A completed action is not automatically reusable organizational knowledge.

### Archive, do not destroy

Historical work stays available without polluting the active implementation surface.

---

## 25. Reference documents

Current repository documentation:

```text
docs/CURRENT-IMPLEMENTATION.md
archive/README.md
```

Official OpenClaw documentation used as the runtime reference includes the project copies of:

```text
docs/index.md
docs/network.md
docs/logging.md
docs/pi.md
```

Key runtime assumptions in this README should remain aligned with the official OpenClaw documentation rather than inferred from UI behavior.

---

## 26. Summary

LastClaw Board `v0.4.0` is the clean OpenClaw-backed baseline.

Today it proves:

```text
Real Runtime
    ↓
Truthful Adapter
    ↓
Normalized Board State
    ↓
Visual Office / Chat / Studio / Diagnostics
    ↓
Human Control
```

The next step is not to turn the Board into a larger OpenClaw dashboard.

The next step is to keep the verified runtime boundary, preserve the Visual Office, and move the human experience upward toward:

```text
Team
Work
Command
Approval
Result
Evidence
Learning
```

while keeping the runtime replaceable underneath.
