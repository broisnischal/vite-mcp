import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const componentTreeAdapterInputSchema = z.object({
    includeProps: z.boolean().optional().default(false).describe("Include component props in the tree"),
    includeState: z.boolean().optional().default(false).describe("Include component state (if available)"),
    maxDepth: z.number().optional().default(10).describe("Maximum depth to traverse the component tree"),
    framework: z.enum(["auto", "react", "vue", "svelte"]).optional().default("auto").describe("Framework to detect (auto-detect if not specified)"),
});

interface ComponentNode {
    name: string;
    type: string;
    key?: string;
    props?: Record<string, unknown>;
    state?: Record<string, unknown>;
    children?: ComponentNode[];
    framework?: string;
}

interface RouteInfo {
    path: string;
    name?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    hash?: string;
}

export const componentTreeAdapterOutputSchema = z.object({
    framework: z.string().optional().describe("Detected framework"),
    route: z.object({
        path: z.string(),
        name: z.string().optional(),
        params: z.record(z.string(), z.string()).optional(),
        query: z.record(z.string(), z.string()).optional(),
        hash: z.string().optional(),
    }).optional(),
    componentTree: z.array(z.object({
        name: z.string(),
        type: z.string(),
        key: z.string().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
        state: z.record(z.string(), z.unknown()).optional(),
        children: z.array(z.any()).optional(),
        framework: z.string().optional(),
    })).optional(),
    domTree: z.array(z.object({
        tagName: z.string(),
        id: z.string().optional(),
        className: z.string().optional(),
        textContent: z.string().optional(),
        children: z.array(z.any()).optional(),
    })).optional(),
});

export const componentTreeAdapter: AdapterDefinition = {
    name: "component-tree",
    description: "Get the current page route and component tree structure (supports React, Vue, Svelte, and other frameworks)",
    inputSchema: componentTreeAdapterInputSchema,
    outputSchema: componentTreeAdapterOutputSchema,
    handler: async function (params?: {
        includeProps?: boolean;
        includeState?: boolean;
        maxDepth?: number;
        framework?: "auto" | "react" | "vue" | "svelte";
    }): Promise<CallToolResult> {
        if (typeof window === "undefined") {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Component tree is not available in server environment",
                    },
                ],
                isError: true,
            };
        }

        const detectFrameworkLocal = (): string | undefined => {
            if (typeof window === "undefined") {
                return undefined;
            }

            try {
                if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    return "react";
                }

                if ((window as any).__VUE__ || (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
                    return "vue";
                }

                if ((window as any).__SVELTE__ || document.querySelector("[data-svelte-h]")) {
                    return "svelte";
                }

                const reactRoot = document.querySelector("#root") || document.querySelector("#app");
                if (reactRoot && (reactRoot as any)._reactRootContainer) {
                    return "react";
                }

                if (document.querySelector("#app") && (window as any).Vue) {
                    return "vue";
                }

                return undefined;
            } catch {
                return undefined;
            }
        };

        const getRouteInfoLocal = (): RouteInfo | undefined => {
            if (typeof window === "undefined") {
                return undefined;
            }

            try {
                const path = window.location.pathname;
                const search = window.location.search;
                const hash = window.location.hash;

                const query: Record<string, string> = {};
                if (search) {
                    const params = new URLSearchParams(search);
                    params.forEach((value, key) => {
                        query[key] = value;
                    });
                }

                let routeName: string | undefined;
                let routeParams: Record<string, string> | undefined;

                if ((window as any).__REACT_ROUTER__) {
                    const router = (window as any).__REACT_ROUTER__;
                    if (router.state) {
                        routeName = router.state.location?.pathname;
                        routeParams = router.state.location?.state as Record<string, string> | undefined;
                    }
                }

                if ((window as any).__REMIX_ROUTE__) {
                    const route = (window as any).__REMIX_ROUTE__;
                    routeName = route.id;
                    routeParams = route.params;
                }

                if ((window as any).__TANSTACK_ROUTER__) {
                    const router = (window as any).__TANSTACK_ROUTER__;
                    if (router.state) {
                        routeName = router.state.location?.pathname;
                    }
                }

                const result: RouteInfo = { path };
                if (routeName) result.name = routeName;
                if (routeParams) result.params = routeParams;
                if (Object.keys(query).length > 0) result.query = query;
                if (hash) result.hash = hash;
                return result;
            } catch {
                return {
                    path: window.location.pathname,
                };
            }
        };

        const getReactComponentTreeLocal = (root: any, maxDepth: number, currentDepth: number = 0, includeProps: boolean, includeState: boolean): ComponentNode[] => {
            if (currentDepth >= maxDepth || !root) {
                return [];
            }

            const nodes: ComponentNode[] = [];

            try {
                if (root._reactInternalFiber || root._reactInternalInstance) {
                    const fiber = root._reactInternalFiber || root._reactInternalInstance;
                    if (fiber) {
                        let currentFiber = fiber;
                        while (currentFiber) {
                            if (currentFiber.type) {
                                const node: ComponentNode = {
                                    name: typeof currentFiber.type === "function" 
                                        ? currentFiber.type.displayName || currentFiber.type.name || "Anonymous"
                                        : typeof currentFiber.type === "string"
                                        ? currentFiber.type
                                        : "Unknown",
                                    type: typeof currentFiber.type === "function" ? "component" : "element",
                                    key: currentFiber.key,
                                    framework: "react",
                                };

                                if (includeProps && currentFiber.memoizedProps) {
                                    try {
                                        node.props = JSON.parse(JSON.stringify(currentFiber.memoizedProps, (_key, value) => {
                                            if (typeof value === "function") return "[Function]";
                                            if (typeof value === "object" && value !== null && value.$$typeof) return "[React Element]";
                                            return value;
                                        }));
                                    } catch {
                                        node.props = { "[error]": "Could not serialize props" };
                                    }
                                }

                                if (includeState && currentFiber.memoizedState) {
                                    try {
                                        const state: Record<string, unknown> = {};
                                        let stateNode = currentFiber.memoizedState;
                                        let index = 0;
                                        while (stateNode && index < 10) {
                                            if (stateNode.memoizedState !== undefined) {
                                                state[`state_${index}`] = stateNode.memoizedState;
                                            }
                                            stateNode = stateNode.next;
                                            index++;
                                        }
                                        if (Object.keys(state).length > 0) {
                                            node.state = state;
                                        }
                                    } catch {
                                        node.state = { "[error]": "Could not serialize state" };
                                    }
                                }

                                if (currentFiber.child && currentDepth < maxDepth - 1) {
                                    node.children = getReactComponentTreeLocal(
                                        { _reactInternalFiber: currentFiber.child },
                                        maxDepth,
                                        currentDepth + 1,
                                        includeProps,
                                        includeState
                                    );
                                }

                                nodes.push(node);
                            }

                            if (currentFiber.sibling) {
                                currentFiber = currentFiber.sibling;
                            } else {
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("[MCP] Error traversing React tree:", error);
            }

            return nodes;
        };

        const getVueComponentTreeLocal = (root: any, maxDepth: number, currentDepth: number = 0, includeProps: boolean, includeState: boolean): ComponentNode[] => {
            if (currentDepth >= maxDepth || !root) {
                return [];
            }

            const nodes: ComponentNode[] = [];

            try {
                if (root.__vue__) {
                    const instance = root.__vue__;
                    const node: ComponentNode = {
                        name: instance.$options.name || instance.$options._componentTag || "Anonymous",
                        type: "component",
                        framework: "vue",
                    };

                    if (includeProps && instance.$props) {
                        try {
                            node.props = JSON.parse(JSON.stringify(instance.$props, (_key, value) => {
                                if (typeof value === "function") return "[Function]";
                                return value;
                            }));
                        } catch {
                            node.props = { "[error]": "Could not serialize props" };
                        }
                    }

                    if (includeState && instance.$data) {
                        try {
                            node.state = JSON.parse(JSON.stringify(instance.$data, (_key, value) => {
                                if (typeof value === "function") return "[Function]";
                                return value;
                            }));
                        } catch {
                            node.state = { "[error]": "Could not serialize state" };
                        }
                    }

                    if (instance.$children && instance.$children.length > 0 && currentDepth < maxDepth - 1) {
                        node.children = instance.$children.flatMap((child: any) => 
                            getVueComponentTreeLocal(child.$el, maxDepth, currentDepth + 1, includeProps, includeState)
                        );
                    }

                    nodes.push(node);
                }

                if (root.children) {
                    for (const child of root.children) {
                        nodes.push(...getVueComponentTreeLocal(child, maxDepth, currentDepth + 1, includeProps, includeState));
                    }
                }
            } catch (error) {
                console.error("[MCP] Error traversing Vue tree:", error);
            }

            return nodes;
        };

        const getSvelteComponentTreeLocal = (root: Element, maxDepth: number, currentDepth: number = 0): ComponentNode[] => {
            if (currentDepth >= maxDepth || !root) {
                return [];
            }

            const nodes: ComponentNode[] = [];

            try {
                if (root.hasAttribute("data-svelte-h")) {
                    const node: ComponentNode = {
                        name: root.tagName.toLowerCase(),
                        type: "component",
                        framework: "svelte",
                    };

                    if (root.id) {
                        node.key = root.id;
                    }

                    if (currentDepth < maxDepth - 1) {
                        const children: ComponentNode[] = [];
                        for (const child of Array.from(root.children)) {
                            children.push(...getSvelteComponentTreeLocal(child, maxDepth, currentDepth + 1));
                        }
                        if (children.length > 0) {
                            node.children = children;
                        }
                    }

                    nodes.push(node);
                } else {
                    for (const child of Array.from(root.children)) {
                        nodes.push(...getSvelteComponentTreeLocal(child, maxDepth, currentDepth));
                    }
                }
            } catch (error) {
                console.error("[MCP] Error traversing Svelte tree:", error);
            }

            return nodes;
        };

        const getDOMTreeLocal = (element: Element, maxDepth: number, currentDepth: number = 0): Array<{
            tagName: string;
            id?: string;
            className?: string;
            textContent?: string;
            children?: Array<unknown>;
        }> => {
            if (currentDepth >= maxDepth || !element) {
                return [];
            }

            const nodes: Array<{
                tagName: string;
                id?: string;
                className?: string;
                textContent?: string;
                children?: Array<unknown>;
            }> = [];

            try {
                const node: {
                    tagName: string;
                    id?: string;
                    className?: string;
                    textContent?: string;
                    children?: Array<unknown>;
                } = {
                    tagName: element.tagName.toLowerCase(),
                };

                if (element.id) {
                    node.id = element.id;
                }

                if (element.className && typeof element.className === "string") {
                    node.className = element.className;
                }

                const text = element.textContent?.trim();
                if (text && text.length > 0 && text.length < 100 && !element.children.length) {
                    node.textContent = text;
                }

                if (currentDepth < maxDepth - 1 && element.children.length > 0) {
                    const children: Array<unknown> = [];
                    for (const child of Array.from(element.children)) {
                        children.push(...getDOMTreeLocal(child, maxDepth, currentDepth + 1));
                    }
                    if (children.length > 0) {
                        node.children = children;
                    }
                }

                nodes.push(node);
            } catch (error) {
                console.error("[MCP] Error traversing DOM tree:", error);
            }

            return nodes;
        };

        try {
            const includeProps = params?.includeProps === true;
            const includeState = params?.includeState === true;
            const maxDepth = params?.maxDepth ?? 10;
            const frameworkParam = params?.framework ?? "auto";

            const detectedFramework = frameworkParam === "auto" ? detectFrameworkLocal() : frameworkParam;
            const route = getRouteInfoLocal();

            let componentTree: ComponentNode[] | undefined;

            if (detectedFramework === "react") {
                const rootElement = document.querySelector("#root") || document.querySelector("#app") || document.body;
                if (rootElement) {
                    const reactRoot = (rootElement as any)._reactRootContainer ||
                        (rootElement as any)._reactInternalFiber ||
                        (rootElement as any).__reactContainer$;

                    if (reactRoot) {
                        componentTree = getReactComponentTreeLocal(
                            { _reactInternalFiber: reactRoot },
                            maxDepth,
                            0,
                            includeProps,
                            includeState
                        );
                    }

                    if (!componentTree || componentTree.length === 0) {
                        const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
                        if (hook && hook.renderers) {
                            const renderer = hook.renderers.get(1);
                            if (renderer && renderer.findFiberByHostInstance) {
                                const fiber = renderer.findFiberByHostInstance(rootElement);
                                if (fiber) {
                                    componentTree = getReactComponentTreeLocal(
                                        { _reactInternalFiber: fiber },
                                        maxDepth,
                                        0,
                                        includeProps,
                                        includeState
                                    );
                                }
                            }
                        }
                    }
                }
            } else if (detectedFramework === "vue") {
                const appElement = document.querySelector("#app") || document.body;
                if (appElement) {
                    componentTree = getVueComponentTreeLocal(appElement, maxDepth, 0, includeProps, includeState);
                }
            } else if (detectedFramework === "svelte") {
                const rootElement = document.body;
                componentTree = getSvelteComponentTreeLocal(rootElement, maxDepth, 0);
            }

            const domTree = getDOMTreeLocal(document.body, maxDepth, 0);

            const result = {
                framework: detectedFramework,
                route,
                componentTree: componentTree && componentTree.length > 0 ? componentTree : undefined,
                domTree: domTree.length > 0 ? domTree : undefined,
            };

            return {
                structuredContent: result,
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Error getting component tree: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    },
};

