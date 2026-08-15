# Progress data-quality audit

This note separates **internal consistency bugs** from **source-data questions**.

## Internal consistency

v3.7.11 requires every Progress panel to consume `history.progressModel`, which is built from the same canonical `progressionPulls` array. If totals, night sums or global numbering disagree, that is an Iris invariant failure and must be surfaced as such.

## Source-data quality

A value can be internally consistent and still deserve an ingestion/eligibility review. The main current example is a concentration of exact `100.0%` WCL `fightPercentage` values.

Iris v3.7.11 does **not** silently replace these with `bossPercentage` or delete them. The model records:

- `diagnostics.hundredPctPulls`
- `diagnostics.hundredPctSharePct`
- `totals.scoredPulls`
- `totals.unscoredPulls`

If the post-v3.7.11 canonical curve still contains implausible 100% clusters, the next debugging layer is:

1. inspect the exact canonical global pull numbers;
2. map them back to report code + fight ID + duration + wipeCalledTime + stage + bossPercentage + fightPercentage;
3. verify `classifyPullForAnalysis` eligibility for those pulls;
4. determine whether they are legitimate shallow attempts, called/reset pulls that need a generic eligibility rule, or valid WCL encounter-completion semantics;
5. change eligibility only with a generic evidence-backed rule and a regression fixture.

Do not alter the Progress formula to compensate for suspect inputs. Fix input classification at the analytical-pull boundary so every downstream consumer benefits.
