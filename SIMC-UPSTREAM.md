# SimulationCraft upstream contract

- Canonical engine: https://github.com/simulationcraft/simc
- Canonical binaries: official SimulationCraft nightly builds.
- Managed update index: `https://downloads.simulationcraft.org/nightly/?C=M;O=D` with HTTP fallback for legacy hosting behavior.
- Only Windows x64 networking builds are eligible for automatic promotion in v0.1.
- ARM64 and `nonetwork` builds are rejected.
- Nightly commit is parsed from the official archive filename and checked against the canonical GitHub repository when available.
- Archive SHA-256 and `simc display_build=2` output are persisted before promotion.
- `current` and `previous` builds are retained for reproducibility/rollback metadata.

A change in upstream daily nightly is not a reason to silently recompute historical loot decisions. Existing sim results retain their engine provenance; new simulations use the currently verified worker.
