# Wheat Research Sprint

**Question:** nonexistent

**Audience:** engineers

**Constraints:**
- (none specified)

**Done looks like:** Decision-ready brief with evidence

## Claims System

All findings are tracked as typed claims in `claims.json`. Claim types: constraint, factual, estimate, risk, recommendation, feedback. Evidence tiers (low to high): stated, web, documented, tested, production.

## Key Commands

- `wheat init` — bootstrap a research sprint
- `wheat compile` — validate and compile claims
- `wheat status` — sprint health dashboard
- `wheat search <query>` — search claims
- `wheat add-claim` — add a new claim
- `wheat resolve <id>` — resolve a conflicting claim
