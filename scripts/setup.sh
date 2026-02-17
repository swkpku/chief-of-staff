#!/bin/bash
set -e

echo "=== JobRunner Life Management Setup ==="

# Navigate to project root (parent of scripts/)
cd "$(dirname "$0")/.."

# Create directories
mkdir -p data/tokens data/backups data/exports
echo "  Created data directories"

# Copy config templates if not exists
if [ ! -f config/config.yaml ]; then
  cp config/config.example.yaml config/config.yaml
  echo "  Created config/config.yaml from template — edit this with your settings"
else
  echo "  config/config.yaml already exists, skipping"
fi

if [ ! -f config/sender-rules.yaml ]; then
  cp config/sender-rules.example.yaml config/sender-rules.yaml
  echo "  Created config/sender-rules.yaml from template — customize your sender rules"
else
  echo "  config/sender-rules.yaml already exists, skipping"
fi

# Install dependencies
echo "Installing backend dependencies..."
cd jobrunner/backend && npm install && cd ../..
echo "Installing dashboard dependencies..."
cd jobrunner/dashboard && npm install && cd ../..

# Run database migrations
echo "Running database migrations..."
cd jobrunner/backend && npm run migrate && cd ../..

# Seed templates
echo "Seeding default templates..."
cd jobrunner/backend && npm run seed && cd ../..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit config/config.yaml with your API keys"
echo "  2. Run 'cd jobrunner && npm run dev' to start in demo mode (no API keys needed)"
echo "  3. Enable connectors in config.yaml as you're ready"
echo "  4. See README.md for full documentation"
