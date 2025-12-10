#!/usr/bin/env node
/**
 * MCP Client Test Script
 * 
 * This script tests the vite-mcp server by connecting to it and calling the available tools.
 * 
 * Usage:
 *   1. Start the Vite dev server: cd playground && npm run dev
 *   2. Open http://localhost:5200 in a browser to initialize the bridge
 *   3. Run this script: npx tsx test-mcp-client.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_SERVER_URL = 'http://localhost:5200/__mcp';

async function testMcpServer() {
    console.log('🧪 Testing MCP Server at', MCP_SERVER_URL);
    console.log('');

    // Create transport
    // Note: StreamableHTTPClientTransport constructor expects a URL object, not a string
    const transport = new StreamableHTTPClientTransport(
        new URL(MCP_SERVER_URL),
        {
            fetch: globalThis.fetch,
        }
    );

    // Create client
    // Note: Client capabilities are about what the client supports (sampling, elicitation, etc.),
    // not about which tools to use. Tools are discovered via listTools() after connecting.
    const client = new Client({
        name: 'vite-mcp-test-client',
        version: '1.0.0',
    }, {
        capabilities: {
            tasks: {
            }
        },
    });

    try {
        // Connect to server (this automatically initializes the session)
        console.log('📡 Connecting to MCP server...');
        await client.connect(transport);
        console.log('✅ Connected and initialized successfully!\n');

        // Get server info after connection
        const serverCapabilities = client.getServerCapabilities();
        const serverVersion = client.getServerVersion();
        if (serverVersion) {
            console.log('📋 Server:', serverVersion.name, serverVersion.version);
        }
        if (serverCapabilities) {
            console.log('📋 Server Capabilities:', Object.keys(serverCapabilities));
        }
        console.log('');

        // List available tools
        console.log('🔧 Listing available tools...');
        const toolsList = await client.listTools();
        console.log(`✅ Found ${toolsList.tools.length} tool(s):`);
        toolsList.tools.forEach((tool) => {
            console.log(`   - ${tool.name}: ${tool.description}`);
        });
        console.log('');

        // Wait a bit to ensure browser bridge is ready
        console.log('⏳ Waiting 2 seconds for browser bridge to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('');

        // Test each tool with timeout
        for (const tool of toolsList.tools) {
            console.log(`🧪 Testing tool: ${tool.name}`);
            try {
                // Add timeout wrapper for tool calls
                const toolCallPromise = (async () => {
                    switch (tool.name) {
                        case 'read_console':
                            const res = await client.callTool({
                                name: 'read_console',
                                arguments: { limit: 10 },
                            });
                            console.log('🔍 Read console result:', res);
                            return res;

                        case 'read_cookies':
                            return await client.callTool({
                                name: 'read_cookies',
                                arguments: {},
                            });

                        case 'read_local_storage':
                            return await client.callTool({
                                name: 'read_local_storage',
                                arguments: {},
                            });

                        case 'read_session_storage':
                            return await client.callTool({
                                name: 'read_session_storage',
                                arguments: {},
                            });

                        default:
                            console.log(`   ⚠️  Unknown tool: ${tool.name}`);
                            return null;
                    }
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Tool call timed out after 35 seconds. Make sure the browser page is open at http://localhost:5200')), 35000);
                });

                const result = await Promise.race([toolCallPromise, timeoutPromise]) as any;

                if (!result) {
                    continue;
                }

                if (result.isError) {
                    console.log(`   ❌ Error:`);
                    result.content.forEach((item: any) => {
                        if (item.type === 'text') {
                            console.log(`      ${item.text}`);
                        }
                    });
                } else {
                    // Parse and display the result
                    const content = result.content?.[0]?.text;
                    if (content) {
                        try {
                            const parsed = JSON.parse(content);
                            console.log(`   ✅ Success:`);

                            // Format output based on tool type
                            if (tool.name === 'read_console' && parsed.messages) {
                                console.log(`      Found ${parsed.messages.length} console message(s):`);
                                parsed.messages.slice(0, 5).forEach((msg: any, idx: number) => {
                                    console.log(`      ${idx + 1}. [${msg.type}] ${msg.message.substring(0, 60)}${msg.message.length > 60 ? '...' : ''}`);
                                });
                                if (parsed.messages.length > 5) {
                                    console.log(`      ... and ${parsed.messages.length - 5} more`);
                                }
                            } else if (tool.name === 'read_local_storage' && parsed.items) {
                                console.log(`      Found ${parsed.items.length} localStorage item(s):`);
                                parsed.items.forEach((item: any) => {
                                    console.log(`      - ${item.key}: ${item.value}`);
                                });
                            } else if (tool.name === 'read_session_storage' && parsed.items) {
                                console.log(`      Found ${parsed.items.length} sessionStorage item(s):`);
                                parsed.items.forEach((item: any) => {
                                    console.log(`      - ${item.key}: ${item.value}`);
                                });
                            } else if (tool.name === 'read_cookies' && parsed.cookies) {
                                console.log(`      Found ${parsed.cookies.length} cookie(s):`);
                                parsed.cookies.forEach((cookie: any) => {
                                    console.log(`      - ${cookie.name}: ${cookie.value}`);
                                });
                            } else {
                                console.log(JSON.stringify(parsed, null, 6));
                            }
                        } catch {
                            console.log(`   ✅ Success:`, content);
                        }
                    } else {
                        console.log(`   ✅ Success:`, JSON.stringify(result.content, null, 2));
                    }
                }
            } catch (error) {
                console.log(`   ❌ Exception:`, error instanceof Error ? error.message : String(error));
                if (error instanceof Error) {
                    if (error.message.includes('timeout')) {
                        console.log(`   💡 Tip: Make sure you have opened http://localhost:5200 in a browser`);
                    } else if (error.message.includes('fetch')) {
                        console.log(`   💡 Tip: This might indicate the browser bridge isn't responding.`);
                        console.log(`   💡 Make sure:`);
                        console.log(`      - The browser page is open at http://localhost:5200`);
                        console.log(`      - The browser console shows "[MCP Bridge] Ready"`);
                        console.log(`      - The Vite dev server shows "🔌 MCP Bridge ready!"`);
                    }
                    if (error.stack) {
                        console.log(`   📋 Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
                    }
                }
            }
            console.log('');
        }

        console.log('✅ All tests completed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Run the test
testMcpServer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

