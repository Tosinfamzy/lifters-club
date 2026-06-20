# Plan: Issue 4 Phase B — Mobile in-session live coaching UI

> Phase A shipped `calculateWithinSessionAdjustment` + `POST /api/decisions/within-session`, but no user
> can trigger it. Phase B is the **mobile live-coach surface** — the clearest expression of the
> "live coach, not a tracker" thesis ([project-coaching-direction]). Companion to
> [issue-4-within-session.md](issue-4-within-session.md) (Phase A).

## Signed-off decisions (2026-06-20)
- **Built after the Issue 5 backend opener.**
- **Live surface = the rest-timer overlay** — embed a coach card in `RestTimerOverlay`; natural pause point,
  fires under the same condition as the fetch, lighter than a modal.
- **Engine stays server-only for Phase B** — keep calling `POST /within-session` (preserves persist +
  `decisionId` + self-tuning audit). **Offline = graceful skip** (a stale next-set prescription is useless;
  don't queue it). A later PR may run the engine on-device for instant display while still firing the
  server call in the background — separate, opt-in.
- **Baseline promotion = explicit confirm tap** (a mid-session PR can come from a mis-keyed weight).
- **Pre-fill next set's weight = on Accept only** (not auto-on-arrival); field stays editable.

## Key implementation notes (from the file-grounded plan)
- The within-session route currently returns the raw engine decision **without the persisted `decisionId`**.
  Add `decisionId` to the response (`decisions.ts` within-session handler captures `persistDecision`'s
  returned row) so accept/override can target the decision. Small server change in PR 1.
- `within_session` already has `DecisionType` membership + badge/modal config (icon ⚡, "Live Set Coaching") —
  no shared-type work needed.
- **`plannedWeight` gap:** `ExerciseProgress` (`apps/mobile/components/workout/workout.types.ts`) has no
  planned working weight. Derive `plannedWeight` from `exercise.lastPerformance?.weight`, falling back to the
  session's first completed working-set weight. This affects PR-detection fidelity (PR needs `weight >
  plannedWeight`) — acceptable for MVP; revisit if the workout model gains an explicit target weight.
- **Trigger:** in `completeSetAction` (`app/workout/[id].tsx`), after the set is logged, fire a *non-blocking*
  `getWithinSessionAdjustment` only when `remainingSets > 0 && isOnline` (don't block the rest-timer start;
  distinct from the existing post-exercise `LoadRecommendationModal`). Store keyed by exerciseId.
- **Accept/override:** reuse `recordDecisionOutcome` (offline-first) — expose it from `useExerciseDecisions`;
  route "I'll adjust" through the existing `DecisionExplanationModal` override-reason picker seeded with the
  `within_session` decision. **Baseline promotion:** reuse `POST /api/users/:id/baselines` (delete-then-insert
  per exercise already = promotion); `source: "user_input"`. Optional follow-up: add a `"in_session_pr"`
  `BaselineSource` for analytics.

## PR breakdown (sequenced; matches "focused PRs" working style)
- **PR 1 — API surface** (S–M): server returns `decisionId`; client `getWithinSessionAdjustment` in
  `lib/api.ts` + `use-api.ts` wrapper + `WithinSessionSuggestion` client type. Server test for `decisionId`.
- **PR 2 — Trigger + live coach card** (M–L): `WithinSessionCoachCard.tsx`, `RestTimerOverlay` slot, the
  `completeSetAction` trigger + state, a pure `buildWithinSessionInput(exercise, setIndex)` helper for testing.
  *The bulk.*
- **PR 3 — Accept/override + pre-fill** (M): expose `recordDecisionOutcome`, wire the override modal,
  Accept-gated pre-fill via `updateSet`.
- **PR 4 — Baseline promotion** (S–M): the "New best — set as baseline?" affordance + `saveUserBaselines`
  when `newBaselineIfConfirmed` is present.

## Critical files
- `apps/mobile/app/workout/[id].tsx` (`completeSetAction`, render)
- `apps/mobile/components/workout/RestTimerOverlay.tsx` · new `WithinSessionCoachCard.tsx`
- `apps/mobile/lib/api.ts` · `apps/mobile/hooks/use-api.ts` · `apps/mobile/hooks/use-exercise-decisions.ts`
- `apps/server/src/routes/decisions.ts` (return `decisionId`)
