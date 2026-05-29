import { env } from '../../config/env.js';
import { BadRequestError } from '../../lib/errors.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
};

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
}

export function assertGoogleOAuthConfigured(): void {
  if (!isGoogleOAuthConfigured()) {
    throw new BadRequestError('Google OAuth is not configured');
  }
}

export function buildGoogleAuthUrl(state: string): string {
  assertGoogleOAuthConfigured();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_CALLBACK_URL!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  assertGoogleOAuthConfigured();

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: env.GOOGLE_CALLBACK_URL!,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new BadRequestError(tokenJson.error_description ?? 'Failed to exchange Google authorization code');
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  const profile = (await profileRes.json()) as GoogleUserInfoResponse;
  if (!profileRes.ok || !profile.sub || !profile.email) {
    throw new BadRequestError('Failed to fetch Google profile');
  }

  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name,
    picture: profile.picture,
    emailVerified: profile.email_verified ?? false,
  };
}
