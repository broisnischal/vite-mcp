# vite-mcp

A Vite plugin that provides Model Context Protocol (MCP) server capabilities for Vite development, enabling MCP clients to interact with browser environments through adapters.

### Why to use?

This plugin gives your agent actual eyes inside the browser. Instead of working blind during Vite HMR, it can now see the UI, console, and page state in real time through MCP tools, and many more if you contribute!

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
        // Add your custom adapters here ( experimental )
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
  sessionStorageAdapter,
  cacheAdapter,
  indexedDBAdapter,
  performanceAdapter,
  componentTreeAdapter,
} from "vite-mcp/adapters";
```

### Framework Support

The plugin automatically injects the bridge script for simple HTML files. For frameworks that generate HTML dynamically (React Router, Remix, TanStack Start, etc.), you need to manually include the virtual module in your app entry point.

**Entry file locations by framework:**

- React Router / TanStack Router: `src/main.tsx` or `src/entry.client.tsx`
- Remix: `app/entry.client.tsx`
- TanStack Start: `src/entry-client.tsx`
- Standard Vite (React/Vue/Svelte): `src/main.tsx`, `src/main.js`, or `App.vue` (optional, auto-injected)

Add this at the **very top** of your entry file (before any other imports):

```typescript
/// add reference only if the type throws, else fine! no need to reference
/// <reference types="vite-mcp/vite-mcp-env" />
import "virtual:mcp";
```

**TypeScript Support**

To avoid the reference directive, add to `tsconfig.json`:

```json
{
  "compilerOptions": { ... },
  "include": [
    "src/**/*",
    "node_modules/vite-mcp/vite-mcp-env.d.ts"
  ]
}
```

The virtual module will automatically initialize the browser bridge and connect to the MCP server via Vite's HMR WebSocket.

## Available Adapters

- **consoleAdapter** - Read console messages from the browser
- **cookieAdapter** - Read cookies from the browser
- **localStorageAdapter** - Read localStorage items
- **sessionStorageAdapter** - Read sessionStorage items
- **cacheAdapter** - Manage Cache API (list, get/set/delete entries)
- **indexedDBAdapter** - Manage IndexedDB (list databases, get/set/delete entries)
- **performanceAdapter** - Get performance metrics (Web Vitals, navigation timing, resource timings)
- **componentTreeAdapter** - Get component tree structure (React, Vue, Svelte) and route information
- **contribute** - Contribute new adapters
<!-- - **domAdapter** - Read DOM elements -->

## MCP Endpoint

The plugin exposes an MCP server at `/__mcp` endpoint as default. MCP clients can connect to this endpoint to interact with the browser environment.

### MCP Server Configuration

```json
// .mcp.json
{
  "mcpServers": {
    "vite-dev-mcp": {
      "url": "http://localhost:5173/__mcp"
    }
  }
}
```

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

- The `virtual:mcp` import is at the very top of your entry file
- You're in development mode
- The module loaded successfully (check for errors)

Or use online tools like [MCP Playground](https://mcpplaygroundonline.com) to test the MCP server at `http://localhost:(viteport)/__mcp`.

## Roadmap & TODO

- [ ] **User Custom Adapters/Plugins**:  
       Allow users to create and register their own custom adapters and plugins for bespoke data gathering and browser automation.

- [ ] **Network Logs**:  
       Capture and display all browser network requests and responses for advanced debugging and tracing (XHR, fetch, websockets, etc).

- [x] **Component Routes**:  
       Visualize and inspect frontend routing, including mapping between components and their active routes (via `componentTreeAdapter`).

- [x] **Component Tree**:  
       Display a live, interactive component tree for supported frameworks (React, Vue, etc) for better introspection and state tracing (via `componentTreeAdapter`).

- [x] **Cached Storage**:  
       List and inspect all cached data from browser cache storage APIs (via `cacheAdapter`).

- [x] **IndexedDB Explorer**:  
       Browse, query, and inspect all records/tables in the browser's IndexedDB databases (via `indexedDBAdapter`).

- [ ] **Service Worker Monitoring**:
- [x] **Console/Log Filtering**:
- [x] **Performance Metrics**:  
       Display core web vitals, page load timings, and real user metrics for performance analysis (via `performanceAdapter`).

- [ ] **Remote Debugging Capabilities**:

_If you have suggestions for more features or use-cases, please open an issue or discussion!_

## License & Credits

This project is released under the [MIT License](LICENSE).
