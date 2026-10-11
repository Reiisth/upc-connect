export type RoleRecord = {
  id: string;
  key: string;
  name: string | null;
  display_name: string | null;
  description: string | null;
  is_system: boolean;
  is_staff: boolean;
  is_active: boolean;
  created_at: string | null;
};

export type PermissionRecord = {
  id: string;
  key: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
};

export type RoleOverview = RoleRecord & {
  assigned_permission_count: number;
  assigned_user_count: number;
};

export type RoleDetailData = {
  role: RoleRecord;
  permissions: PermissionRecord[];
  currentPermissionIds: string[];
};

export type RoleMetadataInput = {
  displayName: string;
  description: string;
  isStaff: boolean;
};
