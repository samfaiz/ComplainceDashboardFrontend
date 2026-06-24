"use client";

import { PageHeader } from "@/components/page-header";
import { SourceWizard } from "@/components/source-wizard";

export default function NewSourcePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Connect a data source" description="Pull endpoint data from your EDR / XDR / SIEM." />
      <SourceWizard />
    </div>
  );
}
