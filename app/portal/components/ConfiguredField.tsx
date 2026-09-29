type FieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_builtin: boolean;
  is_required: boolean;
  is_visible: boolean;
  options: unknown;
  sort_order: number;
};

type ConfiguredFieldProps = {
  definition?: FieldDefinition;
  fallbackLabel: string;
  htmlFor: string;
  children: React.ReactNode;
};

export default function ConfiguredField({
  definition,
  fallbackLabel,
  htmlFor,
  children,
}: ConfiguredFieldProps) {
  if (definition?.is_visible === false) {
    return null;
  }

  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[#203264]"
      >
        {definition?.label ?? fallbackLabel}

        {definition?.is_required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}