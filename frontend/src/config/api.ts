/**
 * API Configuration
 * Base URL and endpoints for Fumorive Backend
 */

// Base URLs
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_VERSION = '/api/v1';
export const API_URL = `${API_BASE_URL}${API_VERSION}`;

// Auth Endpoints
export const AUTH_ENDPOINTS = {
  REGISTER: `${API_URL}/auth/register`,
  LOGIN: `${API_URL}/auth/login/json`,
  LOGOUT: `${API_URL}/auth/logout`,
  REFRESH: `${API_URL}/auth/refresh`,
  FORGOT_PASSWORD: `${API_URL}/auth/forgot-password`,
  RESET_PASSWORD: `${API_URL}/auth/reset-password`,
} as const;

// User Endpoints
export const USER_ENDPOINTS = {
  ME: `${API_URL}/users/me`,
  CHANGE_PASSWORD: `${API_URL}/users/me/change-password`,
} as const;

// Session Endpoints
export const SESSION_ENDPOINTS = {
  LIST: `${API_URL}/sessions`,
  CREATE: `${API_URL}/sessions`,
  GET: (id: string) => `${API_URL}/sessions/${id}`,
  UPDATE: (id: string) => `${API_URL}/sessions/${id}`,
  DELETE: (id: string) => `${API_URL}/sessions/${id}`,
  COMPLETE: (id: string) => `${API_URL}/sessions/${id}/complete`,
} as const;

// EEG Endpoints
export const EEG_ENDPOINTS = {
  STREAM: `${API_URL}/eeg/stream`,
  STATUS: `${API_URL}/eeg/status`,
} as const;

// WebSocket URLs
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
export const WS_ENDPOINTS = {
  SESSION: (sessionId: string) => `${WS_BASE_URL}${API_VERSION}/ws/session/${sessionId}`,
  MONITOR: `${WS_BASE_URL}${API_VERSION}/ws/monitor`,
} as const;

// Download URLs
// Primary: GitHub Releases direct download (1-click, always latest version)
// Fallback: Backend-served file (for offline/local development)
export const EEG_DOWNLOAD_URL = 'https://github.com/Apypz/Fumorive/releases/download/v1.0.0/fumorive-eeg-server.zip';
export const DOWNLOAD_ENDPOINTS = {
  EEG_PACKAGE: EEG_DOWNLOAD_URL,
  EEG_PACKAGE_FALLBACK: `${API_URL}/downloads/eeg-package`,
  EEG_PACKAGE_INFO: `${API_URL}/downloads/eeg-package/info`,
} as const;

// Health Check
export const HEALTH_URL = `${API_BASE_URL}/health`;
