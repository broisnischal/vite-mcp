interface ComponentTreeNode {
  name: string;
  type: string;
  props?: Record<string, unknown>;
  state?: unknown;
  children?: ComponentTreeNode[];
  key?: string;
  framework?: string;
  id?: string;
  className?: string;
  text?: string;
}

export function detectComponentFramework(): string | null {
  if (typeof window === "undefined") return null;

  if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return "react";
  }
  if ((window as any).__VUE__ || (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    return "vue";
  }
  if ((window as any).__SVELTE__ || (window as any).__svelte) {
    return "svelte";
  }
  if ((window as any).React || (window as any).__REACT__) {
    try {
      const reactRoot = document.querySelector("#root") || document.querySelector("#app") || document.querySelector("[data-reactroot]") || document.body;
      const fiber = (reactRoot as any)._reactInternalFiber || (reactRoot as any)._reactInternalInstance || (reactRoot as any).__reactFiber || (reactRoot as any).__reactInternalInstance;
      if (fiber) {
        return "react";
      }
    } catch (e) {
      // ignore
    }
  }
  if (document.querySelector("[data-svelte-h]") || document.querySelector("[data-hydrate]")) {
    return "svelte";
  }
  return null;
}

export function traverseReactFiber(
  fiber: any,
  maxDepth: number,
  currentDepth: number = 0,
  includeProps: boolean = false,
  includeState: boolean = false,
  seen: WeakSet<object> = new WeakSet()
): ComponentTreeNode | null {
  if (currentDepth >= maxDepth || !fiber) {
    return null;
  }

  const componentName =
    fiber.type?.displayName ||
    fiber.type?.name ||
    (typeof fiber.type === "string" ? fiber.type : "Unknown");

  const node: ComponentTreeNode = {
    name: componentName,
    type: fiber.type?.prototype?.isReactComponent ? "class" : "functional",
  };

  if (includeProps && fiber.memoizedProps) {
    try {
      const propsSeen = new WeakSet();
      node.props = JSON.parse(JSON.stringify(fiber.memoizedProps, (key: string, value: unknown) => {
        if (typeof value === "function") return "[Function]";
        if (typeof value === "object" && value !== null) {
          if (propsSeen.has(value)) return "[Circular]";
          propsSeen.add(value);
        }
        return value;
      }));
    } catch (e) {
      node.props = { error: "Could not serialize props" };
    }
  }

  if (includeState && fiber.memoizedState) {
    try {
      const stateSeen = new WeakSet();
      node.state = JSON.parse(JSON.stringify(fiber.memoizedState, (key: string, value: unknown) => {
        if (typeof value === "function") return "[Function]";
        if (typeof value === "object" && value !== null) {
          if (stateSeen.has(value)) return "[Circular]";
          stateSeen.add(value);
        }
        return value;
      }));
    } catch (e) {
      node.state = { error: "Could not serialize state" };
    }
  }

  if (fiber.key) {
    node.key = String(fiber.key);
  }

  node.framework = "react";

  const children: ComponentTreeNode[] = [];
  let child = fiber.child;
  while (child) {
    const childNode = traverseReactFiber(
      child,
      maxDepth,
      currentDepth + 1,
      includeProps,
      includeState,
      seen
    );
    if (childNode) {
      children.push(childNode);
    }
    child = child.sibling;
  }

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

export function traverseDOMTree(
  element: Element | Node,
  maxDepth: number,
  currentDepth: number = 0
): ComponentTreeNode | null {
  if (currentDepth >= maxDepth || !element) {
    return null;
  }

  const node: ComponentTreeNode = {
    name: (element as Element).tagName?.toLowerCase() || (element as Node).nodeName?.toLowerCase() || "text",
    type: "dom",
  };

  if ((element as Element).attributes && (element as Element).attributes.length > 0) {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < (element as Element).attributes.length; i++) {
      const attr = (element as Element).attributes[i];
      attrs[attr.name] = attr.value;
    }
    if (Object.keys(attrs).length > 0) {
      node.props = attrs;
    }
  }

  if ((element as Element).id) {
    node.id = (element as Element).id;
  }
  if ((element as Element).className && typeof (element as Element).className === "string") {
    node.className = (element as Element).className;
  }

  const children: ComponentTreeNode[] = [];
  let child = element.firstChild;
  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childNode = traverseDOMTree(child as Element, maxDepth, currentDepth + 1);
      if (childNode) {
        children.push(childNode);
      }
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      const text = child.textContent.trim();
      if (text.length > 0 && text.length < 100) {
        children.push({
          name: "#text",
          type: "text",
          text: text,
        });
      }
    }
    child = child.nextSibling;
  }

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

function countNodes(node: ComponentTreeNode | null): number {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    node.children.forEach((child) => {
      count += countNodes(child);
    });
  }
  return count;
}

export async function getComponentTree(
  framework: string = "auto",
  maxDepth: number = 10,
  includeProps: boolean = false,
  includeState: boolean = false
): Promise<{
  tree: ComponentTreeNode | null;
  framework?: string;
  componentCount: number;
}> {
  const detectedFramework = framework === "auto" ? detectComponentFramework() : framework;
  let tree: ComponentTreeNode | null = null;
  let componentCount = 0;

  if (detectedFramework === "react") {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      try {
        const rendererID = hook.rendererID || 1;
        const roots = hook.getFiberRoots(rendererID) || hook.getFiberRoots?.(rendererID) || new Set();
        const rootFiber = roots.values().next().value?.current;

        if (rootFiber) {
          tree = traverseReactFiber(rootFiber, maxDepth, 0, includeProps, includeState);
          componentCount = countNodes(tree);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!tree) {
      try {
        const rootSelectors = ["#root", "#app", "[data-reactroot]", "[data-react-root]", "body"];
        for (const selector of rootSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const fiber = (element as any)._reactInternalFiber ||
              (element as any)._reactInternalInstance?.current ||
              (element as any)._reactRootContainer?._internalRoot?.current ||
              (element as any).__reactInternalInstance ||
              (element as any).__reactFiber ||
              (element as any)._reactRoot;

            if (fiber) {
              tree = traverseReactFiber(fiber, maxDepth, 0, includeProps, includeState);
              componentCount = countNodes(tree);
              break;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
  } else if (detectedFramework === "vue") {
    const app = (window as any).__VUE__;
    if (app?._instance || app?.__instance) {
      try {
        const instance = app._instance || app.__instance;
        const traverseVueInstance = (inst: any, depth: number = 0): ComponentTreeNode | null => {
          if (depth >= maxDepth || !inst) return null;

          const node: ComponentTreeNode = {
            name: inst.type?.name || inst.type?.__name || inst.$options?.name || "VueComponent",
            type: "component",
            framework: "vue",
          };

          if (includeProps && inst.$props) {
            try {
              const propsSeen = new WeakSet();
              node.props = JSON.parse(JSON.stringify(inst.$props, (key: string, value: unknown) => {
                if (typeof value === "function") return "[Function]";
                if (typeof value === "object" && value !== null) {
                  if (propsSeen.has(value)) return "[Circular]";
                  propsSeen.add(value);
                }
                return value;
              }));
            } catch (e) {
              node.props = { error: "Could not serialize props" };
            }
          }

          if (includeState && inst.$data) {
            try {
              const stateSeen = new WeakSet();
              node.state = JSON.parse(JSON.stringify(inst.$data, (key: string, value: unknown) => {
                if (typeof value === "function") return "[Function]";
                if (typeof value === "object" && value !== null) {
                  if (stateSeen.has(value)) return "[Circular]";
                  stateSeen.add(value);
                }
                return value;
              }));
            } catch (e) {
              node.state = { error: "Could not serialize state" };
            }
          }

          const children: ComponentTreeNode[] = [];
          if (inst.$children) {
            inst.$children.forEach((child: any) => {
              const childNode = traverseVueInstance(child, depth + 1);
              if (childNode) children.push(childNode);
            });
          }

          if (children.length > 0) {
            node.children = children;
          }

          return node;
        };

        tree = traverseVueInstance(instance);
        componentCount = countNodes(tree) || 1;
      } catch (e) {
        // ignore
      }
    }
  } else if (detectedFramework === "svelte") {
    if ((window as any).__SVELTE__ || (window as any).__svelte) {
      tree = {
        name: "SvelteApp",
        type: "component",
        framework: "svelte",
      };
      componentCount = 1;
    }
  }

  if (!tree) {
    try {
      const rootElement = document.documentElement || document.body || document;
      tree = traverseDOMTree(rootElement as Element, maxDepth, 0);

      if (!tree) {
        tree = {
          name: "Document",
          type: "dom",
          children: [],
        };
        componentCount = 1;
      } else {
        componentCount = countNodes(tree);
      }
    } catch (e) {
      tree = {
        name: "Document",
        type: "dom",
        children: [],
      };
      componentCount = 1;
    }
  }

  return {
    tree,
    framework: detectedFramework || undefined,
    componentCount,
  };
}

