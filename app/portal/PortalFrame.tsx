"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "@/components/ui/intent-link";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PortalBranchContext } from "@/components/portal-branch-context";
import { portalBranchSwitchUrl, portalPageName, type PortalBranchOption } from "@/lib/portal-branch";
import type { PortalUserContext } from "@/lib/portal-user-context";
import { logoutPortal, selectPortalBranch } from "./actions";

export default function PortalFrame({userId,identity,branches,branchId,desktopNavigation,mobileNavigation,children}:{
  userId:string;identity:PortalUserContext;branches:readonly PortalBranchOption[];branchId:string|null;
  desktopNavigation:ReactNode;mobileNavigation:ReactNode;children:ReactNode;
}) {
  const [collapsed,setCollapsed]=useState(false);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const pathname=usePathname(),router=useRouter(),id=useId();
  const storageKey=`upc-sidebar:${userId}`;
  useEffect(()=>{try{setCollapsed(localStorage.getItem(storageKey)==="collapsed");}catch{}},[storageKey]);
  function toggleSidebar(){const next=!collapsed;setCollapsed(next);try{localStorage.setItem(storageKey,next?"collapsed":"expanded");}catch{}}
  function changeBranch(value:string){
    setError("");startTransition(async()=>{
      try{
        const result=await selectPortalBranch(value);
        if(result.error){setError(result.error);return;}
        router.replace(portalBranchSwitchUrl(window.location.href),{scroll:false});
        router.refresh();
      }catch{setError("Unable to change branch. Try again.");}
    });
  }
  return <PortalBranchContext.Provider value={{branchId,branches}}>
    <div className="portal-chrome min-h-screen bg-[#EEF3FB] md:flex" data-sidebar-collapsed={collapsed?"true":undefined}>
      <aside id={`${id}-sidebar`} className="portal-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link href="/portal" aria-label="UPC Connect home" className="flex min-h-20 items-center gap-3 border-b border-slate-200 px-5 py-4">
          <Image src="/upc-logo.png" alt="" width={40} height={40} priority className="shrink-0" />
          <span className="portal-sidebar-brand min-w-0"><span className="block font-heading text-base font-semibold text-[#203264]">UPC CONNECT</span><span className="text-xs text-slate-500">Unified Portal</span></span>
        </Link>
        {desktopNavigation}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="portal-topbar sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-md sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="hidden shrink-0 md:inline-flex" onClick={toggleSidebar} aria-controls={`${id}-sidebar`} aria-expanded={!collapsed} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"}>{collapsed?<PanelLeftOpen aria-hidden="true"/>:<PanelLeftClose aria-hidden="true"/>}</Button>
            <p className="min-w-0 flex-1 truncate font-body text-base font-semibold text-[#203264] sm:text-lg">{portalPageName(pathname)}</p>
            <div className="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto">
              <label className="shrink-0 text-xs font-medium text-slate-600" htmlFor={`${id}-branch`}>Branch</label>
              <Select id={`${id}-branch`} aria-label="Current branch throughout the portal" value={branchId??"all"} disabled={pending||!branches.length} onChange={event=>changeBranch(event.target.value)} className="min-w-0 flex-1 sm:w-52">
                <option value="all">All branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}{branch.isActive?"":" (inactive)"}</option>)}
              </Select>
            </div>
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="flex min-h-11 min-w-0 max-w-[48%] items-center gap-2 rounded-xl px-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#365FA6] sm:max-w-64" aria-label={`Account menu for ${identity.displayName}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF3FB] text-[#365FA6]"><UserRound className="h-5 w-5" aria-hidden="true"/></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#203264]">{identity.displayName}</span><span className="block truncate text-xs text-slate-500">{identity.roles[0]?.displayName??"Account"}{identity.roles.length>1?` +${identity.roles.length-1}`:""}</span></span><ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true"/>
            </button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="break-words">{identity.displayName}</DropdownMenuLabel>
                <div className="space-y-1 px-2 pb-2 text-xs text-slate-600">{identity.roles.map(role=><p key={role.key}>{role.displayName}</p>)}</div>
                <DropdownMenuSeparator/><DropdownMenuItem asChild><Link href="/portal/account">My Account</Link></DropdownMenuItem>
                <form action={logoutPortal}><DropdownMenuItem asChild onSelect={event=>event.preventDefault()}><Button type="submit" variant="ghost" pendingLabel="Signing out..." className="w-full justify-start text-red-700"><LogOut aria-hidden="true"/>Log out</Button></DropdownMenuItem></form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          {pending&&<p role="status" className="mt-2 text-xs text-slate-600">Switching branch...</p>}
        </header>
        <main id="main-content" tabIndex={-1} className="portal-main relative min-w-0 md:pb-0" aria-busy={pending||undefined}>
          {pending&&<div className="absolute inset-0 z-30 bg-[#EEF3FB]/70" aria-hidden="true"/>}
          <div key={branchId??"all"} inert={pending} className="portal-page-padding px-3 py-4 sm:p-5 lg:p-6">{children}</div>
        </main>
      </div>
      {mobileNavigation}
    </div>
  </PortalBranchContext.Provider>;
}
