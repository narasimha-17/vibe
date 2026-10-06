import { BuilderClient } from "@/components/builder/BuilderClient";

export default function BuilderPage({ params }: { params: { projectId: string } }) {
  return <BuilderClient projectId={params.projectId} />;
}
