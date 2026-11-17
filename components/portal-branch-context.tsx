"use client";
import { createContext, useContext } from "react";
import type { PortalBranchOption } from "@/lib/portal-branch";

export const PortalBranchContext = createContext<{branchId:string|null;branches:readonly PortalBranchOption[]}>({branchId:null,branches:[]});
export function usePortalBranch() { return useContext(PortalBranchContext); }
