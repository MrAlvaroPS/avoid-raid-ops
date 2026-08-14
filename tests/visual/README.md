# Visual regression gate

Before source-built UI replaces the Golden bundle in production, capture all nine Golden screens and all nine source screens at desktop and mobile widths. Diff screenshots and DOM class/text inventories. Unapproved pixel differences fail release. The current container cannot browse local files because of environment browser policy, so v3 uses deterministic source reconstruction + static fidelity checks now; browser screenshot diff is the next release gate, not silently skipped.
