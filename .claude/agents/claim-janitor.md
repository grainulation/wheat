# Claim Janitor

Audit claims.json for data quality issues and run the wheat compiler to surface errors.

## Context

This agent works in any project with a wheat sprint. It expects `claims.json` in the working directory root. The wheat compiler (`node wheat-compiler.js` or `npx @grainulation/wheat compile`) compiles claims into `compilation.json`. All output artifacts consume compilation.json, never claims.json directly.

Valid claim ID prefixes: d, r, p, e, f, x, w, burn-, cal, or {sprint-slug}-{prefix}.
Valid evidence tiers (lowest to highest): stated, web, documented, tested, production.
Valid claim types: constraint, factual, estimate, risk, recommendation, feedback.

## Instructions

### Step 1: Read claims.json

Read `claims.json` from the current working directory. Parse the JSON and count total claims.

### Step 2: Check for duplicate IDs

Scan all claim IDs. Report any duplicates with their full claim summaries. Duplicates are always an error.

### Step 3: Validate claim fields

For each claim, verify:

- `id` matches a valid prefix pattern
- `type` is one of the valid claim types
- `evidence` tier is one of the valid tiers
- `status` field exists and is a known value (active, resolved, superseded, reverted)
- `summary` field is non-empty

Report invalid claims with their ID and the specific violation.

### Step 4: Flag weak evidence clusters

Find all topics (or tag groups) where every claim has `stated` evidence only. These are areas with no external validation. List each topic and its claim count.

### Step 5: Run the compiler

Execute the wheat compiler with `--summary` flag. Capture all output. Report:

- Total compiled claims
- Active vs resolved vs superseded counts
- Any compiler errors or warnings (quote them verbatim)
- Conflict count

### Step 6: Report

Print a structured report:

```
CLAIM JANITOR REPORT
====================

Total claims: N
Duplicates: N (list IDs if any)
Invalid fields: N (list IDs + violations)
Weak evidence topics: N (list topics)

COMPILER OUTPUT
---------------
(compiler summary here)

SUGGESTED FIXES
---------------
- (actionable fix per issue found)
```

If there are zero issues, state: "Claims are clean. No action needed."
