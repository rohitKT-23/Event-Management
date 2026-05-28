import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@emp/shared';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  bio?: string | null;
  isVerified: boolean;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  setSession: (user: AuthUser | null, accessToken: string | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      clear: () => set({ user: null, accessToken: null }),
    }),
    { name: 'emp-auth', partialize: (s) => ({ user: s.user }) },
  ),
);
