import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/examples/server/simpleStreamableHttp.js";

// Initialize the server
const server = new McpServer(
    { name: "example-server", version: "1.0.0" },
    {
        capabilities: {
            tools: {
                listChanged: true,
            }
        },
        // jsonSchemaValidator: new AjvJsonSchemaValidator()
    }
);

// Register a tool using a Zod schema
server.registerTool(
    "testing_zod_union",
    {
        title: "testing_zod_union",
        description: "testing_zod_union",
        inputSchema: z.union([z.string(), z.number()]),
        outputSchema: z.string(),
    },
    async ({ }) => {
        return {
            content: [{ type: "text", text: "true" }],
        };
    }

);

// Start the server using Stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
