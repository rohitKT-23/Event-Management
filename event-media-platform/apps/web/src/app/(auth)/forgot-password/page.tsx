'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { forgotPasswordSchema } from '@emp/shared';
import type { z } from 'zod';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FormInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormInput) => {
    try {
      await api.post('/auth/forgot-password', values);
      toast.success('If your email exists, a reset link has been sent.');
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">Forgot password</h1>
      <p className="text-sm text-muted-foreground">
        Enter your account email and we&apos;ll send you a password reset link.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reset link</CardTitle>
          <CardDescription>We send a secure one-time link to your inbox.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
            {isSubmitSuccessful && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Check your email for a reset link.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
