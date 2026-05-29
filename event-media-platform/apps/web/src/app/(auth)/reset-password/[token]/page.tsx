import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordTokenPage({ params }: Props) {
  const { token } = await params;
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm tokenFromPath={token} />
    </Suspense>
  );
}
