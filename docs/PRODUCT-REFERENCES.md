# Iris product research references

Canonical reference list for external products and sites that can inform AvoiD Raid Operations. These are research/inspiration sources: copy useful product ideas and data presentation patterns, **not proprietary code, text, artwork, or pixel-for-pixel UI**. Iris must continue to distinguish observed WCL evidence from external reference knowledge and from inference.

## WoWAnalyzer

- URL: https://wowanalyzer.com
- Primary value: turns combat-log facts into prioritized, actionable player feedback rather than exposing raw tables alone.
- Patterns worth studying:
  - recommendations that say both **what was observed** and **what to do differently**;
  - buff uptime, cooldown use, cancelled/incorrect casts and resource waste;
  - severity/threshold systems that avoid flooding the user with low-value warnings;
  - fight-length-normalized metrics where appropriate.
- Iris use: Player review, reliability/coaching, post-raid diagnostics. Do not import a class/spec rule as encounter causality without our own evidence.

## Wipefest

- URL: https://www.wipefest.gg/?gameVersion=warcraft-live
- Primary value: raid-level log analysis focused on mechanics and progression pulls.
- Patterns worth studying:
  - concise per-pull mechanic insights;
  - high-level encounter timelines;
  - analysis over multiple reports/pulls instead of forcing the RL to inspect one log at a time;
  - quickly surfacing the few issues that matter for the next attempt.
- Iris use: Mechanics, Live between-pull brief, Pull Lab, Progress. Iris should go further by preserving evidence provenance and separating temporal association from proven causality.

## Archon / Warcraft Logs ecosystem

- URL: https://www.archon.gg/wow
- Primary value: aggregate/statistical view of Warcraft Logs data and progression context.
- Patterns worth studying:
  - broad multi-report statistics and rankings;
  - progression-pull selection and encounter slicing;
  - sorting/filtering pulls by boss progress, duration and phase/stage;
  - participation/context across many pulls rather than isolated parses.
- Iris use: Progress, composition benchmarks and eventually research-plane peer cohorts. Peer data must be cohort-matched before calling something better/worse.

## Lorrgs

- URL: https://lorrgs.io
- Primary value: visually aligns top logs and cooldown timings on a comparable encounter timeline.
- Patterns worth studying:
  - synchronized timeline comparison;
  - markers that align important encounter moments across logs;
  - showing when relevant cooldowns/spells are used;
  - custom report/log comparison without requiring many WCL tabs.
- Iris use: Pull Lab, raid-CD planning, Live. Reference timings are evidence/examples, not a strategy that should be copied blindly; the guild's own composition and plan remain authoritative.

## Mythic Trap

- URL: https://www.mythictrap.com/en
- Primary value: concise, visually approachable encounter explanation for raiders and raid leaders.
- Patterns worth studying:
  - role-focused explanations;
  - short visual/animated fight explanations;
  - RL-friendly presentation rather than encyclopedia-style walls of text.
- Iris use: pre-raid briefing and generated encounter-model explanation. Curated guide knowledge must remain visibly distinct from corpus-derived conclusions.

## Wowhead

- URL: https://www.wowhead.com
- Primary value: canonical practical reference for abilities, spell IDs/tooltips, encounter guides, talents and item/class context.
- Patterns worth studying:
  - spell/ability tooltip enrichment;
  - stable human-readable reference for IDs found in logs;
  - talents/build and encounter reference context.
- Iris use: enrichment and explanation. Wowhead names/guides may help label or form hypotheses, but they are **not evidence that an inferred encounter relation is causal**.

## Product rule

External products can answer: “what presentation or workflow is useful?” and “what reference data helps explain this ID?”. The Iris evidence pipeline must independently answer: “what actually happened in these logs?”, “does it generalize to unseen sources?”, and “is it safe to score/blame?”.
