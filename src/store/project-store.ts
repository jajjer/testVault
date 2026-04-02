import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import type { ProjectDoc, ProjectMember } from "@/types/models";

interface ProjectState {
  projects: ProjectDoc[];
  loading: boolean;
  listen: (uid: string) => Unsubscribe;
  stop: () => void;
  createProject: (input: {
    name: string;
    description: string;
    owner: {
      uid: string;
      email: string;
      role: ProjectMember["role"];
    };
  }) => Promise<string>;
}

let activeUnsub: Unsubscribe | null = null;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: true,

  listen: (uid: string) => {
    get().stop();
    set({ loading: true });
    const q = query(
      collection(getFirestoreDb(), "projects"),
      where("memberIds", "array-contains", uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const projects: ProjectDoc[] = snap.docs.map((d) => {
          const data = d.data() as Omit<ProjectDoc, "id">;
          return { id: d.id, ...data };
        });
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        set({ projects, loading: false });
      },
      () => set({ loading: false })
    );
    activeUnsub = unsub;
    return unsub;
  },

  stop: () => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    set({ projects: [], loading: true });
  },

  createProject: async ({ name, description, owner }) => {
    const now = Date.now();
    const member: ProjectMember = {
      uid: owner.uid,
      email: owner.email,
      role: owner.role,
      addedAt: now,
    };
    const ref = await addDoc(collection(getFirestoreDb(), "projects"), {
      name,
      description,
      memberIds: [owner.uid],
      members: [member],
      createdBy: owner.uid,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  },
}));
