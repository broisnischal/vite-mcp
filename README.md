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

The plugin automatically injects the bridge script for simple HTML files. For frameworks that generate HTML dynamically (React Router, Remix, TanStack Start, etc.), you need to manually include the virtual module in your app entry point.

#### React Router / TanStack Router

Add this to your root entry file (e.g., `src/main.tsx`, `src/entry.client.tsx`):

```typescript
/// <reference types="vite-mcp/vite-mcp-env" />
import "/virtual:mcp";

// Your other imports
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// ...
```

#### Remix

Add this to your `app/entry.client.tsx` file (at the very top, before any other imports):

```typescript
/// <reference types="vite-mcp/vite-mcp-env" />
import "/virtual:mcp";

// Your other Remix imports
import { RemixBrowser } from "@remix-run/react";
// ...
```

#### TanStack Start

Add this to your `src/entry-client.tsx` file:

```typescript
/// <reference types="vite-mcp/vite-mcp-env" />
import "/virtual:mcp";

// Your other TanStack Start imports
// ...
```

#### Vite + React/Vue/Svelte (Standard)

For standard Vite apps, the plugin automatically injects the script. If you're using a custom HTML template, you can also manually import:

```typescript
// In your main.tsx, main.js, or App.vue
import "/virtual:mcp";
```

**Important Notes:**

- The import must be at the **very top** of your entry file, before any console.log calls
- The console capture script runs automatically when the module loads
- Both `/virtual:mcp` and `virtual:mcp` import styles work

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

### Verifying Setup

After adding the import, you should see `[vite-mcp] Bridge: Bridge ready!` in your browser console. If you don't see this message:

1. **Check that you're in development mode** - The bridge only works in development
2. **Verify the import is at the top** - It must be before any other code
3. **Check browser console for errors** - Look for any import or module errors
4. **Verify Vite HMR is working** - The bridge requires Vite's HMR WebSocket

### Testing Console Capture

To verify console messages are being captured:

1. Open your browser console
2. Run: `console.log("Test message")`
3. Check `window.__mcpConsoleMessages` - You should see your message in the array
4. Use the MCP `read_console` tool - It should return your message

If `window.__mcpConsoleMessages` is undefined, the console capture script didn't run. Make sure:

- The `/virtual:mcp` import is at the very top of your entry file
- You're in development mode
- The module loaded successfully (check for errors)

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
