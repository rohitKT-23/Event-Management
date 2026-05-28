/**
 * Minimal OpenAPI 3 spec. We document the contract here rather than
 * with a code-generator so the spec stays human-readable in PRs. The
 * full surface lives in the per-module READMEs; this file documents
 * the auth flow + key resources sufficient for Swagger UI exploration.
 */
import { env } from '../config/env.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Event & Media Management Platform API',
    version: '0.1.0',
    description: 'REST + WebSocket API for clubs, events, albums and media.',
  },
  servers: [{ url: `${env.API_BASE_URL}/api/v1` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Email + password login', responses: { '200': { description: 'OK' } } },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Rotate refresh token', responses: { '200': { description: 'OK' } } },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke refresh token', responses: { '204': { description: 'No Content' } } },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'], summary: 'Current user', security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/events': {
      get: { tags: ['Events'], summary: 'List events (filterable)', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Events'], summary: 'Create event', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
    '/media/presigned-url': {
      post: {
        tags: ['Media'], summary: 'Get a presigned S3 PUT URL', security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/media/upload': {
      post: {
        tags: ['Media'], summary: 'Finalize an upload after S3 PUT', security: [{ bearerAuth: [] }],
        responses: { '202': { description: 'Accepted' } },
      },
    },
    '/search': {
      get: { tags: ['Search'], summary: 'Smart search', responses: { '200': { description: 'OK' } } },
    },
  },
} as const;
