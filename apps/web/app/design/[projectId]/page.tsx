import { DesignWizard } from "@/components/design/DesignWizard";

export default function DesignPage({ params }: { params: { projectId: string } }) {
  return <DesignWizard projectId={params.projectId} />;
}
