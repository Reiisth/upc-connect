import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { FormActions } from "@/components/ui/form-actions";
import { Button } from "@/components/ui/button";
import { requireAdministrationPermission } from "../../../access";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateServiceType } from "../../actions";
export default function EditPage({params}:{params:Promise<{key:string}>}){ return <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="administration service types edit" />}><Content params={params}/></Suspense>; }
async function Content({params}:{params:Promise<{key:string}>}){ await requireAdministrationPermission("service_types.manage"); const {key}=await params; const admin=createAdminClient(); const {data,error}=await admin.from("service_types").select("key,name,is_active").eq("key",key).maybeSingle(); if(error)throw new Error("Unable to load service type."); if(!data)notFound(); return <PageContainer><PageHeader backHref="/portal/administration/service-types" backLabel="Back to Service Types" eyebrow="Service Types" eyebrowIcon={<CalendarDays className="h-4 w-4" />} title="Edit Service Type" description={`Stable key: ${data.key}${data.is_active ? "" : " · Inactive"}`}/><form action={updateServiceType.bind(null,data.key)} className="max-w-xl space-y-6"><FormField label="Service Type Name" htmlFor="name" required><Input id="name" name="name" required maxLength={120} defaultValue={data.name}/></FormField><FormActions><Button asChild variant="outline"><Link href="/portal/administration/service-types">Cancel</Link></Button><Button type="submit">Save Changes</Button></FormActions></form></PageContainer>; }
