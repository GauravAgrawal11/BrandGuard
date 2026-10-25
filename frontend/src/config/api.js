// API Base Configuration
// In production (e.g. Vercel), set VITE_API_BASE in Environment Variables (e.g. https://brandguard-api.onrender.com)
// In local development, defaults to '' so Vite's proxy seamlessly routes /api and /media without CORS or host mismatch issues.
export const API_BASE = import.meta.env.VITE_API_BASE || '';
