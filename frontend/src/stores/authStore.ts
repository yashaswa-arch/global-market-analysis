import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { create } from "zustand";

interface AuthState {
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  setUser: (userId: string | null, email: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  isLoading: true,
  setUser: (userId, email) => set({ userId, email }),
  setLoading: (isLoading) => set({ isLoading }),
}));

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setUser(session?.user.id ?? null, session?.user.email ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.id ?? null, session?.user.email ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [setUser, setLoading]);
}
