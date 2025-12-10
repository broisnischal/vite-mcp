import { defineConfig } from 'vite'
import { consoleAdapter, cookieAdapter, localStorageAdapter, sessionAdapter, viteMcp } from '../src'

export default defineConfig({
    plugins: [
        viteMcp({
            adapters: [
                consoleAdapter,
                localStorageAdapter,
                cookieAdapter,
                sessionAdapter,
            ]
        }),
    ],
    server: {
        port: 5200,
    },
})