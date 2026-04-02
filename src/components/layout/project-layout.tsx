import { Link, Outlet, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { MainHeader } from "@/components/layout/main-header";
import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const name = project?.name ?? "Project";

  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <div className="flex flex-1">
        <ProjectSidebar projectName={name} />
        <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
          <div className="flex items-center gap-2 border-b bg-card px-4 py-2 lg:px-6">
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/projects">
                <ChevronLeft className="h-4 w-4" />
                Projects
              </Link>
            </Button>
          </div>
          <main className="flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
