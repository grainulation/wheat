# /witness — Targeted External Corroboration

You are corroborating (or contradicting) a specific claim using an external source. Read CLAUDE.md for sprint context and claims.json for existing claims.

## Process

1. **Parse arguments**: The user provides a claim ID and an external URL.

   - Example: `/witness p001 https://nodejs.org/api/http.html`
   - If only a claim ID is given, ask for the URL
   - If only a URL is given, ask which claim to witness

2. **Read the target claim** from claims.json. Understand what it asserts.

3. **Fetch the external source**: Use web fetch to read the URL. If it's documentation, source code, or an article, extract the relevant content.

4. **Classify the relationship** between the external evidence and the claim:

   - **Full support** -> external source confirms the claim completely
   - **Partial support** -> confirms some assertions but adds caveats
   - **Partial contradiction** -> external source challenges some assertions
   - **Full contradiction** -> external source directly contradicts the claim

5. **Determine evidence tier** based on source type:

   - Official docs (_.nodejs.org, docs._, RFC) -> `documented`
   - Blog posts, Stack Overflow, tutorials -> `web`
   - GitHub source code, changelogs -> `documented`
   - Production metrics, dashboards -> `production`

6. **Create a witness claim**:

```json
{
  "id": "w001",
  "type": "factual",
  "topic": "<same topic as witnessed claim>",
  "content": "<what the external source says, in relation to the witnessed claim>",
  "source": {
    "origin": "witness",
    "witnessed_claim": "<target claim ID>",
    "external_url": "<the URL>",
    "relationship": "full_support|partial_support|partial_contradiction|full_contradiction",
    "artifact": null,
    "connector": null
  },
  "evidence": "<tier based on source type>",
  "status": "active",
  "phase_added": "<current phase>",
  "timestamp": "<ISO timestamp>",
  "conflicts_with": [],
  "resolved_by": null,
  "tags": ["witness", "<relevant tags>"]
}
```

**Important relationship -> action mapping:**

- Full/partial support: No `conflicts_with`. The witness corroborates.
- Partial contradiction: Set `conflicts_with: ["<target claim ID>"]`. Explain the contradiction clearly in content.
- Full contradiction: Set `conflicts_with: ["<target claim ID>"]`. This becomes a challenge claim effectively.

7. **Run the compiler**:
   ```bash
   npx @grainulation/wheat compile --summary
   ```
   Report corroboration count changes and any new conflicts.

## Git commit

Stage claims.json.

Commit: `wheat: /witness <target claim ID> — added <witness claim IDs> (<relationship>)`

## Tell the user

- What the external source says about the claim
- How you classified the relationship (and why, if ambiguous)
- Whether the witness introduced any conflicts
- The corroboration count for the witnessed claim
- Suggest: `/witness` for other uncorroborated claims, `/challenge` if partial contradiction warrants deeper investigation

$ARGUMENTS
