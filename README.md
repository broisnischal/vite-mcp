# vite-mcp

A Vite plugin that provides Model Context Protocol (MCP) server capabilities for Vite development, enabling MCP clients to interact with browser environments through adapters.

### WHY?

This plugin gives your agent actual eyes inside the browser. Instead of working blind during Vite HMR, it can now see the UI, console, and page state in real time through MCP tools, and many more if you contribute!

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

### Framework Support (React Router, Remix, TanStack Start, etc.)

The plugin automatically injects the bridge script for simple HTML files. For frameworks that generate HTML dynamically (React Router, Remix, TanStack Start, etc.), you can manually include the virtual module:

**Option 1: Script Tag (Recommended)**

```html
<script type="module" src="/virtual:mcp"></script>
```

**Option 2: Import in Code**

```typescript
// In your app entry point (e.g., main.tsx, entry.client.tsx, etc.)
import "/virtual:mcp"; or import "virtual:mcp";
```

**TypeScript Support**

To fix TypeScript errors when importing `/virtual:mcp`, you have two options:

**Option A: Add reference directive (Quick fix)**

Add this at the top of your entry file (e.g., `main.tsx`, `entry.client.tsx`):

```typescript
/// <reference types="vite-mcp/vite-mcp-env" />
import "/virtual:mcp";
```

**Option B: Add to tsconfig.json (Recommended for projects)**

Add the types file to your `tsconfig.json`:

```json
{
  "compilerOptions": { ... },
  "include": [
    "src/**/*",
    "node_modules/vite-mcp/vite-mcp-env.d.ts"
  ]
}
```

Then you can import without the reference directive:

```typescript
import "/virtual:mcp";
```

The virtual module `/virtual:mcp` will automatically initialize the browser bridge and connect to the MCP server via Vite's HMR WebSocket.

## Available Adapters

- **consoleAdapter** - Read console messages from the browser
- **cookieAdapter** - Read cookies from the browser
- **localStorageAdapter** - Read localStorage items
- **sessionAdapter** - Read sessionStorage items
- **contribute** - Contribute new adapters
<!-- - **domAdapter** - Read DOM elements -->

## MCP Endpoint

The plugin exposes an MCP server at `/__mcp` endpoint. MCP clients can connect to this endpoint to interact with the browser environment.

### MCP Server Configuration

```json
{
  "mcpServers": {
    "vite-dev-mcp": {
      "url": "http://localhost:5173/__mcp"
    }
  }
}
```

<!--
Quick test:

1. Start the playground: `cd playground && npm run dev`
2. Open `http://localhost:5200` in a browser
3. Run the test script: `npm run test:mcp` -->

Or use online tools like [MCP Playground](https://mcpplaygroundonline.com) to test the MCP server at `http://localhost:(viteport)/__mcp`.

## Roadmap & TODO

- [ ] **User Custom Adapters/Plugins**:  
       Allow users to create and register their own custom adapters and plugins for bespoke data gathering and browser automation.

- [ ] **Network Logs**:  
       Capture and display all browser network requests and responses for advanced debugging and tracing (XHR, fetch, websockets, etc).

- [ ] **Component Routes**:  
       Visualize and inspect frontend routing, including mapping between components and their active routes.

- [ ] **Component Tree**:  
       Display a live, interactive component tree for supported frameworks (React, Vue, etc) for better introspection and state tracing.

- [ ] **Cached Storage**:  
       List and inspect all cached data from browser cache storage APIs.

- [ ] **IndexedDB Explorer**:  
       Browse, query, and inspect all records/tables in the browser's IndexedDB databases.

- [ ] **Service Worker Monitoring**:
- [ ] **Console/Log Filtering**:
- [ ] **Performance Metrics**:  
       Display core web vitals, page load timings, and real user metrics for performance analysis.

- [ ] **Screenshot/DOM Snapshots**:
- [ ] **Remote Debugging Capabilities**:

_If you have suggestions for more features or use-cases, please open an issue or discussion!_

## License

MIT
