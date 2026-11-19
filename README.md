# Electrical Job Toolkit

A jobsite app for electricians: bending calculators that **show their work**, plus
project and crew management with team chat.

> Learning aid only. Always double-check against your bender chart, the code book and your foreman.

## Features

### Now
- **Offset**: any angle; where the offset starts, distance between bends, shrink, labeled drawing
- **Offset chart**: multipliers and shrink for every common angle, worked out for your depth
- **3-point saddle** (45°/22.5° or 60°/30°)
- **4-point saddle**
- **Rolling offset** (true offset + how far to roll the pipe)
- **90° stub-up** with take-up for 1/2"–1-1/4" EMT benders
- **Back-to-back 90s**
- **Kick**
- Every tool: numbered questions, marks drawn on the pipe, "How to bend it" steps, and "Show me the math"
- **Tape-measure input**: type lengths the way you'd say them: `7' 5-3/8"`, `5 3/8`, `7ft 5in`

### Next
- Feet-inches-fractions calculator
- Installable, offline PWA
- Voltage drop, box fill, conduit fill

### Phase 2: Projects & crews (Spring Boot backend)
- **Projects** with a chain of command:
  - Project Managers (several per project)
  - General Foremen (each over a floor or area)
  - Foremen (each leads a team)
  - Crew members (assigned to a foreman's team)
- Role-based permissions (e.g. only PMs create areas; GFs assign foremen; foremen manage their crew)
- **Team group chats**, live over WebSockets
- Saved calculations and notes shared with your team

## Tech stack
| Part | Choice |
|---|---|
| Frontend | React + Vite (TypeScript), offline PWA |
| Styling | Tailwind CSS |
| Testing | Vitest |
| CI/CD | GitHub Actions |
| Backend (phase 2) | Java Spring Boot, PostgreSQL, WebSockets |

## Running it locally
```bash
npm install      # download dependencies (first time only)
npm run dev      # start the app at http://localhost:5173
npm test         # run the unit tests
```

## How the code is organized
```
src/
  lib/          pure math, no UI; every function here has tests
    measure.ts    parse/format tape-measure lengths
    offset.ts     offset bending math + offset chart
    bends.ts      saddles, rolling offset, stub-ups, back-to-back, kick
    tools.ts      each tool's questions + which math to run
  components/
    ToolScreen.tsx  one reusable screen that runs any tool in tools.ts
    ui.tsx          shared pieces (question cards, answers, pipe-marks drawing)
  App.tsx       app layout
```
