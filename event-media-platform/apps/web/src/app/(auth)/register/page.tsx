'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput, UserRole } from '@emp/shared';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { AuthDivider, GoogleSignInButton } from '@/components/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const roles: { value: typeof UserRole.VIEWER | typeof UserRole.CLUB_MEMBER | typeof UserRole.PHOTOGRAPHER; label: string; hint: string }[] = [
  { value: UserRole.VIEWER, label: 'Viewer', hint: 'Browse public events' },
  { value: UserRole.CLUB_MEMBER, label: 'Club Member', hint: 'Belong to a club' },
  { value: UserRole.PHOTOGRAPHER, label: 'Photographer', hint: 'Upload & manage media' },
];

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', role: UserRole.VIEWER },
  });
  const selectedRole = watch('role');

  const onSubmit = async (values: RegisterInput) => {
    try {
      const { data } = await api.post('/auth/register', values);
      setSession(data.user, data.accessToken);
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Start uploading, tagging, and sharing in minutes.
      </p>

      <div className="mt-6">
        <GoogleSignInButton label="Sign up with Google" />
      </div>
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" placeholder="e.g. lens.master" {...register('username')} />
          {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          <p className="text-xs text-muted-foreground">
            8+ characters, with upper, lower, and a digit.
          </p>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Sign up as</Label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setValue('role', r.value)}
                className={
                  'rounded-lg border p-3 text-left transition ' +
                  (selectedRole === r.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent')
                }
              >
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
