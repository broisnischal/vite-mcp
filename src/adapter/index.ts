// Console adapter
export {
  consoleAdapter,
  consoleAdapterInputSchema,
  consoleAdapterOutputSchema,
} from "./console.js";

// Cookie adapters
export {
  cookieAdapter,
  cookieAdapterInputSchema,
  cookieAdapterOutputSchema,
  getCookieAdapter,
  getCookieInputSchema,
  getCookieOutputSchema,
  setCookieAdapter,
  setCookieInputSchema,
  setCookieOutputSchema,
  editCookieAdapter,
  editCookieInputSchema,
  editCookieOutputSchema,
  removeCookieAdapter,
  removeCookieInputSchema,
  removeCookieOutputSchema,
} from "./cookie.js";

// LocalStorage adapters
export {
  localStorageAdapter,
  localStorageAdapterInputSchema,
  localStorageAdapterOutputSchema,
  getLocalStorageAdapter,
  getLocalStorageInputSchema,
  getLocalStorageOutputSchema,
  setLocalStorageAdapter,
  setLocalStorageInputSchema,
  setLocalStorageOutputSchema,
  editLocalStorageAdapter,
  editLocalStorageInputSchema,
  editLocalStorageOutputSchema,
  removeLocalStorageAdapter,
  removeLocalStorageInputSchema,
  removeLocalStorageOutputSchema,
  clearLocalStorageAdapter,
  clearLocalStorageInputSchema,
  clearLocalStorageOutputSchema,
} from "./local-storage.js";

// SessionStorage adapters
export {
  sessionAdapter,
  sessionAdapterInputSchema,
  sessionAdapterOutputSchema,
  getSessionStorageAdapter,
  getSessionStorageInputSchema,
  getSessionStorageOutputSchema,
  setSessionStorageAdapter,
  setSessionStorageInputSchema,
  setSessionStorageOutputSchema,
  editSessionStorageAdapter,
  editSessionStorageInputSchema,
  editSessionStorageOutputSchema,
  removeSessionStorageAdapter,
  removeSessionStorageInputSchema,
  removeSessionStorageOutputSchema,
  clearSessionStorageAdapter,
  clearSessionStorageInputSchema,
  clearSessionStorageOutputSchema,
} from "./session.js";

// Component routes adapter
export {
  componentRoutesAdapter,
  componentRoutesAdapterInputSchema,
  componentRoutesAdapterOutputSchema,
} from "./component-routes.js";

// Component tree adapter
export {
  componentTreeAdapter,
  componentTreeAdapterInputSchema,
  componentTreeAdapterOutputSchema,
} from "./component-tree.js";

// Performance metrics adapter
export {
  performanceMetricsAdapter,
  performanceMetricsAdapterInputSchema,
  performanceMetricsAdapterOutputSchema,
} from "./performance.js";

// Cache adapters
export {
  listCachesAdapter,
  listCachesInputSchema,
  listCachesOutputSchema,
  getCacheKeysAdapter,
  getCacheKeysInputSchema,
  getCacheKeysOutputSchema,
  getCacheEntryAdapter,
  getCacheEntryInputSchema,
  getCacheEntryOutputSchema,
  setCacheEntryAdapter,
  setCacheEntryInputSchema,
  setCacheEntryOutputSchema,
  deleteCacheEntryAdapter,
  deleteCacheEntryInputSchema,
  deleteCacheEntryOutputSchema,
  deleteCacheAdapter,
  deleteCacheInputSchema,
  deleteCacheOutputSchema,
  clearCacheAdapter,
  clearCacheInputSchema,
  clearCacheOutputSchema,
} from "./cache.js";

// IndexedDB adapters
export {
  listIndexedDBDatabasesAdapter,
  listIndexedDBDatabasesInputSchema,
  listIndexedDBDatabasesOutputSchema,
  getIndexedDBDatabaseInfoAdapter,
  getIndexedDBDatabaseInfoInputSchema,
  getIndexedDBDatabaseInfoOutputSchema,
  getIndexedDBKeysAdapter,
  getIndexedDBKeysInputSchema,
  getIndexedDBKeysOutputSchema,
  getIndexedDBEntryAdapter,
  getIndexedDBEntryInputSchema,
  getIndexedDBEntryOutputSchema,
  setIndexedDBEntryAdapter,
  setIndexedDBEntryInputSchema,
  setIndexedDBEntryOutputSchema,
  deleteIndexedDBEntryAdapter,
  deleteIndexedDBEntryInputSchema,
  deleteIndexedDBEntryOutputSchema,
  clearIndexedDBObjectStoreAdapter,
  clearIndexedDBObjectStoreInputSchema,
  clearIndexedDBObjectStoreOutputSchema,
  deleteIndexedDBDatabaseAdapter,
  deleteIndexedDBDatabaseInputSchema,
  deleteIndexedDBDatabaseOutputSchema,
} from "./indexed-db.js";

export type { AdapterDefinition } from "./types.js";
