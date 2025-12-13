export function detectRoutingFramework(): string | null {
    if (typeof window === "undefined") return null;

    if ((window as any).__REACT_ROUTER__ || (window as any).__REACT_ROUTER_V6__) {
        return "react-router";
    }
    if ((window as any).__VUE_ROUTER__) {
        return "vue-router";
    }
    if ((window as any).__TANSTACK_ROUTER__ || (window as any).__TANSTACK_START__) {
        return "tanstack-router";
    }
    if ((window as any).__REMIX__ || (window as any).__remixContext) {
        return "remix";
    }
    if ((window as any).__NEXT_ROUTER_BASEPATH || (window as any).__NEXT_DATA__) {
        return "next";
    }
    if ((window as any).__SVELTEKIT__) {
        return "sveltekit";
    }
    if ((window as any).React) {
        try {
            const reactRoot = document.querySelector("#root") || document.querySelector("#app") || document.body;
            const fiber = (reactRoot as any)._reactInternalFiber || (reactRoot as any)._reactInternalInstance || (reactRoot as any).__reactFiber;
            if (fiber) {
                return "react-router";
            }
        } catch (e) {
            // ignore
        }
    }
    return null;
}

export async function getComponentRoutes(framework: string = "auto") {
    const detectedFramework = framework === "auto" ? detectRoutingFramework() : framework;
    const routes: Array<{
        path: string;
        component?: string;
        isActive: boolean;
        params?: Record<string, string>;
        query?: Record<string, string>;
        framework?: string;
    }> = [];
    let currentRoute: {
        path: string;
        component?: string;
        params?: Record<string, string>;
        query?: Record<string, string>;
    } | null = null;

    if (detectedFramework === "react-router") {
        const routerState = (window as any).__REACT_ROUTER_STATE__;
        if (routerState) {
            routes.push(...(routerState.routes || []));
            currentRoute = routerState.currentRoute || null;
        } else {
            const router = (window as any).__REACT_ROUTER__;
            if (router?.state?.location) {
                routes.push({
                    path: router.state.location.pathname,
                    isActive: true,
                    params: router.state.params || {},
                    query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
                    framework: "react-router",
                });
                currentRoute = {
                    path: router.state.location.pathname,
                    params: router.state.params || {},
                    query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
                };
            } else {
                const path = window.location.pathname;
                const search = window.location.search;
                const queryParams: Record<string, string> = {};
                if (search) {
                    new URLSearchParams(search).forEach((value, key) => {
                        queryParams[key] = value;
                    });
                }
                routes.push({
                    path: path,
                    isActive: true,
                    params: {},
                    query: queryParams,
                    framework: "react-router",
                });
                currentRoute = {
                    path: path,
                    params: {},
                    query: queryParams,
                };
            }
        }
    } else if (detectedFramework === "vue-router") {
        const router = (window as any).__VUE_ROUTER_INSTANCE__;
        if (router) {
            const current = router.currentRoute;
            routes.push(...(router.getRoutes() || []).map((route: any) => ({
                path: route.path,
                component: route.name || route.component?.name,
                isActive: route.path === current?.path,
                params: current?.params || {},
                query: current?.query || {},
                framework: "vue-router",
            })));
            currentRoute = {
                path: current?.path || window.location.pathname,
                component: current?.name,
                params: current?.params || {},
                query: current?.query || {},
            };
        } else {
            const path = window.location.pathname;
            routes.push({
                path: path,
                isActive: true,
                framework: "vue-router",
            });
            currentRoute = {
                path: path,
            };
        }
    } else if (detectedFramework === "tanstack-router") {
        const router = (window as any).__TANSTACK_ROUTER__;
        if (router?.state) {
            routes.push({
                path: router.state.location.pathname,
                isActive: true,
                params: router.state.params || {},
                query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
                framework: "tanstack-router",
            });
            currentRoute = {
                path: router.state.location.pathname,
                params: router.state.params || {},
                query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
            };
        } else {
            const path = window.location.pathname;
            const search = window.location.search;
            const queryParams: Record<string, string> = {};
            if (search) {
                new URLSearchParams(search).forEach((value, key) => {
                    queryParams[key] = value;
                });
            }
            routes.push({
                path: path,
                isActive: true,
                query: queryParams,
                framework: "tanstack-router",
            });
            currentRoute = {
                path: path,
                query: queryParams,
            };
        }
    } else if (detectedFramework === "remix") {
        const context = (window as any).__remixContext || (window as any).__REMIX__;
        if (context?.route) {
            routes.push({
                path: context.route.path || window.location.pathname,
                isActive: true,
                params: context.params || {},
                framework: "remix",
            });
            currentRoute = {
                path: context.route.path || window.location.pathname,
                params: context.params || {},
            };
        } else {
            const path = window.location.pathname;
            routes.push({
                path: path,
                isActive: true,
                framework: "remix",
            });
            currentRoute = {
                path: path,
            };
        }
    } else {
        const path = window.location.pathname;
        const search = window.location.search;
        const queryParams: Record<string, string> = {};
        if (search) {
            new URLSearchParams(search).forEach((value, key) => {
                queryParams[key] = value;
            });
        }
        routes.push({
            path: path,
            isActive: true,
            query: queryParams,
        });
        currentRoute = {
            path: path,
            query: queryParams,
        };
    }

    return {
        routes,
        currentRoute,
        framework: detectedFramework || undefined,
    };
}

