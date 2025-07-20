#!/bin/bash

# Release script for llm-benchmark
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Default to patch if no argument provided
VERSION_TYPE=${1:-patch}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Invalid version type. Use patch, minor, or major"
  exit 1
fi

echo "🚀 Starting $VERSION_TYPE release..."

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Must be on main branch to release. Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
npm test

# Build
echo "🔨 Building packages..."
npm run build

# Bump version
echo "📦 Bumping $VERSION_TYPE version..."
cd packages/core
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
cd ../..

# Update root package.json version to match
echo "📝 Updating root package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
"

# Commit version bump
echo "💾 Committing version bump..."
git add -A
git commit -m "chore: release v$NEW_VERSION

- Bump version from $(git describe --abbrev=0 --tags 2>/dev/null || echo "1.0.0") to $NEW_VERSION
- Type: $VERSION_TYPE release

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Tag the release
echo "🏷️  Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push changes
echo "📤 Pushing to remote..."
git push origin main
git push origin "v$NEW_VERSION"

# Publish to npm
echo "📦 Publishing to npm..."
cd packages/core
npm publish
cd ../..

echo "✅ Successfully released v$NEW_VERSION!"
echo ""
echo "Next steps:"
echo "- Create release notes on GitHub: https://github.com/thomasdavis/llm-benchmark/releases/new"
echo "- Update CHANGELOG.md if needed"
echo "- Announce the release"