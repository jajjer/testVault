import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

/** Keeps `useProjectStore` in sync with Firestore for the signed-in user. */
export function useProjectsSync() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);

  useEffect(() => {
    if (!uid) {
      useProjectStore.getState().stop();
      return;
    }
    return useProjectStore.getState().listen(uid);
  }, [uid]);
}
