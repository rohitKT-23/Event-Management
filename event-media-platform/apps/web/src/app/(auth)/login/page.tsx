'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { loginSchema, type LoginInput } from '@emp/shared';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { safeNextPath } from '@/lib/auth-routes';
import { AuthDivider, GoogleSignInButton } from '@/components/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on the server.',
  google_denied: 'Google sign-in was cancelled.',
  google_state_mismatch: 'Google sign-in expired. Please try again.',
  google_auth_failed: 'Google sign-in failed. Please try again.',
  verify_missing_token: 'Email verification link is invalid.',
  verify_failed: 'Email verification link expired or is invalid.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    const error = searchParams.get('error');
    if (error && OAUTH_ERRORS[error]) {
      toast.error(OAUTH_ERRORS[error]);
      router.replace('/login');
      return;
    }

    const verified = searchParams.get('verified');
    if (verified) {
      toast.success(`Email verified — welcome, ${verified}!`);
      router.replace('/login');
    }
  }, [router, searchParams]);

  const onSubmit = async (values: LoginInput) => {
    try {
      const { data } = await api.post('/auth/login', values);
      setSession(data.user, data.accessToken);
      toast.success(`Welcome back, ${data.user.username}!`);
      router.push(safeNextPath(searchParams.get('next')));
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to access your gallery, notifications, and uploads.
      </p>

      <div className="mt-8">
        <GoogleSignInButton />
      </div>
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
