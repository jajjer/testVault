import { Outlet } from "react-router-dom";

import { useProjectsSync } from "@/hooks/use-projects-sync";

export function SyncedLayout() {
  useProjectsSync();
  return <Outlet />;
}
