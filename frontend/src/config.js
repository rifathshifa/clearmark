/**
 * ClearMark API Configuration
 *
 * In production:
 * - If VITE_API_URL is explicitly set (e.g. https://clearmark-api.onrender.com), uses that URL.
 * - Otherwise defaults to '' (relative path), enabling seamless same-origin deployment on Render/containers.
 *
 * In local development:
 * - Falls back to http://localhost:5000 or the local Vite dev proxy.
 */
export const API_URL =
  import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : (import.meta.env.PROD ? '' : 'http://localhost:5000');
