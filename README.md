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

**Electrical**
- **Conduit fill**: count your wires with +/− buttons; get the smallest EMT, or check a pipe you picked (NEC Ch. 9)
- **Voltage drop / wire size**: recommends a wire that handles both the amps and the distance, with 125% for continuous loads
- **Box fill**: counts wires, devices, clamps, grounds and studs; checks your box (NEC 314.16)

**Measuring**
- **Feet-inches calculator**: `7' 5-3/8" - 2' 11-3/4"`, `10' / 2`, `14-1/2 x 3`

**Job**
- **Material list**: one EMT run → sticks, couplings, connectors, straps (NEC 358.30 spacing), wire footage; warns over 360° of bends
- **Save to a job**: every result has a "Save to a job" button with a location ("Run to panel B"); reopen it later with the same inputs
- **Daily reports**: date, hours, work done, materials (one tap pulls in today's material lists), issues, plan for tomorrow; send by share sheet, copy or email
- Jobs are stored on the device (localStorage), so everything works offline

- Every tool: numbered questions, marks drawn on the pipe, "How to bend it" steps, and "Show me the math"
- **Tape-measure input**: type lengths the way you'd say them: `7' 5-3/8"`, `5 3/8`, `7ft 5in`

### Next
- Installable, offline PWA + live site (GitHub Actions CI/CD)

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
    electrical.ts conduit fill, voltage drop / wire size, box fill (NEC table data)
    tape.ts       feet-inches calculator
    materials.ts  material takeoff for an EMT run
    jobs.ts       jobs, saved calcs, daily reports (pure functions) + saving to the device
    tools.ts      each tool's questions + which math to run
  components/
    ToolScreen.tsx  one reusable screen that runs any tool in tools.ts
    ui.tsx          shared pieces (question cards, answers, pipe-marks drawing)
    JobsScreen.tsx  job list, job detail, daily report form
    SaveToJob.tsx   the "Save to a job" button/form
    useJobStore.ts  custom hook: load jobs on start, save on every change
  App.tsx       app layout
```
