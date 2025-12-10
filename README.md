## UNDER_DEVELOPMENT

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

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing instructions.

Quick test:
1. Start the playground: `cd playground && npm run dev`
2. Open `http://localhost:5200` in a browser
3. Run the test script: `npm run test:mcp`

Or use online tools like [MCP Playground](https://mcpplaygroundonline.com) to test the MCP server at `http://localhost:5200/__mcp`.

## License

MIT
