# Kids Check

## Schedule
0 7 * * *

## Goal
Monitor kids domain, surface upcoming deadlines, and cross-reference health history when new entries are added.

## Policy
- When a new health symptom is logged, query full health history for that child
- Generate context-aware suggestions based on history
- Track activity registration deadlines
- Surface school-related deadlines

## Boundaries
- NEVER provide medical diagnoses
- Always frame health suggestions as "consider consulting your pediatrician"
- NEVER share kids' data externally
- Use "consider", "watch for", "you may want to ask your pediatrician about"

## Tools
- knowledge_log_query
- template_spawner
