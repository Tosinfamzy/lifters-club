# Plan: Web coaching-profile settings (close the web gap)

> The web app is a read-only analytics + decision-history + onboarding surface. Every athlete-
> preference input the engine now consumes — constraints, grip, permanent substitutions, equipment
> instances, cycle phase — has a **shipped API but no web UI**, so a web-primary user can't tell the
> engine about injuries, swaps, machines, or cycle. This plan adds a **Settings → Coaching Profile**
> area exposing them, all riding on existing endpoints (pure frontend). Within-session live coaching
> is intentionally out of scope (web has no live-logging surface; mobile-only).

## Signed-off (2026-06-20)
Build it, PR by PR, **starting with athlete constraints + grip** (highest value — constraints gate
every engine recommendation). Then permanent substitutions → equipment instances → cycle phase.

## Conventions (verified)
- Settings page: `apps/web/src/app/(app)/settings/page.tsx` — client component, shadcn cards,
  `useApi()` + `useAppUser()`, `toast` (sonner). UI kit has Card/Button/Select/Switch/Label/Input/
  Badge/Dialog (no Checkbox — use toggle chips or Switch).
- API client: `apps/web/src/lib/api.ts` (`ApiClient.request<T>`) + `apps/web/src/lib/use-api.ts`
  (token-wrapped bindings). Mirror `updateUser`.
- Contracts: `GET /api/users/:id/constraints` → `{ data: AthleteConstraints }` (empty default when
  none); `PUT` accepts `athleteConstraintsSchema` (equipment/mobility/grip/injuries/bannedExerciseIds/
  correctivePriorityExerciseIds). Same shape on the server delete-then-insert upsert.

## PR breakdown
- **PR 1 — Constraints + grip** (this PR). The checkbox-style axes + injuries editor:
  - API client: `getConstraints(userId)`, `updateConstraints(userId, data)` + `useApi` bindings.
  - `components/settings/constraints-card.tsx` — self-contained card (loads on mount, own save):
    Equipment (4), Mobility (5), Grip (3) as toggle chips + an Injuries list editor (region + note).
  - **Preserve `bannedExerciseIds` / `correctivePriorityExerciseIds` on save** (round-trip the loaded
    values) — the PUT is delete-then-insert, so omitting them would wipe them. Those two need the
    searchable exercise-picker, deferred to the PR that introduces it (subs reuse it).
  - Render the card on the settings page.
- **PR 2 — Permanent substitutions** + the reusable searchable **exercise-picker** (also unlocks the
  banned/corrective pickers in constraints).
- **PR 3 — Equipment instances** management (per-exercise increment / min / confirmed weight).
- **PR 4 — Cycle phase** (tracksCycle toggle + per-phase override editor; rides on `updateUser`
  preferences).

## Enum → label map (PR 1)
- Equipment: no_barbell→"No barbell", no_machine→"No machines", no_cable→"No cables",
  no_dumbbell→"No dumbbells".
- Mobility: no_overhead→"No overhead", no_wrist_extension→"No wrist extension",
  no_deep_knee_flexion→"No deep knee flexion", no_spinal_loading→"No spinal loading",
  no_lumbar_flexion→"No lumbar flexion".
- Grip: neutral_grip_only→"Neutral grip only", no_pronated→"No pronated (overhand)",
  no_supinated→"No supinated (underhand)".
