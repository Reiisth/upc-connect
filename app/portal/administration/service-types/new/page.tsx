import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { FormActions } from "@/components/ui/form-actions";
import { Button } from "@/components/ui/button";
import { requireAdministrationPermission } from "../../access";
import { createServiceType } from "../actions";
export default function NewPage(){ return <Suspense fallback={<PageContainer><p>Loading…</p></PageContainer>}><Content/></Suspense>; }
async function Content(){ await requireAdministrationPermission("service_types.manage"); return <PageContainer><PageHeader backHref="/portal/administration/service-types" backLabel="Back to Service Types" eyebrow="Service Types" eyebrowIcon={<CalendarDays className="h-4 w-4" />} title="Add Service Type" description="The stable key is generated from this name and cannot be changed later."/><form action={createServiceType} className="max-w-xl space-y-6"><FormField label="Service Type Name" htmlFor="name" required><Input id="name" name="name" required maxLength={120}/></FormField><FormActions><Button asChild variant="outline"><Link href="/portal/administration/service-types">Cancel</Link></Button><Button type="submit">Create Service Type</Button></FormActions></form></PageContainer>; }
