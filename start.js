// Wrapper to ensure HOSTNAME is set before Next.js reads it.
// Railway injects HOSTNAME=<container-id> which causes Next.js to bind
// to an unreachable address. Force 0.0.0.0 before anything loads.
process.env.HOSTNAME = '0.0.0.0'

const port = process.env.PORT || '3000'
console.log(`=== Mission Control starting ===`)
console.log(`Node ${process.version} | PORT=${port} | HOSTNAME=0.0.0.0`)
console.log(`DB: ${process.env.MISSION_CONTROL_DB_PATH || '.data/mission-control.db (default)'}`)
console.log(`CWD: ${process.cwd()}`)
console.log(`server.js exists: ${require('fs').existsSync('./server.js')}`)

try {
  require('./server.js')
} catch (err) {
  console.error('FATAL: server.js failed to load:', err)
  // Start a minimal health responder so we can see the error in Railway
  const http = require('http')
  http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'error', error: err.message }))
  }).listen(parseInt(port, 10), '0.0.0.0', () => {
    console.log(`Error server listening on port ${port}`)
  })
}
