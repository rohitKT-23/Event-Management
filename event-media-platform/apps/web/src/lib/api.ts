/**
 * Centralised Axios instance.
 *
 * - Sends credentials so the access_token cookie travels with each
 *   request (we also support an Authorization header if the caller
 *   passes one via interceptor below).
 * - On 401 it tries a single refresh + retry before bailing.
 */
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status !== 401 || original?._retried) {
      return Promise.reject(error);
    }
    if (original?.url?.includes('/auth/')) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) return reject(error);
          original._retried = true;
          if (token && original.headers) original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const res = await api.post('/auth/refresh');
      const token = (res.data as { accessToken?: string }).accessToken ?? null;
      flushQueue(token);
      original._retried = true;
      if (token && original.headers) original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (err) {
      flushQueue(null);
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export type ApiError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

export function extractApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    if (data?.code) return data;
    return { status: err.response?.status ?? 0, code: 'NETWORK', message: err.message };
  }
  return { status: 0, code: 'UNKNOWN', message: 'Unexpected error' };
}
