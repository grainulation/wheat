# /challenge — Structured Devil's Advocacy

You are stress-testing a specific claim by researching the **strongest possible counter-argument** with real evidence. Read CLAUDE.md for sprint context and claims.json for existing claims.

## Process

1. **Identify the target claim**: The user's argument is a claim ID (e.g., `p001`). Read that claim from claims.json. If no ID provided, ask the user which claim to challenge.

2. **Understand what's being claimed**: Break down the claim into its core assertions.

3. **Research AGAINST the claim**: Use web search to find the strongest counter-evidence. Search for problems, limitations, failure modes, alternatives, and contradictions. Be adversarial — your job is to find what's wrong, not confirm what's right.

   Guidelines for research:

   - Focus on factual counter-evidence, not opinion
   - Only challenge claims at `web` tier or above (challenging `stated` is pointless — they're already known-weak)
   - Distinguish "contradicts the claim" from "adds a related concern"
   - Look for: documented bugs, breaking changes, scalability limits, maintenance costs, better alternatives

4. **Create challenge claims**: For each substantive counter-argument found, create a claim with:
   - ID: `x###` prefix (continue sequence from existing x-prefixed claims)
   - `"source.origin": "challenge"`
   - `"source.challenged_claim": "<target claim ID>"`
   - Evidence tier based on what you found (web, documented, etc.)
   - Set `conflicts_with` ONLY if the challenge directly contradicts the target claim's factual assertions.

```json
{
  "id": "x001",
  "type": "risk|factual",
  "topic": "<same topic as challenged claim>",
  "content": "<specific counter-argument with evidence>",
  "source": {
    "origin": "challenge",
    "challenged_claim": "<target claim ID>",
    "artifact": null,
    "connector": null
  },
  "evidence": "web|documented",
  "status": "active",
  "phase_added": "<current phase>",
  "timestamp": "<ISO timestamp>",
  "conflicts_with": [],
  "resolved_by": null,
  "tags": ["challenge", "<relevant tags>"]
}
```

5. **Run the compiler**:

   ```bash
   npx @grainulation/wheat compile --summary
   ```

   Report whether challenges created new conflicts and whether the compiler auto-resolved any.

6. **Assess the outcome**:
   - If the challenge finds `tested` or `documented` evidence contradicting a `web`-tier claim -> compiler may auto-resolve
   - If same tier -> unresolved conflict -> needs `/resolve`
   - If challenge only raises concerns without contradiction -> no conflict, just enriched claim set

## Git commit

Stage claims.json and any new files.

Commit: `wheat: /challenge <claim ID> — added <challenge claim IDs>`

## Tell the user

- Summarize what you challenged and what you found
- Flag which challenges contradict vs. add concerns
- Report compiler status (new conflicts? auto-resolved?)
- Suggest: `/resolve` if unresolved conflicts, `/witness` to corroborate survivors, more `/challenge` for other claims

$ARGUMENTS
