"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiSource } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { SourceWizard } from "@/components/source-wizard";

export default function EditSourcePage() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ["source", id],
    queryFn: () => api.get<{ source: ApiSource }>(`/api/sources/${id}`).then((r) => r.source),
  });

  return (
    <RoleGuard require="manage">
      <div className="space-y-6">
        <PageHeader title="Edit source" description="Update connection settings, mappings, schedule or key handling." />
        {isLoading || !data ? (
          <div className="flex h-40 items-center justify-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <SourceWizard existing={data} />
        )}
      </div>
    </RoleGuard>
  );
}
