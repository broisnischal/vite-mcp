import type { AdapterBridge } from "../types.js";

interface CookieDetails {
  name: string;
  value: string;
  size: number;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string | undefined;
  hostOnly: boolean;
  session: boolean;
}

export class CookieBridge implements AdapterBridge {
  private getCookieDetails(name: string): CookieDetails | null {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [cookieName, ...valueParts] = cookie.trim().split("=");
      if (cookieName?.trim() === name) {
        const value = valueParts.join("=").trim();
        const details: CookieDetails = {
          name: name,
          value: value,
          size: (name + "=" + value).length,
          domain: window.location.hostname,
          path: "/",
          secure: window.location.protocol === "https:",
          httpOnly: false,
          hostOnly: true,
          session: true,
        };
        return details;
      }
    }
    return null;
  }

  private getAllCookiesWithDetails(): CookieDetails[] {
    const cookies: CookieDetails[] = [];
    const cookieString = document.cookie;

    if (!cookieString) {
      return cookies;
    }

    const cookieParts = cookieString.split(";");
    for (const cookie of cookieParts) {
      const [name, ...valueParts] = cookie.trim().split("=");
      if (name) {
        const value = valueParts.join("=").trim();
        const cookieDetail: CookieDetails = {
          name: name.trim(),
          value: value,
          domain: window.location.hostname,
          path: "/",
          secure: window.location.protocol === "https:",
          httpOnly: false,
          hostOnly: true,
          session: true,
          size: (name.trim() + "=" + value).length,
        };
        cookies.push(cookieDetail);
      }
    }

    return cookies;
  }

  private setCookieWithOptions(
    name: string,
    value: string,
    options: {
      path?: string;
      domain?: string;
      expires?: number;
      maxAge?: number;
      secure?: boolean;
      sameSite?: string;
    } = {}
  ): CookieDetails | null {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.path) {
      cookieString += `; path=${options.path}`;
    } else {
      cookieString += `; path=/`;
    }

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    if (options.expires) {
      const expiresDate = new Date(options.expires);
      cookieString += `; expires=${expiresDate.toUTCString()}`;
    } else if (options.maxAge !== undefined) {
      cookieString += `; max-age=${options.maxAge}`;
    }

    if (options.secure) {
      cookieString += `; secure`;
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieString;

    return this.getCookieDetails(name);
  }

  async execute(params: {
    action: "read" | "get" | "set" | "edit" | "remove";
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }): Promise<unknown> {
    const action = params?.action;
    if (!action) {
      throw new Error(`Missing required parameter 'action' for cookie adapter. Received params: ${JSON.stringify(params)}`);
    }

    switch (action) {
      case "read": {
        return {
          action: "read",
          cookies: this.getAllCookiesWithDetails(),
        };
      }
      case "get": {
        const cookie = this.getCookieDetails(params.name!);
        return {
          action: "get",
          cookie: cookie,
        };
      }
      case "set": {
        const setOptions: {
          path?: string;
          domain?: string;
          expires?: number;
          maxAge?: number;
          secure?: boolean;
          sameSite?: string;
        } = {};
        
        if (params.domain !== undefined) {
          setOptions.domain = params.domain;
        }
        if (params.path !== undefined) {
          setOptions.path = params.path;
        }
        if (params.expires !== undefined) {
          setOptions.expires = params.expires;
        }
        if (params.maxAge !== undefined) {
          setOptions.maxAge = params.maxAge;
        }
        if (params.secure !== undefined) {
          setOptions.secure = params.secure;
        }
        if (params.sameSite !== undefined) {
          setOptions.sameSite = params.sameSite;
        }
        
        const cookie = this.setCookieWithOptions(
          params.name!,
          params.value!,
          setOptions
        );
        return {
          action: "set",
          success: true,
          cookie: cookie,
        };
      }
      case "edit": {
        const existing = this.getCookieDetails(params.name!);
        if (!existing) {
          return {
            action: "edit",
            success: false,
            cookie: null,
          };
        }
        const editOptions: {
          path?: string;
          domain?: string;
          expires?: number;
          maxAge?: number;
          secure?: boolean;
          sameSite?: string;
        } = {};
        
        if (params.domain !== undefined) {
          editOptions.domain = params.domain;
        } else {
          editOptions.domain = existing.domain;
        }
        
        if (params.path !== undefined) {
          editOptions.path = params.path;
        } else {
          editOptions.path = existing.path;
        }
        
        if (params.expires !== undefined) {
          editOptions.expires = params.expires;
        }
        
        if (params.maxAge !== undefined) {
          editOptions.maxAge = params.maxAge;
        }
        
        if (params.secure !== undefined) {
          editOptions.secure = params.secure;
        } else {
          editOptions.secure = existing.secure;
        }
        
        if (params.sameSite !== undefined) {
          editOptions.sameSite = params.sameSite;
        }
        
        const cookie = this.setCookieWithOptions(
          params.name!,
          params.value !== undefined ? params.value : existing.value,
          editOptions
        );
        return {
          action: "edit",
          success: true,
          cookie: cookie,
        };
      }
      case "remove": {
        const cookieString = `${encodeURIComponent(params.name!)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${params.path || "/"}`;
        if (params.domain) {
          document.cookie = `${cookieString}; domain=${params.domain}`;
        } else {
          document.cookie = cookieString;
        }
        return {
          action: "remove",
          success: true,
        };
      }
      default:
        throw new Error(`Unknown cookie action: ${action}`);
    }
  }
}

