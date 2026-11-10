import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionButton } from "@/components/ui/table-action-button";
import { requireAdministrationPermission } from "../access";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusAction } from "./StatusAction";

export default function ServiceTypesPage() { return <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="administration service types" />}><Content /></Suspense>; }
async function Content() {
  "use cache: private";
  cacheLife({ stale: 300 });
  cacheTag("portal:administration-service-types");
  const access = await requireAdministrationPermission("service_types.view");
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_types").select("key,name,is_active").order("name").order("key");
  if (error) throw new Error("Unable to load service types.");
  const canManage = hasPermission(access.permissions, "service_types.manage");
  return <PageContainer><PageHeader backHref="/portal/administration" backLabel="Back to Administration" eyebrow="Administration" eyebrowIcon={<CalendarDays className="h-4 w-4" />} title="Service Types" description="Manage global service labels used by new and historical services." action={canManage ? <Button asChild><Link href="/portal/administration/service-types/new"><Plus />Add Service Type</Link></Button> : undefined} />
    <Table><TableHeader><TableRow><TableHead>Service Type</TableHead><TableHead>Stable Key</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{(data ?? []).map((row) => <TableRow key={row.key}><TableCell className="font-medium">{row.name}</TableCell><TableCell><code>{row.key}</code></TableCell><TableCell><StatusBadge variant={row.is_active ? "success" : "muted"}>{row.is_active ? "Active" : "Inactive"}</StatusBadge></TableCell><TableCell><div className="flex gap-3">{canManage && <><TableActionButton href={`/portal/administration/service-types/${encodeURIComponent(row.key)}/edit`}>Edit</TableActionButton><StatusAction typeKey={row.key} name={row.name} active={row.is_active}/></>}</div></TableCell></TableRow>)}</TableBody></Table>
  </PageContainer>;
}
