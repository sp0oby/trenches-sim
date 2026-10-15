import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Social cards need absolute URLs. On Vercel the production domain is injected
// automatically; SITE_URL overrides it (e.g. for a custom domain).
const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173')
).replace(/\/$/, '')

const siteUrl = (): Plugin => ({
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
})

export default defineConfig({
  plugins: [react(), siteUrl()],
  server: { port: 5173 },
})
