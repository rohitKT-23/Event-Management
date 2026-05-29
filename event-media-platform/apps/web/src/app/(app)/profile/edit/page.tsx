'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatUserRole } from '@/lib/auth-routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelfieUpload } from '@/components/selfie-upload';

export default function EditProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [username, setUsername] = React.useState(user?.username ?? '');
  const [bio, setBio] = React.useState(user?.bio ?? '');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setUsername(user?.username ?? '');
    setBio(user?.bio ?? '');
  }, [user?.username, user?.bio]);

  const onSave = async () => {
    try {
      setSaving(true);
      const { data } = await api.patch('/users/me', { username, bio });
      setSession(data.user, null);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Edit profile</h1>
        <p className="text-muted-foreground">Update your public profile and upload a face-match selfie.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} readOnly disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={formatUserRole(user?.role)}
              readOnly
              disabled
              className="bg-muted capitalize"
            />
            <p className="text-xs text-muted-foreground">
              Your role controls what you can upload and manage. Contact an admin to change it.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={bio ?? ''}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button onClick={onSave} disabled={saving} variant="gradient">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Face-match selfie</CardTitle>
        </CardHeader>
        <CardContent>
          <SelfieUpload />
        </CardContent>
      </Card>
    </div>
  );
}
