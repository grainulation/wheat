# /blind-spot — Analyze What's NOT Being Claimed

You are scanning the claim set for structural gaps — not what's wrong, but what's *missing*. Read CLAUDE.md for sprint context, claims.json for existing claims, and compilation.json for coverage data.

## Process

1. **Run the compiler** to get fresh data:
   ```bash
   npx @grainulator/wheat compile --summary
   ```

2. **Read compilation.json** for coverage analysis, including source diversity, type diversity, and corroboration data.

3. **Analyze four categories of blind spots**:

### (a) Dependency gaps
Scan claim content for topic-like nouns that are NOT in the current topic set. If claims reference concepts like "latency," "compliance," "security," "cost," or "performance" but no topic covers those, they're implicit dependencies never addressed.

### (b) Type monoculture
Check `type_diversity` in coverage for each topic. Flag topics with < 2 distinct claim types. A topic with 5 factual claims but no risks is suspicious — where's the downside analysis?

### (c) Echo chambers
Check `source_origins` and `source_count` in coverage for each topic. Flag topics where:
- All claims come from a single source origin (e.g., all "research" with no external feedback)
- Claims >= 3 but source_count == 1

### (d) Evidence ceiling
Check `max_evidence` relative to the current sprint phase. If the sprint phase is `prototype` but a key topic is still at `stated` or `web` tier, that's a gap.

Phase expectations:
- `define`: `stated` is fine everywhere
- `research`: key topics should be at least `web`
- `prototype`: key topics should be at least `tested`
- `evaluate`: everything should be `documented` or above

4. **Check dismissed blind spots**: Look for a `dismissed_blind_spots` field in claims.json meta. Don't re-flag items the user has already dismissed.

5. **Print the analysis** to the terminal. This command does NOT modify claims.json — it only reads and reports.

## Tell the user

- Present the blind spot analysis clearly
- For each gap, suggest a specific action (which command to run)
- Remind them they can dismiss false-positive blind spots by adding to `meta.dismissed_blind_spots`
- If no blind spots found, say so — a clean bill of health is valuable information

$ARGUMENTS