import { Outlet } from "react-router-dom";

import { MainHeader } from "@/components/layout/main-header";

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <main className="flex-1 bg-muted/30 p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}
