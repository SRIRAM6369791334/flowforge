# FlowForge — Stage 2: UI/UX & Emerald Design System Audit

> **Scope**: Usability evaluation, visual design audit, component density assessment, and comparison against the approved **Emerald High-Precision Studio** reference mockups.  
> **Source Files**: `src/app/page.tsx:122-2260`, `src/components/CanvasNode.tsx`, `src/components/Inspector.tsx`, `src/components/QueueDashboard.tsx`.  
> **Visual Reference Artifacts**: `flowforge_neo_dashboard_1794382614085.jpg`, `flowforge_neo_precision_canvas_1794382644795.jpg`.

---

## 1. Usability & Layout Audit Findings

| Defect ID | Severity | Component | Issue Description | User Impact |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-UI-01** | **HIGH** | Header Bar (`page.tsx:1219-1352`) | Button collision: "Auto-Parallel W Layout" overlaps "Secrets Vault" and "Telegram Bot Listener" on viewports < 1600px. | Buttons become unclickable or visually garbled. |
| **DEF-UI-02** | **HIGH** | Canvas & Nodes (`CanvasNode.tsx:25-90`) | Low-contrast murky dark theme (`bg-[#0b0f17]`), missing execution glow, misaligned connection handles. | Unattractive, clumsy appearance as flagged in user feedback. |
| **DEF-UI-03** | **LOW** | Inspector (`Inspector.tsx:85-160`) | Multi-line JSON properties rendered in cramped single-line input boxes without syntax highlighting. | Error-prone parameter entry for complex payloads. |
| **DEF-UI-04** | **LOW** | Telemetry Dock (`page.tsx:1500-1650`) | Bottom dock takes fixed 340px vertical space, leaving insufficient canvas height on 1080p laptops. | Cluttered workspace requiring excessive zooming and scrolling. |

---

## 2. Visual Comparison: Current UI vs. Emerald Design Reference

```
┌───────────────────────────────┬────────────────────────────────────────┐
│ CURRENT IMPLEMENTATION        │ EMERALD DESIGN REFERENCE (TARGET)      │
├───────────────────────────────┼────────────────────────────────────────┤
│ • Flat dark gray background   │ • Deep obsidian slate (#070a0e) with   │
│   (#0b0f17) with faint lines  │   crisp emerald dot grid (#10b98115)   │
│ • Static node cards with thin │ • Chamfered cards with emerald glow    │
│   unaccented borders          │   borders (#10b981) on active waves    │
│ • Overlapping top action bar  │ • High-density responsive toolbar with │
│   buttons                     │   icon tooltips & grouping             │
│ • Plain gray edge connectors  │ • Animated neon pulse bezier curves    │
│ • Fixed 340px bottom dock     │ • Collapsible 3-state slide dock       │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## 3. Detailed UI Defect Profiles

### 3.1 Top Header Collision (DEF-UI-01)
- **Code Reference**: `src/app/page.tsx:1219-1352`
- **Root Cause**: The header uses a static `flex items-center gap-3` container with multiple text-heavy buttons ("Telegram Bot Listener", "Secrets Vault", "Auto-Parallel W Layout", "Execute Workflow", "AI Workflow Builder"). On laptops and standard monitors, the total width exceeds available viewport width, causing buttons to stack or collide with the canvas title.
- **Remediation**:
  1. Group secondary utilities (Secrets, Telegram, Form links) into an icon rail.
  2. Reserve primary text buttons exclusively for **"Execute Workflow"** and **"AI Builder (⌘K)"**.
  3. Apply `flex-shrink-0` and responsive `@media` query breakpoints.

---

### 3.2 Canvas & Custom Node Polish (DEF-UI-02)
- **Code Reference**: `src/components/CanvasNode.tsx:25-90`
- **Root Cause**: Nodes render using generic Tailwind classes (`bg-slate-900 border border-slate-700`). When a node is actively running or succeeds, only a subtle green border is applied without animated wave indicator pulses.
- **Remediation**:
  1. Upgrade `CanvasNode.tsx` with glowing emerald accent borders:
     `border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)]`.
  2. Display clear execution wave badges: `wave 1 (12ms)`.
  3. Ensure left/right handles use precision crosshair alignment with SVG connection halos.

---

### 3.3 Bottom Telemetry Dock Responsiveness (DEF-UI-04)
- **Code Reference**: `src/app/page.tsx:1500-1650`
- **Root Cause**: The dock has a fixed height when opened, taking up nearly 50% of vertical screen space on standard 13-inch and 15-inch displays.
- **Remediation**:
  1. Provide a 3-way toggle: `Collapsed (36px bar)` | `Compact (180px)` | `Expanded (360px)`.
  2. Add keyboard shortcut `⌘J` or `Ctrl+\`` to instantly collapse or expand the dock.
