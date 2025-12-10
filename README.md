# vite-mcp

A Vite plugin that provides Model Context Protocol (MCP) server capabilities for Vite development, enabling MCP clients to interact with browser environments through adapters.

## Features

- 🔌 **MCP Server Integration** - High-level McpServer API integration
- 🎯 **Type-Safe Adapters** - Zod-validated adapters for browser APIs
- 🚀 **Vite Plugin** - Seamless integration with Vite dev server
- 📦 **Multiple Adapters** - Console, Cookies, LocalStorage, SessionStorage
- 🔄 **Hot Module Replacement** - Real-time communication via Vite HMR

## Installation

```bash
npm install vite-mcp
```

## Usage

### Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { viteMcp } from "vite-mcp";

export default defineConfig({
  plugins: [viteMcp()],
});
```

### Custom Adapters

```typescript
import { viteMcp } from "vite-mcp";
import { consoleAdapter } from "vite-mcp/adapters";

export default defineConfig({
  plugins: [
    viteMcp({
      adapters: [
        consoleAdapter,
        // Add your custom adapters here
      ],
    }),
  ],
});
```

### Using Adapters

```typescript
import {
  consoleAdapter,
  cookieAdapter,
  localStorageAdapter,
  sessionAdapter,
} from "vite-mcp/adapters";
```

## Available Adapters

- **consoleAdapter** - Read console messages from the browser
- **cookieAdapter** - Read cookies from the browser
- **localStorageAdapter** - Read localStorage items
- **sessionAdapter** - Read sessionStorage items

## MCP Endpoint

The plugin exposes an MCP server at `/__mcp` endpoint. MCP clients can connect to this endpoint to interact with the browser environment.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode with watch
npm run dev
```

## Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### Making Changes

1. **Create a changeset** after making changes:

   ```bash
   npm run changeset
   ```

   This will prompt you to:

   - Select which packages to include
   - Choose the type of change (patch, minor, major)
   - Write a summary of the changes

2. **Commit the changeset**:

   ```bash
   git add .changeset
   git commit -m "Add changeset"
   ```

3. **Push to GitHub**:
   ```bash
   git push
   ```

### Versioning and Publishing

The GitHub Actions workflow automatically handles versioning and publishing:

1. **When you push changesets to main**, the workflow will:

   - Create a PR with version bumps and changelog updates
   - Wait for the PR to be merged

2. **After merging the version PR**, the workflow will:
   - Automatically publish to npm
   - Create a GitHub release

### Manual Publishing (if needed)

If you need to publish manually:

```bash
# Build the package
npm run build

# Version packages (updates version numbers and changelog)
npm run version

# Publish to npm
npm run release
```

### Setting up NPM_TOKEN

To enable automatic publishing, you need to set up an NPM token:

1. **Create an NPM Access Token**:

   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the token

2. **Add to GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your NPM token
   - Click "Add secret"

### Workflow Overview

```
┌─────────────────┐
│  Make Changes   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Changeset│  npm run changeset
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Push to GitHub  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Action   │  Creates Version PR
│  (on push)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Merge Version   │
│      PR          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Action   │  Publishes to npm
│  (on merge)      │
└─────────────────┘
```

## License

MIT
