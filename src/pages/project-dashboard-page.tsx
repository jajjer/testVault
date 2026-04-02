import { useParams } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjectStore } from "@/store/project-store";

export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Dashboard metrics (run progress, pass rate, activity) will appear here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
          <CardDescription>
            {project?.name ?? "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{project?.description || "No description."}</p>
        </CardContent>
      </Card>
    </div>
  );
}
