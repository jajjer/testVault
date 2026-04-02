import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { create } from "zustand";

import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/types/models";

export function canManageContent(role: UserRole): boolean {
  return role === "admin" || role === "test_lead";
}

interface AuthState {
  firebaseUser: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  error: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirestoreDb(), "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

async function ensureProfile(
  user: User,
  displayName?: string
): Promise<UserProfile> {
  const ref = doc(getFirestoreDb(), "users", user.uid);
  const snap = await getDoc(ref);
  const now = Date.now();
  if (!snap.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email ?? "",
      displayName: displayName ?? user.displayName ?? user.email ?? "User",
      role: "tester",
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, profile);
    return profile;
  }
  return snap.data() as UserProfile;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  authLoading: true,
  profileLoading: false,
  error: null,

  init: () => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({
          firebaseUser: null,
          profile: null,
          authLoading: false,
          profileLoading: false,
        });
        return;
      }
      set({ firebaseUser: user, authLoading: false, profileLoading: true });
      try {
        const profile = await fetchProfile(user.uid);
        set({
          profile:
            profile ??
            (await ensureProfile(user)),
          profileLoading: false,
        });
      } catch {
        set({ profile: null, profileLoading: false });
      }
    });
    return unsub;
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign in failed. Try again.";
      set({ error: message });
      throw err;
    }
  },

  signUp: async (email, password, displayName) => {
    set({ error: null });
    try {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password
      );
      await updateProfile(cred.user, { displayName });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Try again.";
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    await signOut(getFirebaseAuth());
  },

  clearError: () => set({ error: null }),
}));
