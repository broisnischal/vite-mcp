import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Vite + MCP Testing</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      This playground generates test data for MCP adapters.
      <br>
      Open the browser console to see console messages.
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

// Generate test data for MCP adapters
console.log('🚀 Vite MCP Playground initialized')
console.info('ℹ️  This is an info message')
console.warn('⚠️  This is a warning message')
console.error('❌ This is an error message')
console.debug('🐛 This is a debug message')

// Set up localStorage test data
localStorage.setItem('test-key-1', 'test-value-1')
localStorage.setItem('test-key-2', 'test-value-2')
localStorage.setItem('user-preference', 'dark-mode')

// Set up sessionStorage test data
sessionStorage.setItem('session-key-1', 'session-value-1')
sessionStorage.setItem('session-key-2', 'session-value-2')

// Set up cookies test data
document.cookie = 'test-cookie-1=test-value-1; path=/'
document.cookie = 'test-cookie-2=test-value-2; path=/'
document.cookie = 'user-id=12345; path=/'

// Generate more console messages over time
let messageCount = 0
setInterval(() => {
  messageCount++
  const messages = [
    () => console.log(`Log message #${messageCount}`),
    () => console.info(`Info message #${messageCount}`),
    () => console.warn(`Warning message #${messageCount}`),
    () => console.error(`Error message #${messageCount}`),
  ]
  const randomMessage = messages[Math.floor(Math.random() * messages.length)]
  randomMessage()
}, 3000)

console.log('✅ Test data initialized. MCP adapters can now read this data.')