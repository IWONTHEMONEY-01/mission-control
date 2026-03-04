// Step 1: Force HOSTNAME before anything else
process.env.HOSTNAME = '0.0.0.0'

const http = require('http')
const fs = require('fs')
const port = parseInt(process.env.PORT, 10) || 3000

console.log('=== Mission Control starting ===')
console.log(`Node ${process.version} | PORT=${port} | PID=${process.pid}`)
console.log(`DB: ${process.env.MISSION_CONTROL_DB_PATH || '.data/mission-control.db (default)'}`)
console.log(`CWD: ${process.cwd()}`)
console.log(`server.js exists: ${fs.existsSync('./server.js')}`)
console.log(`ENV keys: ${Object.keys(process.env).sort().join(', ')}`)

// Step 2: Start a health responder IMMEDIATELY so Railway sees us alive
// Next.js will take over the port when it starts
const earlyServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', phase: 'loading', timestamp: Date.now() }))
})

earlyServer.listen(port, '0.0.0.0', () => {
  console.log(`Early health responder listening on 0.0.0.0:${port}`)

  // Step 3: Close early server and start Next.js
  earlyServer.close(() => {
    console.log('Early server closed, starting Next.js...')
    try {
      require('./server.js')
      console.log('server.js loaded (async startup in progress)')
    } catch (err) {
      console.error('FATAL: server.js failed to load:', err)
      // Restart health responder with error info
      http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'error', error: err.message, stack: err.stack }))
      }).listen(port, '0.0.0.0', () => {
        console.log(`Error server listening on port ${port}`)
      })
    }
  })
})

earlyServer.on('error', (err) => {
  console.error(`FATAL: Cannot bind to 0.0.0.0:${port}:`, err.message)
  // Try without specifying host
  const fallback = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', phase: 'fallback', timestamp: Date.now() }))
  })
  fallback.listen(port, () => {
    console.log(`Fallback server listening on port ${port} (no host specified)`)
  })
  fallback.on('error', (err2) => {
    console.error(`FATAL: Cannot bind to port ${port} at all:`, err2.message)
    process.exit(1)
  })
})

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})
