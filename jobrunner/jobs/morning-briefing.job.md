# Morning Briefing

## Schedule
0 7 * * *

## Goal
Generate the daily prioritized briefing. Run after all other morning jobs to incorporate fresh data.

## Policy
- Run all connectors to refresh data
- Run the template spawner for due tasks
- Run the scoring engine
- Generate the top-5 priority list with domain balance constraint
- Compute domain health scores
- Check for hyper-focus condition
- Keep briefing under 300 words
- Be direct and specific about what to do first

## Boundaries
- Read-only aggregation
- NEVER take actions on behalf of the user
- NEVER modify items or data

## Tools
- scoring_engine
- snapshot_generator
- briefing_generator
