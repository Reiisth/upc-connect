
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "account_members": {
                  Row: {
                    "can_edit": boolean | null,"can_view": boolean | null,"created_at": string | null,"id": string,"member_id": string,"relationship": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_edit"?: boolean | null,"can_view"?: boolean | null,"created_at"?: string | null,"id"?: string,"member_id": string,"relationship": string,"user_id": string
                  }
                  Update: {
                    "can_edit"?: boolean | null,"can_view"?: boolean | null,"created_at"?: string | null,"id"?: string,"member_id"?: string,"relationship"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_report_documents": {
                  Row: {
                    "branch_ids": (string)[],"created_at": string,"created_by": string | null,"description": string,"id": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_ids": (string)[],"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"result": NonNullable<Json>
                  }
                  Update: {
                    "branch_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_report_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "attendance_status": string,"check_in_time": string | null,"created_at": string,"id": string,"member_id": string,"method": string,"notes": string | null,"recorded_by": string | null,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_status"?: string,"check_in_time"?: string | null,"created_at"?: string,"id"?: string,"member_id": string,"method"?: string,"notes"?: string | null,"recorded_by"?: string | null,"service_id": string
                  }
                  Update: {
                    "attendance_status"?: string,"check_in_time"?: string | null,"created_at"?: string,"id"?: string,"member_id"?: string,"method"?: string,"notes"?: string | null,"recorded_by"?: string | null,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_records_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_records_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"baptism_records": {
                  Row: {
                    "baptism_date": string | null,"baptism_type": string,"church_branch_id": string,"created_at": string,"id": string,"location": string | null,"member_id": string,"notes": string | null,"officiated_by": string | null,"recorded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "baptism_date"?: string | null,"baptism_type": string,"church_branch_id": string,"created_at"?: string,"id"?: string,"location"?: string | null,"member_id": string,"notes"?: string | null,"officiated_by"?: string | null,"recorded_by"?: string | null
                  }
                  Update: {
                    "baptism_date"?: string | null,"baptism_type"?: string,"church_branch_id"?: string,"created_at"?: string,"id"?: string,"location"?: string | null,"member_id"?: string,"notes"?: string | null,"officiated_by"?: string | null,"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "baptism_records_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "baptism_records_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "baptism_records_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"church_branches": {
                  Row: {
                    "barangay": string | null,"city": string | null,"code": string | null,"country": string | null,"created_at": string | null,"id": string,"inactivity_threshold_weeks": number,"is_active": boolean,"name": string,"province": string | null,"street_address": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barangay"?: string | null,"city"?: string | null,"code"?: string | null,"country"?: string | null,"created_at"?: string | null,"id"?: string,"inactivity_threshold_weeks"?: number,"is_active"?: boolean,"name": string,"province"?: string | null,"street_address"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "barangay"?: string | null,"city"?: string | null,"code"?: string | null,"country"?: string | null,"created_at"?: string | null,"id"?: string,"inactivity_threshold_weeks"?: number,"is_active"?: boolean,"name"?: string,"province"?: string | null,"street_address"?: string | null,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"departments": {
                  Row: {
                    "created_at": string | null,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"financial_contributions": {
                  Row: {
                    "amount": number,"church_branch_id": string,"contribution_date": string,"contribution_type": string,"contributor_type": string,"created_at": string,"id": string,"member_id": string | null,"notes": string | null,"payment_method": string,"recorded_by": string | null,"service_id": string | null,"visitor_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"church_branch_id": string,"contribution_date"?: string,"contribution_type": string,"contributor_type": string,"created_at"?: string,"id"?: string,"member_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"recorded_by"?: string | null,"service_id"?: string | null,"visitor_name"?: string | null
                  }
                  Update: {
                    "amount"?: number,"church_branch_id"?: string,"contribution_date"?: string,"contribution_type"?: string,"contributor_type"?: string,"created_at"?: string,"id"?: string,"member_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"recorded_by"?: string | null,"service_id"?: string | null,"visitor_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_contributions_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_contributions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_contributions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_contributions_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"member_custom_field_values": {
                  Row: {
                    "created_at": string,"field_definition_id": string,"id": string,"member_id": string,"updated_at": string,"value": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"field_definition_id": string,"id"?: string,"member_id": string,"updated_at"?: string,"value"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"field_definition_id"?: string,"id"?: string,"member_id"?: string,"updated_at"?: string,"value"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_custom_field_values_field_definition_id_fkey"
      columns: ["field_definition_id"]
isOneToOne: false
      referencedRelation: "member_field_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_custom_field_values_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"member_field_definitions": {
                  Row: {
                    "created_at": string,"field_group": string | null,"field_key": string,"field_type": string,"id": string,"is_builtin": boolean,"is_required": boolean,"is_visible": boolean,"label": string,"options": Json | null,"options_source": string | null,"placeholder": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"field_group"?: string | null,"field_key": string,"field_type": string,"id"?: string,"is_builtin"?: boolean,"is_required"?: boolean,"is_visible"?: boolean,"label": string,"options"?: Json | null,"options_source"?: string | null,"placeholder"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"field_group"?: string | null,"field_key"?: string,"field_type"?: string,"id"?: string,"is_builtin"?: boolean,"is_required"?: boolean,"is_visible"?: boolean,"label"?: string,"options"?: Json | null,"options_source"?: string | null,"placeholder"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"member_follow_ups": {
                  Row: {
                    "church_branch_id": string,"created_at": string,"created_by": string | null,"follow_up_date": string,"followed_up_by": string | null,"id": string,"member_id": string,"method": string,"next_follow_up_date": string | null,"notes": string | null,"outcome": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "church_branch_id": string,"created_at"?: string,"created_by"?: string | null,"follow_up_date": string,"followed_up_by"?: string | null,"id"?: string,"member_id": string,"method": string,"next_follow_up_date"?: string | null,"notes"?: string | null,"outcome": string,"updated_at"?: string
                  }
                  Update: {
                    "church_branch_id"?: string,"created_at"?: string,"created_by"?: string | null,"follow_up_date"?: string,"followed_up_by"?: string | null,"id"?: string,"member_id"?: string,"method"?: string,"next_follow_up_date"?: string | null,"notes"?: string | null,"outcome"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_follow_ups_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_follow_ups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_follow_ups_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "accepted_at": string | null,"account_status": string,"archived_at": string | null,"barangay": string | null,"birth_date": string | null,"church_branch_id": string | null,"city": string | null,"civil_status": string | null,"country": string | null,"created_at": string | null,"department": string | null,"department_id": string | null,"first_attendance_date": string | null,"first_name": string,"gender": string | null,"id": string,"invited_at": string | null,"invited_by": string | null,"is_archived": boolean,"last_name": string,"member_status": string | null,"middle_name": string | null,"nickname": string | null,"phone_number": string | null,"photo_url": string | null,"position": string | null,"profile_completed_at": string | null,"profile_status": string,"province": string | null,"street_address": string | null,"updated_at": string | null,"wedding_anniversary": string | null,"zone": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"account_status"?: string,"archived_at"?: string | null,"barangay"?: string | null,"birth_date"?: string | null,"church_branch_id"?: string | null,"city"?: string | null,"civil_status"?: string | null,"country"?: string | null,"created_at"?: string | null,"department"?: string | null,"department_id"?: string | null,"first_attendance_date"?: string | null,"first_name": string,"gender"?: string | null,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"is_archived"?: boolean,"last_name": string,"member_status"?: string | null,"middle_name"?: string | null,"nickname"?: string | null,"phone_number"?: string | null,"photo_url"?: string | null,"position"?: string | null,"profile_completed_at"?: string | null,"profile_status"?: string,"province"?: string | null,"street_address"?: string | null,"updated_at"?: string | null,"wedding_anniversary"?: string | null,"zone"?: number | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"account_status"?: string,"archived_at"?: string | null,"barangay"?: string | null,"birth_date"?: string | null,"church_branch_id"?: string | null,"city"?: string | null,"civil_status"?: string | null,"country"?: string | null,"created_at"?: string | null,"department"?: string | null,"department_id"?: string | null,"first_attendance_date"?: string | null,"first_name"?: string,"gender"?: string | null,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"is_archived"?: boolean,"last_name"?: string,"member_status"?: string | null,"middle_name"?: string | null,"nickname"?: string | null,"phone_number"?: string | null,"photo_url"?: string | null,"position"?: string | null,"profile_completed_at"?: string | null,"profile_status"?: string,"province"?: string | null,"street_address"?: string | null,"updated_at"?: string | null,"wedding_anniversary"?: string | null,"zone"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"key": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"key": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"key"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "archived_at": string | null,"created_at": string | null,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [

                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"permission_id": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"permission_id": string,"role_id": string
                  }
                  Update: {
                    "created_at"?: string,"permission_id"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_id_fkey"
      columns: ["permission_id"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"display_name": string,"id": string,"is_active": boolean,"is_staff": boolean,"is_system": boolean,"key": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"display_name": string,"id"?: string,"is_active"?: boolean,"is_staff"?: boolean,"is_system"?: boolean,"key": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"display_name"?: string,"id"?: string,"is_active"?: boolean,"is_staff"?: boolean,"is_system"?: boolean,"key"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"service_types": {
                  Row: {
                    "created_at": string,"is_active": boolean,"key": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_active"?: boolean,"key": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"is_active"?: boolean,"key"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"services": {
                  Row: {
                    "church_branch_id": string,"created_at": string,"ended_at": string | null,"id": string,"name": string,"notes": string | null,"service_date": string,"service_type": string,"start_time": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "church_branch_id": string,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"service_date": string,"service_type": string,"start_time"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "church_branch_id"?: string,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"service_date"?: string,"service_type"?: string,"start_time"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_service_type_fkey"
      columns: ["service_type"]
isOneToOne: false
      referencedRelation: "service_types"
      referencedColumns: ["key"]
    }
                  ]
                },"user_branch_access": {
                  Row: {
                    "church_branch_id": string,"created_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "church_branch_id": string,"created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "church_branch_id"?: string,"created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_branch_access_church_branch_id_fkey"
      columns: ["church_branch_id"]
isOneToOne: false
      referencedRelation: "church_branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_branch_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string | null,"id": string,"role_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"role_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "finalize_service_attendance":
{ Args: { "p_actor_id": string,"p_preview"?: boolean,"p_service_id": string }; Returns: Json
                           },
"get_baptism_module_summary":
{ Args: { "p_branch_ids": (string)[],"p_from": string,"p_to": string }; Returns: Json
                           },
"get_module_summary":
{ Args: { "p_branch_ids": (string)[],"p_from": string,"p_module": string,"p_to": string }; Returns: Json
                           },
"get_reports_analytics":
{ Args: { "p_as_of": string,"p_branch_ids": (string)[],"p_from": string,"p_grouping": string,"p_to": string }; Returns: Json
                           },
"has_any_permission":
{ Args: { "permission_keys": (string)[] }; Returns: boolean
                           },
"has_any_role":
{ Args: { "role_names": (string)[] }; Returns: boolean
                           },
"has_branch_access":
{ Args: { "branch_id": string }; Returns: boolean
                           },
"has_permission":
{ Args: { "permission_key": string }; Returns: boolean
                           },
"has_role":
{ Args: { "role_name": string }; Returns: boolean
                           },
"link_invited_member":
{ Args: { "p_invited_by": string,"p_member_id": string,"p_user_id": string }; Returns: undefined
                           },
"manage_role_lifecycle":
{ Args: { "operation": string,"target_role_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
