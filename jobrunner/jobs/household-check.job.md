# Household Check

## Schedule
0 7 * * *

## Goal
Spawn recurring household tasks from templates and detect utility bill anomalies. Keep the household domain on track.

## Policy
- Check all active templates and create items for any that are due
- For utility bills, compare against 3-month rolling average
- Flag bills more than 30% above average
- Remind about upcoming template tasks 3 days before due

## Boundaries
- NEVER make payments
- NEVER modify financial data
- Suggestions and reminders only

## Tools
- template_spawner
- anomaly_detector
