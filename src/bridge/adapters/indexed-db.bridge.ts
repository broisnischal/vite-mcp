import type { AdapterBridge } from "../types.js";

export class IndexedDBBridge implements AdapterBridge {
    async execute(params: {
        action: "list_databases" | "get_database_info" | "get_keys" | "get_entry" | "set_entry" | "delete_entry" | "clear_object_store" | "delete_database";
        databaseName?: string;
        objectStoreName?: string;
        key?: unknown;
        value?: unknown;
    }): Promise<unknown> {
        const action = params.action;
        switch (action) {
            case "list_databases": {
                if (!("indexedDB" in window)) {
                    return {
                        action: "list_databases",
                        databases: [],
                        count: 0,
                    };
                }
                return {
                    action: "list_databases",
                    databases: [],
                    count: 0,
                };
            }
            case "get_database_info": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                const databaseName = params.databaseName;
                if (!databaseName) {
                    throw new Error("databaseName is required for get_database_info action");
                }
                return new Promise((resolve) => {
                    const request = indexedDB.open(databaseName);
                    request.onsuccess = () => {
                        const db = request.result;
                        const objectStores: Array<{ name: string; keyPath: string | null; autoIncrement: boolean }> = [];
                        if (db.objectStoreNames) {
                            for (let i = 0; i < db.objectStoreNames.length; i++) {
                                const storeName = db.objectStoreNames[i] as string;
                                const transaction = db.transaction([storeName], "readonly");
                                const store = transaction.objectStore(storeName);
                                objectStores.push({
                                    name: storeName,
                                    keyPath: store.keyPath as string | null,
                                    autoIncrement: store.autoIncrement,
                                });
                            }
                        }
                        db.close();
                        resolve({
                            action: "get_database_info",
                            name: databaseName,
                            version: db.version,
                            objectStores,
                            found: true,
                        });
                    };
                    request.onerror = () => {
                        resolve({
                            action: "get_database_info",
                            name: databaseName,
                            version: 0,
                            objectStores: [],
                            found: false,
                        });
                    };
                });
            }
            case "get_keys": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(params.databaseName!);
                    request.onsuccess = () => {
                        const db = request.result;
                        const transaction = db.transaction([params.objectStoreName!], "readonly");
                        const store = transaction.objectStore(params.objectStoreName!);
                        const getAllKeysRequest = store.getAllKeys();
                        getAllKeysRequest.onsuccess = () => {
                            db.close();
                            resolve({
                                action: "get_keys",
                                keys: getAllKeysRequest.result,
                                databaseName: params.databaseName,
                                objectStoreName: params.objectStoreName,
                                count: getAllKeysRequest.result.length,
                            });
                        };
                        getAllKeysRequest.onerror = () => {
                            db.close();
                            reject(new Error("Failed to get keys"));
                        };
                    };
                    request.onerror = () => {
                        reject(new Error("Failed to open database"));
                    };
                });
            }
            case "get_entry": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                if (!params.key) {
                    throw new Error("Key is required for get_entry action");
                }
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(params.databaseName!);
                    request.onsuccess = () => {
                        const db = request.result;
                        const transaction = db.transaction([params.objectStoreName!], "readonly");
                        const store = transaction.objectStore(params.objectStoreName!);
                        const getRequest = store.get(params.key as IDBValidKey);
                        getRequest.onsuccess = () => {
                            db.close();
                            resolve({
                                action: "get_entry",
                                found: getRequest.result !== undefined,
                                key: params.key,
                                value: getRequest.result || null,
                                databaseName: params.databaseName,
                                objectStoreName: params.objectStoreName,
                            });
                        };
                        getRequest.onerror = () => {
                            db.close();
                            reject(new Error("Failed to get entry"));
                        };
                    };
                    request.onerror = () => {
                        reject(new Error("Failed to open database"));
                    };
                });
            }
            case "set_entry": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                if (params.key === undefined) {
                    throw new Error("Key is required for set_entry action");
                }
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(params.databaseName!);
                    request.onsuccess = () => {
                        const db = request.result;
                        const transaction = db.transaction([params.objectStoreName!], "readwrite");
                        const store = transaction.objectStore(params.objectStoreName!);
                        const putRequest = store.put(params.value, params.key as IDBValidKey);
                        putRequest.onsuccess = () => {
                            db.close();
                            resolve({
                                action: "set_entry",
                                success: true,
                                key: putRequest.result || params.key,
                                databaseName: params.databaseName,
                                objectStoreName: params.objectStoreName,
                            });
                        };
                        putRequest.onerror = () => {
                            db.close();
                            reject(new Error("Failed to set entry"));
                        };
                    };
                    request.onerror = () => {
                        reject(new Error("Failed to open database"));
                    };
                });
            }
            case "delete_entry": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                if (params.key === undefined) {
                    throw new Error("Key is required for delete_entry action");
                }
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(params.databaseName!);
                    request.onsuccess = () => {
                        const db = request.result;
                        const transaction = db.transaction([params.objectStoreName!], "readwrite");
                        const store = transaction.objectStore(params.objectStoreName!);
                        const deleteRequest = store.delete(params.key as IDBValidKey);
                        deleteRequest.onsuccess = () => {
                            db.close();
                            resolve({
                                action: "delete_entry",
                                success: true,
                                key: params.key,
                                databaseName: params.databaseName,
                                objectStoreName: params.objectStoreName,
                            });
                        };
                        deleteRequest.onerror = () => {
                            db.close();
                            reject(new Error("Failed to delete entry"));
                        };
                    };
                    request.onerror = () => {
                        reject(new Error("Failed to open database"));
                    };
                });
            }
            case "clear_object_store": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(params.databaseName!);
                    request.onsuccess = () => {
                        const db = request.result;
                        const transaction = db.transaction([params.objectStoreName!], "readwrite");
                        const store = transaction.objectStore(params.objectStoreName!);
                        const clearRequest = store.clear();
                        clearRequest.onsuccess = () => {
                            db.close();
                            resolve({
                                action: "clear_object_store",
                                success: true,
                                databaseName: params.databaseName,
                                objectStoreName: params.objectStoreName,
                            });
                        };
                        clearRequest.onerror = () => {
                            db.close();
                            reject(new Error("Failed to clear object store"));
                        };
                    };
                    request.onerror = () => {
                        reject(new Error("Failed to open database"));
                    };
                });
            }
            case "delete_database": {
                if (!("indexedDB" in window)) {
                    throw new Error("IndexedDB is not available");
                }
                return new Promise((resolve, reject) => {
                    const deleteRequest = indexedDB.deleteDatabase(params.databaseName!);
                    deleteRequest.onsuccess = () => {
                        resolve({
                            action: "delete_database",
                            success: true,
                            databaseName: params.databaseName,
                        });
                    };
                    deleteRequest.onerror = () => {
                        reject(new Error("Failed to delete database"));
                    };
                });
            }
            default:
                throw new Error(`Unknown indexedDB action: ${action}`);
        }
    }
}

