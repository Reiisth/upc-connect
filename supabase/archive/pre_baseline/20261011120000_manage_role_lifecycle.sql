-- Atomically activate, deactivate, or delete roles while preserving RBAC
-- administration continuity.
--
-- This migration intentionally verifies the existing role_permissions -> roles
-- cascade before the delete branch relies on it.

DO $$
DECLARE
  role_id_attnum smallint;
  role_permissions_role_id_attnum smallint;
  role_permissions_role_fk_exists boolean;
BEGIN
  SELECT attnum
  INTO role_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.roles'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  SELECT attnum
  INTO role_permissions_role_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.role_permissions'::regclass
    AND attname = 'role_id'
    AND NOT attisdropped;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.contype = 'f'
      AND constraint_record.conrelid = 'public.role_permissions'::regclass
      AND constraint_record.confrelid = 'public.roles'::regclass
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[role_permissions_role_id_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[role_id_attnum]::smallint[]
  )
  INTO role_permissions_role_fk_exists;

  IF NOT role_permissions_role_fk_exists THEN
    RAISE EXCEPTION
      'Expected role_permissions.role_id -> roles.id ON DELETE CASCADE constraint was not found.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.manage_role_lifecycle(
  target_role_id uuid,
  operation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  target_role public.roles%ROWTYPE;
  normalized_operation text := lower(trim(operation));
  required_permission_keys text[] := ARRAY[
    'administration.view',
    'roles.view',
    'roles.update',
    'roles.manage_permissions',
    'roles.assign',
    'roles.deactivate',
    'roles.delete'
  ];
  remaining_admin_role_count bigint;
  has_active_admin_account boolean;
  assigned_user_count bigint;
BEGIN
  IF normalized_operation IS NULL
     OR normalized_operation NOT IN ('activate', 'deactivate', 'delete') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Unsupported role lifecycle operation.';
  END IF;

  -- Serialize all lifecycle mutations. This lock is transaction-scoped and
  -- released automatically when the RPC transaction completes.
  PERFORM pg_advisory_xact_lock(hashtext('public.manage_role_lifecycle'));

  SELECT *
  INTO target_role
  FROM public.roles
  WHERE id = target_role_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Role not found.';
  END IF;

  IF normalized_operation = 'activate' THEN
    IF target_role.is_active THEN
      RETURN jsonb_build_object(
        'success', true,
        'role_id', target_role.id,
        'operation', normalized_operation,
        'is_active', true,
        'changed', false
      );
    END IF;

    UPDATE public.roles
    SET is_active = true
    WHERE id = target_role.id;

    RETURN jsonb_build_object(
      'success', true,
      'role_id', target_role.id,
      'operation', normalized_operation,
      'is_active', true,
      'changed', true
    );
  END IF;

  IF normalized_operation = 'deactivate' THEN
    IF target_role.key = 'system_admin' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'The system_admin role cannot be deactivated.';
    END IF;

    IF target_role.key = 'member' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'The member role cannot be deactivated.';
    END IF;

    IF NOT target_role.is_active THEN
      RETURN jsonb_build_object(
        'success', true,
        'role_id', target_role.id,
        'operation', normalized_operation,
        'is_active', false,
        'changed', false
      );
    END IF;
  END IF;

  IF normalized_operation = 'delete' THEN
    IF target_role.is_system THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'System roles cannot be deleted.';
    END IF;

    IF target_role.key IN (
      'system_admin',
      'member',
      'pastor',
      'accounting_officer',
      'evangelism_officer',
      'spiritual_ministry_officer',
      'usher'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'System roles cannot be deleted.';
    END IF;

    SELECT count(*)
    INTO assigned_user_count
    FROM public.user_roles
    WHERE role_id = target_role.id;

    IF assigned_user_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format(
          'This role is assigned to %s account%s. Remove those assignments before deleting it.',
          assigned_user_count,
          CASE WHEN assigned_user_count = 1 THEN '' ELSE 's' END
        );
    END IF;
  END IF;

  -- Evaluate the role-capability state after the requested role is removed
  -- from the active contribution set. Active permissions are counted by key,
  -- so inactive permission records cannot preserve administrator capability.
  SELECT count(*)
  INTO remaining_admin_role_count
  FROM (
    SELECT role_record.id
    FROM public.roles AS role_record
    INNER JOIN public.role_permissions AS role_permission
      ON role_permission.role_id = role_record.id
    INNER JOIN public.permissions AS permission_record
      ON permission_record.id = role_permission.permission_id
    WHERE role_record.is_active
      AND NOT (
        normalized_operation IN ('deactivate', 'delete')
        AND role_record.id = target_role.id
      )
      AND permission_record.is_active
      AND permission_record.key = ANY(required_permission_keys)
    GROUP BY role_record.id
    HAVING count(DISTINCT permission_record.key) = cardinality(required_permission_keys)
  ) AS capable_roles;

  IF remaining_admin_role_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'This change would remove the last active RBAC administrator role.';
  END IF;

  -- Evaluate effective permissions at the account level. Permissions from all
  -- active roles assigned to the account are unioned before the capability
  -- requirement is tested; one role does not need to contain every permission.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile_record
    WHERE profile_record.archived_at IS NULL
      AND (
        SELECT count(DISTINCT permission_record.key)
        FROM public.user_roles AS user_role
        INNER JOIN public.roles AS role_record
          ON role_record.id = user_role.role_id
        INNER JOIN public.role_permissions AS role_permission
          ON role_permission.role_id = role_record.id
        INNER JOIN public.permissions AS permission_record
          ON permission_record.id = role_permission.permission_id
        WHERE user_role.user_id = profile_record.id
          AND role_record.is_active
          AND NOT (
            normalized_operation IN ('deactivate', 'delete')
            AND role_record.id = target_role.id
          )
          AND permission_record.is_active
          AND permission_record.key = ANY(required_permission_keys)
      ) = cardinality(required_permission_keys)
  )
  INTO has_active_admin_account;

  IF NOT has_active_admin_account THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'This change would leave no active account with RBAC administration access.';
  END IF;

  IF normalized_operation = 'deactivate' THEN
    UPDATE public.roles
    SET is_active = false
    WHERE id = target_role.id;

    RETURN jsonb_build_object(
      'success', true,
      'role_id', target_role.id,
      'operation', normalized_operation,
      'is_active', false,
      'changed', true
    );
  END IF;

  DELETE FROM public.roles
  WHERE id = target_role.id;

  RETURN jsonb_build_object(
    'success', true,
    'role_id', target_role.id,
    'operation', normalized_operation,
    'deleted', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_role_lifecycle(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_role_lifecycle(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.manage_role_lifecycle(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.manage_role_lifecycle(uuid, text) TO service_role;
