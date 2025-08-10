import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'

const app = new Hono()

// Allow only our domains (adjust to your actual Pages URL)
const ALLOWED = new Set([
  'https://workly-122.pages.dev',   // your Git-connected project URL
  'https://workly-web.pages.dev',   // legacy direct-upload project (if still used)
  'https://app.workly.app',         // your custom domain (when active)
  'http://localhost:3000',
  'http://localhost:4173',
])

app.use('/*', cors({
  origin: (origin) => (origin && ALLOWED.has(origin)) ? origin : '',
  allowMethods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization'],
  credentials: true,
}))

// Tiny logger
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.path}`)
  await next()
})

// Global error handler → consistent JSON errors
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// Healthcheck: GET /api/health
app.get('/api/health', (c) => c.json({ ok: true }, 200, { 'cache-control': 'no-store' }))

export const onRequest = handle(app)
