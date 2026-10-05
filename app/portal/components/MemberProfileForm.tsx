"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useFormStatus } from "react-dom";

type Branch = {
  id: string;
  name: string;
};

type FieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  field_group: string;
  is_builtin: boolean;
  is_required: boolean;
  is_visible: boolean;
  placeholder: string | null;
  options_source: string | null;
  options: unknown;
  sort_order: number;
};

type PSGCRegion = {
  code: string;
  name: string;
  regionNumber: number;
};

type Department = {
  id: string;
  name: string;
};

type MemberProfileFormProps = {
  member: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
    nickname: string | null;
    zone: number | null;
    phone_number: string | null;
    birth_date: string | null;
    gender: string | null;
    email: string | null;
    street_address: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
    region: string | null;
    country: string | null;
    wedding_anniversary: string | null;
    first_attendance_date: string | null;
    department_id: string | null;
    position: string | null;
    church_branch_id: string | null;
    civil_status: string | null;
  };
  accountEmail: string;
  branches: Branch[];
  departments: Department[];
  fieldDefinitions: FieldDefinition[];
  customFieldValues: Record<string, string | number | null>;
  action: (formData: FormData) => void | Promise<void>;
};

export default function MemberProfileForm({
  member,
  accountEmail,
  branches,
  departments,
  fieldDefinitions,
  customFieldValues,
  action,
}: MemberProfileFormProps) {
  const getFieldDefinition = (fieldKey: string) =>
    fieldDefinitions.find(
      (field) => field.field_key === fieldKey,
    );

  const isFieldVisible = (fieldKey: string) =>
    getFieldDefinition(fieldKey)?.is_visible ?? true;

  const isFieldRequired = (fieldKey: string) =>
    getFieldDefinition(fieldKey)?.is_required ?? false;

  const getFieldLabel = (
    fieldKey: string,
    fallback: string,
  ) =>
    getFieldDefinition(fieldKey)?.label || fallback;

  const getFieldPlaceholder = (
    fieldKey: string,
    fallback = "",
  ) =>
    getFieldDefinition(fieldKey)?.placeholder || fallback;

  const getFieldOptions = (fieldKey: string): string[] => {
    const options = getFieldDefinition(fieldKey)?.options;

    return Array.isArray(options)
      ? options.filter(
        (option): option is string =>
          typeof option === "string",
      )
      : [];
  };
  const today = new Date().toISOString().split("T")[0];
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [country, setCountry] = useState(member.country ?? "Philippines");

  const [regions, setRegions] = useState<PSGCRegion[]>([]);

  const [region, setRegion] = useState(member.region ?? "");
  const [province, setProvince] = useState(member.province ?? "");
  const [city, setCity] = useState(member.city ?? "");
  const [barangay, setBarangay] = useState(member.barangay ?? "");


  const [civilStatus, setCivilStatus] = useState(member.civil_status ?? "");

  const [firstName, setFirstName] = useState(member.first_name ?? "");
  const [lastName, setLastName] = useState(member.last_name ?? "");
  const [birthDate, setBirthDate] = useState(member.birth_date ?? "");

  const selectedRegion = regions.find(
    (item) => item.name.toLowerCase() === region.toLowerCase(),
  );

  const customFields = fieldDefinitions
    .filter(
      (field) =>
        !field.is_builtin &&
        field.is_visible,
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const getFieldOrder = (
    fieldKey: string,
    offset = 0,
  ) => {
    const field = getFieldDefinition(fieldKey);

    return (field?.sort_order ?? 999) * 2 + offset;
  };

  const isNCR = selectedRegion?.regionNumber === 13;

  const getInputClass = (field: string) =>
    fieldErrors[field]
      ? `${inputClass} border-red-500 ring-2 ring-red-100 animate-shake`
      : inputClass;

  const RequiredMessage = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-sm text-red-600">
        This field is required.
      </p>
    ) : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const requiredFields = fieldDefinitions
      .filter(
        (field) =>
          field.is_visible &&
          field.is_required &&
          field.field_key !== "photo_url",
      )
      .map((field) =>
        field.is_builtin
          ? field.field_key
          : `custom_field_${field.id}`,
      );


    if (country !== "Philippines") {
      const regionIndex = requiredFields.indexOf("region");

      if (regionIndex !== -1) {
        requiredFields.splice(regionIndex, 1);
      }
    }

    if (
      country === "Philippines" &&
      isNCR
    ) {
      const provinceIndex =
        requiredFields.indexOf("province");

      if (provinceIndex !== -1) {
        requiredFields.splice(provinceIndex, 1);
      }
    }

    if (
      !["married", "widowed"].includes(civilStatus)
    ) {
      const anniversaryIndex =
        requiredFields.indexOf("wedding_anniversary");

      if (anniversaryIndex !== -1) {
        requiredFields.splice(anniversaryIndex, 1);
      }
    }

    const errors: Record<string, boolean> = {};

    for (const field of requiredFields) {
      const value = String(formData.get(field) ?? "").trim();

      if (!value) {
        errors[field] = true;
      }
    }


    let phoneValue = String(formData.get("phone_number") ?? "").trim();

    if (phoneValue.startsWith("09")) {
      phoneValue = `+63${phoneValue.slice(1)}`;
      formData.set("phone_number", phoneValue);
    }

    if (phoneValue) {
      const phoneNumber = parsePhoneNumberFromString(phoneValue);

      if (!phoneNumber || !phoneNumber.isValid()) {
        errors.phone_number = true;
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstInvalidField = requiredFields.find(
        (field) => errors[field],
      );

      if (firstInvalidField) {
        const element = form.querySelector<HTMLElement>(
          `[name="${firstInvalidField}"]`,
        );

        element?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        setTimeout(() => {
          element?.focus();
        }, 400);
      }

      return;
    }

    action(formData);
  }

  useEffect(() => {
    async function loadRegions() {
      const response = await fetch("/api/psgc/regions");
      const data = await response.json();

      setRegions(Array.isArray(data) ? data : []);
    }

    loadRegions();
  }, []);

  const age = useMemo(() => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);

    let calculatedAge = today.getFullYear() - birth.getFullYear();

    const monthDifference = today.getMonth() - birth.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 &&
        today.getDate() < birth.getDate())
    ) {
      calculatedAge--;
    }

    return calculatedAge;
  }, [birthDate]);

  const inputClass =
    "w-full rounded-xl border bg-white px-4 py-3 outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10";

  const labelClass =
    "mb-2 block text-sm font-medium text-[#203264]";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-8"
    >
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Personal Information
        </h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {isFieldVisible("first_name") && (
            <div
              style={{
                order: getFieldOrder("first_name"),
              }}
            >
              <label htmlFor="first_name" className={labelClass}>
                {getFieldLabel("first_name", "First Name")}
                {isFieldRequired("first_name") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="first_name"
                name="first_name"
                value={firstName}
                placeholder={getFieldPlaceholder(
                  "first_name",
                  "Enter first name",
                )}
                required={isFieldRequired("first_name")}
                onChange={(event) => {
                  setFirstName(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    first_name: false,
                  }));
                }}
                className={getInputClass("first_name")}
              />

              <RequiredMessage field="first_name" />
            </div>
          )}

          {isFieldVisible("middle_name") && (
            <div
              style={{
                order: getFieldOrder("middle_name"),
              }}
            >
              <label htmlFor="middle_name" className={labelClass}>
                {getFieldLabel("middle_name", "Middle Name")}
                {isFieldRequired("middle_name") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="middle_name"
                name="middle_name"
                defaultValue={member.middle_name ?? ""}
                placeholder={getFieldPlaceholder(
                  "middle_name",
                  "Enter middle name",
                )}
                required={isFieldRequired("middle_name")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    middle_name: false,
                  }));
                }}
                className={getInputClass("middle_name")}
              />

              <RequiredMessage field="middle_name" />
            </div>
          )}

          {isFieldVisible("last_name") && (
            <div
              style={{
                order: getFieldOrder("last_name"),
              }}
            >
              <label htmlFor="last_name" className={labelClass}>
                {getFieldLabel("last_name", "Last Name")}
                {isFieldRequired("last_name") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="last_name"
                name="last_name"
                value={lastName}
                placeholder={getFieldPlaceholder(
                  "last_name",
                  "Enter last name",
                )}
                required={isFieldRequired("last_name")}
                onChange={(event) => {
                  setLastName(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    last_name: false,
                  }));
                }}
                className={getInputClass("last_name")}
              />

              <RequiredMessage field="last_name" />
            </div>
          )}

          {isFieldVisible("nickname") && (
            <div
              style={{
                order: getFieldOrder("nickname"),
              }}
            >
              <label htmlFor="nickname" className={labelClass}>
                {getFieldLabel("nickname", "Nickname")}
                {isFieldRequired("nickname") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="nickname"
                name="nickname"
                defaultValue={member.nickname ?? ""}
                placeholder={getFieldPlaceholder(
                  "nickname",
                  "Enter nickname",
                )}
                required={isFieldRequired("nickname")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    nickname: false,
                  }));
                }}
                className={getInputClass("nickname")}
              />

              <RequiredMessage field="nickname" />
            </div>
          )}

          {isFieldVisible("birth_date") && (
            <div
              style={{
                order: getFieldOrder("birth_date"),
              }}
            >
              <label htmlFor="birth_date" className={labelClass}>
                {getFieldLabel("birth_date", "Birthday")}
                {isFieldRequired("birth_date") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="birth_date"
                name="birth_date"
                type="date"
                value={birthDate}
                max={today}
                required={isFieldRequired("birth_date")}
                onClick={(event) => {
                  event.currentTarget.showPicker?.();
                }}
                onChange={(event) => {
                  setBirthDate(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    birth_date: false,
                  }));
                }}
                className={getInputClass("birth_date")}
              />

              <RequiredMessage field="birth_date" />
            </div>
          )}

          <div
            style={{
              order: getFieldOrder("birth_date", 1),
            }}
          >
            <label className={labelClass}>Age</label>
            <input
              value={age ?? "Calculated from birthday"}
              disabled
              className={`${inputClass} bg-muted`}
            />
          </div>

          {isFieldVisible("gender") && (
            <div
              style={{
                order: getFieldOrder("gender"),
              }}
            >
              <label htmlFor="gender" className={labelClass}>
                {getFieldLabel("gender", "Gender")}
                {isFieldRequired("gender") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <select
                id="gender"
                name="gender"
                defaultValue={member.gender ?? ""}
                required={isFieldRequired("gender")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    gender: false,
                  }));
                }}
                className={getInputClass("gender")}
              >
                <option value="">
                  {getFieldPlaceholder("gender", "Select gender")}
                </option>

                {getFieldOptions("gender").map((option) => (
                  <option
                    key={option}
                    value={option.toLowerCase()}
                  >
                    {option}
                  </option>
                ))}
              </select>

              <RequiredMessage field="gender" />
            </div>
          )}

          {isFieldVisible("civil_status") && (
            <div
              style={{
                order: getFieldOrder("civil_status"),
              }}
            >
              <label htmlFor="civil_status" className={labelClass}>
                {getFieldLabel("civil_status", "Civil Status")}
                {isFieldRequired("civil_status") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <select
                id="civil_status"
                name="civil_status"
                value={civilStatus}
                required={isFieldRequired("civil_status")}
                onChange={(event) => {
                  setCivilStatus(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    civil_status: false,
                  }));
                }}
                className={getInputClass("civil_status")}
              >
                <option value="">
                  {getFieldPlaceholder(
                    "civil_status",
                    "Select civil status",
                  )}
                </option>

                {getFieldOptions("civil_status").map((option) => (
                  <option
                    key={option}
                    value={option.toLowerCase()}
                  >
                    {option}
                  </option>
                ))}
              </select>

              <RequiredMessage field="civil_status" />
            </div>
          )}

          {isFieldVisible("zone") && (
            <div
              style={{
                order: getFieldOrder("zone"),
              }}
            >
              <label htmlFor="zone" className={labelClass}>
                {getFieldLabel("zone", "Zone")}
                {isFieldRequired("zone") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <select
                id="zone"
                name="zone"
                defaultValue={member.zone ?? ""}
                required={isFieldRequired("zone")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    zone: false,
                  }));
                }}
                className={getInputClass("zone")}
              >
                <option value="">
                  {getFieldPlaceholder("zone", "Select zone")}
                </option>

                {getFieldOptions("zone").map((option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    Zone {option}
                  </option>
                ))}
              </select>

              <RequiredMessage field="zone" />
            </div>
          )}

          {isFieldVisible("phone_number") && (
            <div
              style={{
                order: getFieldOrder("phone_number"),
              }}
            >
              <label htmlFor="phone_number" className={labelClass}>
                {getFieldLabel("phone_number", "Mobile Number")}
                {isFieldRequired("phone_number") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="phone_number"
                name="phone_number"
                defaultValue={member.phone_number ?? ""}
                placeholder={getFieldPlaceholder(
                  "phone_number",
                  "Enter mobile number",
                )}
                required={isFieldRequired("phone_number")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    phone_number: false,
                  }));
                }}
                className={getInputClass("phone_number")}
              />

              {fieldErrors.phone_number && (
                <p className="mt-1 text-sm text-red-600">
                  Enter a valid phone number, including country code when needed.
                </p>
              )}
            </div>
          )}

          {isFieldVisible("email") && (
            <div
              style={{
                order: getFieldOrder("email"),
              }}
            >
              <label htmlFor="email" className={labelClass}>
                {getFieldLabel("email", "Email")}
                {isFieldRequired("email") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={member.email ?? accountEmail}
                readOnly
                required={isFieldRequired("email")}
                placeholder={getFieldPlaceholder(
                  "email",
                  "Enter email address",
                )}
                className={`${getInputClass("email")} bg-muted cursor-not-allowed`}
              />

              <RequiredMessage field="email" />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Address
        </h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {isFieldVisible("country") && (
            <div style={{
              order: getFieldOrder("country"),
            }}
              className="sm:col-span-2">
              <label htmlFor="country" className={labelClass}>
                {getFieldLabel("country", "Country")}
                {isFieldRequired("country") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="country"
                name="country"
                list="countries"
                value={country}
                placeholder={getFieldPlaceholder(
                  "country",
                  "Enter country",
                )}
                required={isFieldRequired("country")}
                onChange={(event) => {
                  const value = event.target.value;

                  setCountry(value);
                  setProvince("");
                  setCity("");
                  setBarangay("");

                  setFieldErrors((current) => ({
                    ...current,
                    country: false,
                    province: false,
                    city: false,
                    barangay: false,
                  }));
                }}
                className={getInputClass("country")}
              />

              <RequiredMessage field="country" />

              <datalist id="countries">
                <option value="Philippines" />
                <option value="United States" />
                <option value="Canada" />
                <option value="Australia" />
                <option value="Japan" />
                <option value="Singapore" />
                <option value="United Kingdom" />
              </datalist>
            </div>
          )}

          {isFieldVisible("street_address") && (
            <div
              style={{
                order: getFieldOrder("street_address"),
              }}
              className="sm:col-span-2">
              <label htmlFor="street_address" className={labelClass}>
                {getFieldLabel(
                  "street_address",
                  "Street Address",
                )}
                {isFieldRequired("street_address") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="street_address"
                name="street_address"
                defaultValue={member.street_address ?? ""}
                placeholder={getFieldPlaceholder(
                  "street_address",
                  "Enter street address",
                )}
                required={isFieldRequired("street_address")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    street_address: false,
                  }));
                }}
                className={getInputClass("street_address")}
              />

              <RequiredMessage field="street_address" />
            </div>
          )}

          {country === "Philippines" ? (
            <>
              {country === "Philippines" && isFieldVisible("region") && (
                <div style={{
                  order: getFieldOrder("region"),
                }}
                  className="sm:col-span-2">
                  <label htmlFor="region" className={labelClass}>
                    {getFieldLabel("region", "Region")}
                    {isFieldRequired("region") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <select
                    id="region"
                    name="region"
                    value={region}
                    required={isFieldRequired("region")}
                    onChange={(event) => {
                      const value = event.target.value;

                      setRegion(value);
                      setProvince("");
                      setCity("");
                      setBarangay("");

                      setFieldErrors((current) => ({
                        ...current,
                        region: false,
                        province: false,
                        city: false,
                        barangay: false,
                      }));
                    }}
                    className={getInputClass("region")}
                  >
                    <option value="">
                      {getFieldPlaceholder("region", "Select region")}
                    </option>

                    {regions.map((regionOption) => (
                      <option
                        key={regionOption.code}
                        value={regionOption.name}
                      >
                        {regionOption.name}
                      </option>
                    ))}
                  </select>

                  <RequiredMessage field="region" />
                </div>
              )}

              {country === "Philippines" &&
                !isNCR &&
                isFieldVisible("province") && (
                  <div style={{
                    order: getFieldOrder("province"),
                  }}
                    className="sm:col-span-2">
                    <label htmlFor="province" className={labelClass}>
                      {getFieldLabel("province", "Province")}
                      {isFieldRequired("province") && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </label>

                    <input
                      id="province"
                      name="province"
                      type="text"
                      value={province}
                      placeholder={getFieldPlaceholder(
                        "province",
                        "Enter province",
                      )}
                      required={isFieldRequired("province")}
                      onChange={(event) => {
                        setProvince(event.target.value);

                        setFieldErrors((current) => ({
                          ...current,
                          province: false,
                        }));
                      }}
                      className={getInputClass("province")}
                    />

                    <RequiredMessage field="province" />
                  </div>
                )}

              {isFieldVisible("city") && (
                <div style={{
                  order: getFieldOrder("city"),
                }}
                  className="sm:col-span-2">
                  <label htmlFor="city" className={labelClass}>
                    {getFieldLabel("city", "City / Municipality")}
                    {isFieldRequired("city") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={city}
                    placeholder={getFieldPlaceholder(
                      "city",
                      "Enter city or municipality",
                    )}
                    required={isFieldRequired("city")}
                    onChange={(event) => {
                      setCity(event.target.value);

                      setFieldErrors((current) => ({
                        ...current,
                        city: false,
                      }));
                    }}
                    className={getInputClass("city")}
                  />

                  <RequiredMessage field="city" />
                </div>
              )}

              {isFieldVisible("barangay") && (
                <div
                  style={{
                    order: getFieldOrder("barangay"),
                  }}
                  className="sm:col-span-2">
                  <label htmlFor="barangay" className={labelClass}>
                    {getFieldLabel("barangay", "Barangay")}
                    {isFieldRequired("barangay") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id="barangay"
                    name="barangay"
                    type="text"
                    value={barangay}
                    placeholder={getFieldPlaceholder(
                      "barangay",
                      "Enter barangay",
                    )}
                    required={isFieldRequired("barangay")}
                    onChange={(event) => {
                      setBarangay(event.target.value);

                      setFieldErrors((current) => ({
                        ...current,
                        barangay: false,
                      }));
                    }}
                    className={getInputClass("barangay")}
                  />

                  <RequiredMessage field="barangay" />
                </div>
              )}
            </>
          ) : (
            <>
              {isFieldVisible("province") && (
                <div>
                  <label htmlFor="province" className={labelClass}>
                    {getFieldLabel(
                      "province",
                      "State / Province / Region",
                    )}
                    {isFieldRequired("province") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id="province"
                    name="province"
                    value={province}
                    placeholder={getFieldPlaceholder(
                      "province",
                      "Enter state/province/region",
                    )}
                    required={isFieldRequired("province")}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      setCity("");
                      setBarangay("");

                      setFieldErrors((current) => ({
                        ...current,
                        province: false,
                        city: false,
                        barangay: false,
                      }));
                    }}
                    className={getInputClass("province")}
                  />

                  <RequiredMessage field="province" />
                </div>
              )}

              {isFieldVisible("city") && (
                <div style={{
                  order: getFieldOrder("city"),
                }}>
                  <label htmlFor="city" className={labelClass}>
                    {getFieldLabel("city", "City")}
                    {isFieldRequired("city") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id="city"
                    name="city"
                    value={city}
                    placeholder={getFieldPlaceholder(
                      "city",
                      "Enter city or municipality",
                    )}
                    required={isFieldRequired("city")}
                    onChange={(event) => {
                      setCity(event.target.value);
                      setBarangay("");

                      setFieldErrors((current) => ({
                        ...current,
                        city: false,
                        barangay: false,
                      }));
                    }}
                    className={getInputClass("city")}
                  />

                  <RequiredMessage field="city" />
                </div>
              )}

              {isFieldVisible("barangay") && (
                <div style={{
                  order: getFieldOrder("barangay"),
                }} className="sm:col-span-2">
                  <label htmlFor="barangay" className={labelClass}>
                    {getFieldLabel(
                      "barangay",
                      "Local Area / District",
                    )}
                    {isFieldRequired("barangay") && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id="barangay"
                    name="barangay"
                    value={barangay}
                    placeholder={getFieldPlaceholder(
                      "barangay",
                      "Enter local area or district",
                    )}
                    required={isFieldRequired("barangay")}
                    onChange={(event) => {
                      setBarangay(event.target.value);

                      setFieldErrors((current) => ({
                        ...current,
                        barangay: false,
                      }));
                    }}
                    className={getInputClass("barangay")}
                  />

                  <RequiredMessage field="barangay" />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Church Information
        </h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {isFieldVisible("church_branch_id") && (
            <div
              style={{
                order: getFieldOrder("church_branch_id"),
              }}>
              <label htmlFor="church_branch_id" className={labelClass}>
                {getFieldLabel("church_branch_id", "Church Branch")}
                {isFieldRequired("church_branch_id") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <select
                id="church_branch_id"
                name="church_branch_id"
                defaultValue={member.church_branch_id ?? ""}
                required={isFieldRequired("church_branch_id")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    church_branch_id: false,
                  }));
                }}
                className={getInputClass("church_branch_id")}
              >
                <option value="">
                  {getFieldPlaceholder(
                    "church_branch_id",
                    "Select church branch",
                  )}
                </option>

                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <RequiredMessage field="church_branch_id" />
            </div>
          )}

          {isFieldVisible("department_id") && (
            <div style={{
              order: getFieldOrder("department_id"),
            }}>
              <label htmlFor="department_id" className={labelClass}>
                {getFieldLabel("department_id", "Department")}
                {isFieldRequired("department_id") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <select
                id="department_id"
                name="department_id"
                defaultValue={member.department_id ?? ""}
                required={isFieldRequired("department_id")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    department_id: false,
                  }));
                }}
                className={getInputClass("department_id")}
              >
                <option value="">
                  {getFieldPlaceholder(
                    "department_id",
                    "Select department",
                  )}
                </option>

                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>

              <RequiredMessage field="department_id" />
            </div>
          )}

          {isFieldVisible("position") && (
            <div
              style={{
                order: getFieldOrder("position"),
              }}>
              <label htmlFor="position" className={labelClass}>
                {getFieldLabel("position", "Position")}
                {isFieldRequired("position") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="position"
                name="position"
                defaultValue={member.position ?? ""}
                placeholder={getFieldPlaceholder(
                  "position",
                  "Enter position",
                )}
                required={isFieldRequired("position")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    position: false,
                  }));
                }}
                className={getInputClass("position")}
              />

              <RequiredMessage field="position" />
            </div>
          )}

          {isFieldVisible("first_attendance_date") && (
            <div style={{
              order: getFieldOrder("first_attendance_date"),
            }}>
              <label htmlFor="first_attendance_date" className={labelClass}>
                {getFieldLabel(
                  "first_attendance_date",
                  "First Date of Attendance",
                )}
                {isFieldRequired("first_attendance_date") && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>

              <input
                id="first_attendance_date"
                name="first_attendance_date"
                type="date"
                defaultValue={member.first_attendance_date ?? ""}
                max={today}
                required={isFieldRequired("first_attendance_date")}
                onClick={(event) => {
                  event.currentTarget.showPicker?.();
                }}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    first_attendance_date: false,
                  }));
                }}
                className={getInputClass("first_attendance_date")}
              />

              <RequiredMessage field="first_attendance_date" />
            </div>
          )}

          {["married", "widowed"].includes(civilStatus) &&
            isFieldVisible("wedding_anniversary") && (
              <div style={{
                order: getFieldOrder("wedding_anniversary"),
              }}>
                <label
                  htmlFor="wedding_anniversary"
                  className={labelClass}
                >
                  {getFieldLabel(
                    "wedding_anniversary",
                    "Wedding Anniversary",
                  )}

                  {isFieldRequired("wedding_anniversary") && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>

                <input
                  id="wedding_anniversary"
                  name="wedding_anniversary"
                  type="date"
                  defaultValue={member.wedding_anniversary ?? ""}
                  required={isFieldRequired("wedding_anniversary")}
                  onClick={(event) => {
                    event.currentTarget.showPicker?.();
                  }}
                  onChange={() => {
                    setFieldErrors((current) => ({
                      ...current,
                      wedding_anniversary: false,
                    }));
                  }}
                  className={getInputClass("wedding_anniversary")}
                />

                <RequiredMessage field="wedding_anniversary" />
              </div>
            )}
        </div>
      </section>

      {customFields.length > 0 && (
        <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
          <h2 className="font-body text-xl font-semibold text-[#203264]">
            Additional Information
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {customFields.map((field) => {
              const fieldName = `custom_field_${field.id}`;

              const label = (
                <>
                  {field.label}

                  {field.is_required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </>
              );

              if (field.field_type === "textarea") {
                return (
                  <div
                    key={field.id}
                    className="sm:col-span-2"
                  >
                    <label
                      htmlFor={fieldName}
                      className={labelClass}
                    >
                      {label}
                    </label>

                    <textarea
                      id={fieldName}
                      name={fieldName}
                      rows={4}
                      required={field.is_required}
                      placeholder={field.placeholder ?? ""}
                      defaultValue={
                        customFieldValues[field.id] != null
                          ? String(customFieldValues[field.id])
                          : ""
                      }
                      onChange={() => {
                        setFieldErrors((current) => ({
                          ...current,
                          [fieldName]: false,
                        }));
                      }}
                      className={getInputClass(fieldName)}
                    />

                    <RequiredMessage field={fieldName} />
                  </div>
                );
              }

              if (field.field_type === "select") {
                let options: {
                  value: string;
                  label: string;
                }[] = [];

                if (field.options_source === "departments") {
                  options = departments.map((department) => ({
                    value: department.id,
                    label: department.name,
                  }));
                } else if (
                  field.options_source === "church_branches"
                ) {
                  options = branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }));
                } else if (
                  field.options_source === "psgc_regions"
                ) {
                  options = regions.map((region) => ({
                    value: region.name,
                    label: region.name,
                  }));
                } else {
                  options = getFieldOptions(field.field_key).map(
                    (option) => ({
                      value: option,
                      label: option,
                    }),
                  );
                }

                return (
                  <div key={field.id}>
                    <label
                      htmlFor={fieldName}
                      className={labelClass}
                    >
                      {label}
                    </label>

                    <select
                      id={fieldName}
                      name={fieldName}
                      defaultValue={
                        customFieldValues[field.id] != null
                          ? String(customFieldValues[field.id])
                          : ""
                      }
                      required={field.is_required}
                      onChange={() => {
                        setFieldErrors((current) => ({
                          ...current,
                          [fieldName]: false,
                        }));
                      }}
                      className={getInputClass(fieldName)}
                    >
                      <option value="">
                        {field.placeholder ||
                          `Select ${field.label.toLowerCase()}`}
                      </option>

                      {options.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <RequiredMessage field={fieldName} />
                  </div>
                );
              }

              const htmlType =
                field.field_type === "phone"
                  ? "tel"
                  : field.field_type === "number"
                    ? "number"
                    : field.field_type === "email"
                      ? "email"
                      : field.field_type === "date"
                        ? "date"
                        : "text";

              return (
                <div key={field.id}>
                  <label
                    htmlFor={fieldName}
                    className={labelClass}
                  >
                    {label}
                  </label>

                  <input
                    id={fieldName}
                    name={fieldName}
                    defaultValue={
                      customFieldValues[field.id] != null
                        ? String(customFieldValues[field.id])
                        : ""
                    }
                    type={htmlType}
                    required={field.is_required}
                    placeholder={
                      htmlType === "date"
                        ? undefined
                        : field.placeholder ?? ""
                    }
                    onChange={() => {
                      setFieldErrors((current) => ({
                        ...current,
                        [fieldName]: false,
                      }));
                    }}
                    className={getInputClass(fieldName)}
                  />

                  <RequiredMessage field={fieldName} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SaveProfileButton />
    </form>
  );
}

function SaveProfileButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Saving changes...
        </>
      ) : (
        "Save Profile"
      )}
    </button>
  );
}