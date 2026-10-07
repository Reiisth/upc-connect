"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useFormStatus } from "react-dom";
import { FormSection } from "@/components/ui/form-section";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";

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

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-8"
    >
      <FormSection
        title="Personal Information"
        description="Update your personal and contact information."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {isFieldVisible("first_name") && (
            <FormField
              label={getFieldLabel("first_name", "First Name")}
              htmlFor="first_name"
              required={isFieldRequired("first_name")}
              error={
                fieldErrors.first_name
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("first_name"),
              }}
            >
              <Input
                id="first_name"
                name="first_name"
                value={firstName}
                placeholder={
                  getFieldPlaceholder("first_name") ?? undefined
                }
                required={isFieldRequired("first_name")}
                onChange={(event) => {
                  setFirstName(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    first_name: false,
                  }));
                }}
                className={
                  fieldErrors.first_name
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("middle_name") && (
            <FormField
              label={getFieldLabel("middle_name", "Middle Name")}
              htmlFor="middle_name"
              required={isFieldRequired("middle_name")}
              error={
                fieldErrors.middle_name
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("middle_name"),
              }}
            >
              <Input
                id="middle_name"
                name="middle_name"
                defaultValue={member.middle_name ?? ""}
                placeholder={
                  getFieldPlaceholder("middle_name") ?? undefined
                }
                required={isFieldRequired("middle_name")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    middle_name: false,
                  }));
                }}
                className={
                  fieldErrors.middle_name
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("last_name") && (
            <FormField
              label={getFieldLabel("last_name", "Last Name")}
              htmlFor="last_name"
              required={isFieldRequired("last_name")}
              error={
                fieldErrors.last_name
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("last_name"),
              }}
            >
              <Input
                id="last_name"
                name="last_name"
                value={lastName}
                placeholder={
                  getFieldPlaceholder("last_name") ?? undefined
                }
                required={isFieldRequired("last_name")}
                onChange={(event) => {
                  setLastName(event.target.value);

                  setFieldErrors((current) => ({
                    ...current,
                    last_name: false,
                  }));
                }}
                className={
                  fieldErrors.last_name
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("nickname") && (
            <FormField
              label={getFieldLabel("nickname", "Nickname")}
              htmlFor="nickname"
              required={isFieldRequired("nickname")}
              error={
                fieldErrors.nickname
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("nickname"),
              }}
            >
              <Input
                id="nickname"
                name="nickname"
                defaultValue={member.nickname ?? ""}
                placeholder={
                  getFieldPlaceholder("nickname") ?? undefined
                }
                required={isFieldRequired("nickname")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    nickname: false,
                  }));
                }}
                className={
                  fieldErrors.nickname
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("birth_date") && (
            <>
              <FormField
                label={getFieldLabel("birth_date", "Birthday")}
                htmlFor="birth_date"
                required={isFieldRequired("birth_date")}
                error={
                  fieldErrors.birth_date
                    ? "This field is required."
                    : undefined
                }
                style={{
                  order: getFieldOrder("birth_date"),
                }}
              >
                <Input
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
                  className={
                    fieldErrors.birth_date
                      ? "border-red-500 focus-visible:ring-red-200"
                      : undefined
                  }
                />
              </FormField>

              <FormField
                label="Age"
                htmlFor="age"
                description="Calculated automatically from birthday."
                style={{
                  order: getFieldOrder("birth_date", 1),
                }}
              >
                <Input
                  id="age"
                  value={age ?? ""}
                  placeholder="Calculated from birthday"
                  disabled
                  readOnly
                />
              </FormField>
            </>
          )}

          {isFieldVisible("gender") && (
            <FormField
              label={getFieldLabel("gender", "Gender")}
              htmlFor="gender"
              required={isFieldRequired("gender")}
              error={
                fieldErrors.gender
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("gender"),
              }}
            >
              <Select
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
                className={
                  fieldErrors.gender
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              >
                <option value="">Select gender</option>

                {getFieldOptions("gender").map((option) => (
                  <option key={option} value={option.toLowerCase()}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {isFieldVisible("civil_status") && (
            <FormField
              label={getFieldLabel("civil_status", "Civil Status")}
              htmlFor="civil_status"
              required={isFieldRequired("civil_status")}
              error={
                fieldErrors.civil_status
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("civil_status"),
              }}
            >
              <Select
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
                className={
                  fieldErrors.civil_status
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              >
                <option value="">Select civil status</option>

                {getFieldOptions("civil_status").map((option) => (
                  <option key={option} value={option.toLowerCase()}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {isFieldVisible("zone") && (
            <FormField
              label={getFieldLabel("zone", "Zone")}
              htmlFor="zone"
              required={isFieldRequired("zone")}
              error={
                fieldErrors.zone
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("zone"),
              }}
            >
              <Select
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
                className={
                  fieldErrors.zone
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              >
                <option value="">Select zone</option>

                {getFieldOptions("zone").map((option) => (
                  <option key={option} value={option}>
                    Zone {option}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {isFieldVisible("phone_number") && (
            <FormField
              label={getFieldLabel("phone_number", "Phone Number")}
              htmlFor="phone_number"
              required={isFieldRequired("phone_number")}
              error={
                fieldErrors.phone_number
                  ? "Enter a valid phone number, including country code when needed."
                  : undefined
              }
              style={{
                order: getFieldOrder("phone_number"),
              }}
            >
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                defaultValue={member.phone_number ?? ""}
                placeholder={
                  getFieldPlaceholder("phone_number") ?? undefined
                }
                required={isFieldRequired("phone_number")}
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    phone_number: false,
                  }));
                }}
                className={
                  fieldErrors.phone_number
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("email") && (
            <FormField
              label={getFieldLabel("email", "Email")}
              htmlFor="email"
              description="Email is managed through the connected account."
              style={{
                order: getFieldOrder("email"),
              }}
            >
              <Input
                id="email"
                type="email"
                value={member.email ?? accountEmail}
                readOnly
                disabled
              />
            </FormField>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Address"
        description="Update your current residential address."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {isFieldVisible("country") && (
            <FormField
              label={getFieldLabel("country", "Country")}
              htmlFor="country"
              required={isFieldRequired("country")}
              error={
                fieldErrors.country
                  ? "This field is required."
                  : undefined
              }
              className="sm:col-span-2"
              style={{
                order: getFieldOrder("country"),
              }}
            >
              <Input
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
                className={
                  fieldErrors.country
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />

              <datalist id="countries">
                <option value="Philippines" />
                <option value="United States" />
                <option value="Canada" />
                <option value="Australia" />
                <option value="Japan" />
                <option value="Singapore" />
                <option value="United Kingdom" />
              </datalist>
            </FormField>
          )}

          {isFieldVisible("street_address") && (
            <FormField
              label={getFieldLabel("street_address", "Street Address")}
              htmlFor="street_address"
              required={isFieldRequired("street_address")}
              error={
                fieldErrors.street_address
                  ? "This field is required."
                  : undefined
              }
              className="sm:col-span-2"
              style={{
                order: getFieldOrder("street_address"),
              }}
            >
              <Input
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
                className={
                  fieldErrors.street_address
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {country === "Philippines" ? (
            <>
              {country === "Philippines" && isFieldVisible("region") && (
                <FormField
                  label={getFieldLabel("region", "Region")}
                  htmlFor="region"
                  required={isFieldRequired("region")}
                  error={
                    fieldErrors.region
                      ? "This field is required."
                      : undefined
                  }
                  className="sm:col-span-2"
                  style={{
                    order: getFieldOrder("region"),
                  }}
                >
                  <Select
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
                    className={
                      fieldErrors.region
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
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
                  </Select>
                </FormField>
              )}

              {country === "Philippines" &&
                !isNCR &&
                isFieldVisible("province") && (
                  <FormField
                    label={getFieldLabel("province", "Province")}
                    htmlFor="province"
                    required={isFieldRequired("province")}
                    error={
                      fieldErrors.province
                        ? "This field is required."
                        : undefined
                    }
                    className="sm:col-span-2"
                    style={{
                      order: getFieldOrder("province"),
                    }}
                  >
                    <Input
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
                      className={
                        fieldErrors.province
                          ? "border-red-500 focus-visible:ring-red-200"
                          : undefined
                      }
                    />
                  </FormField>
                )}

              {isFieldVisible("city") && (
                <FormField
                  label={getFieldLabel("city", "City / Municipality")}
                  htmlFor="city"
                  required={isFieldRequired("city")}
                  error={
                    fieldErrors.city
                      ? "This field is required."
                      : undefined
                  }
                  className="sm:col-span-2"
                  style={{
                    order: getFieldOrder("city"),
                  }}
                >
                  <Input
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
                    className={
                      fieldErrors.city
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              )}

              {isFieldVisible("barangay") && (
                <FormField
                  label={getFieldLabel("barangay", "Barangay")}
                  htmlFor="barangay"
                  required={isFieldRequired("barangay")}
                  error={
                    fieldErrors.barangay
                      ? "This field is required."
                      : undefined
                  }
                  className="sm:col-span-2"
                  style={{
                    order: getFieldOrder("barangay"),
                  }}
                >
                  <Input
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
                    className={
                      fieldErrors.barangay
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              )}
            </>
          ) : (
            <>
              {isFieldVisible("province") && (
                <FormField
                  label={getFieldLabel(
                    "province",
                    "State / Province / Region",
                  )}
                  htmlFor="province"
                  required={isFieldRequired("province")}
                  error={
                    fieldErrors.province
                      ? "This field is required."
                      : undefined
                  }
                  style={{
                    order: getFieldOrder("province"),
                  }}
                >
                  <Input
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
                    className={
                      fieldErrors.province
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              )}

              {isFieldVisible("city") && (
                <FormField
                  label={getFieldLabel("city", "City")}
                  htmlFor="city"
                  required={isFieldRequired("city")}
                  error={
                    fieldErrors.city
                      ? "This field is required."
                      : undefined
                  }
                  style={{
                    order: getFieldOrder("city"),
                  }}
                >
                  <Input
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
                    className={
                      fieldErrors.city
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              )}

              {isFieldVisible("barangay") && (
                <FormField
                  label={getFieldLabel(
                    "barangay",
                    "Local Area / District",
                  )}
                  htmlFor="barangay"
                  required={isFieldRequired("barangay")}
                  error={
                    fieldErrors.barangay
                      ? "This field is required."
                      : undefined
                  }
                  className="sm:col-span-2"
                  style={{
                    order: getFieldOrder("barangay"),
                  }}
                >
                  <Input
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
                    className={
                      fieldErrors.barangay
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              )}
            </>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Church Information"
        description="Update your church membership and ministry information."
      >
        <div className="grid gap-5 sm:grid-cols-2">

          {isFieldVisible("church_branch_id") && (
            <FormField
              label={getFieldLabel(
                "church_branch_id",
                "Church Branch",
              )}
              htmlFor="church_branch_id"
              required={isFieldRequired("church_branch_id")}
              error={
                fieldErrors.church_branch_id
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("church_branch_id"),
              }}
            >
              <Select
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
                className={
                  fieldErrors.church_branch_id
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
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
              </Select>
            </FormField>
          )}

          {isFieldVisible("department_id") && (
            <FormField
              label={getFieldLabel(
                "department_id",
                "Department",
              )}
              htmlFor="department_id"
              required={isFieldRequired("department_id")}
              error={
                fieldErrors.department_id
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("department_id"),
              }}
            >
              <Select
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
                className={
                  fieldErrors.department_id
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
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
              </Select>
            </FormField>
          )}

          {isFieldVisible("position") && (
            <FormField
              label={getFieldLabel(
                "position",
                "Position",
              )}
              htmlFor="position"
              required={isFieldRequired("position")}
              error={
                fieldErrors.position
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("position"),
              }}
            >
              <Input
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
                className={
                  fieldErrors.position
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {isFieldVisible("first_attendance_date") && (
            <FormField
              label={getFieldLabel(
                "first_attendance_date",
                "First Date of Attendance",
              )}
              htmlFor="first_attendance_date"
              required={isFieldRequired("first_attendance_date")}
              error={
                fieldErrors.first_attendance_date
                  ? "This field is required."
                  : undefined
              }
              style={{
                order: getFieldOrder("first_attendance_date"),
              }}
            >
              <Input
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
                className={
                  fieldErrors.first_attendance_date
                    ? "border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
              />
            </FormField>
          )}

          {["married", "widowed"].includes(civilStatus) &&
            isFieldVisible("wedding_anniversary") && (
              <FormField
                label={getFieldLabel(
                  "wedding_anniversary",
                  "Wedding Anniversary",
                )}
                htmlFor="wedding_anniversary"
                required={isFieldRequired("wedding_anniversary")}
                error={
                  fieldErrors.wedding_anniversary
                    ? "This field is required."
                    : undefined
                }
                style={{
                  order: getFieldOrder("wedding_anniversary"),
                }}
              >
                <Input
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
                  className={
                    fieldErrors.wedding_anniversary
                      ? "border-red-500 focus-visible:ring-red-200"
                      : undefined
                  }
                />
              </FormField>
            )}
        </div>
      </FormSection>

      {customFields.length > 0 && (
        <FormSection
          title="Additional Information"
          description="Additional information configured for member profiles."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {customFields.map((field) => {
              const fieldName = `custom_field_${field.id}`;

              const error = fieldErrors[fieldName]
                ? "This field is required."
                : undefined;

              if (field.field_type === "textarea") {
                return (
                  <FormField
                    key={field.id}
                    label={field.label}
                    htmlFor={fieldName}
                    required={field.is_required}
                    error={error}
                    className="sm:col-span-2"
                    style={{
                      order: field.sort_order,
                    }}
                  >
                    <Textarea
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
                      className={
                        fieldErrors[fieldName]
                          ? "border-red-500 focus-visible:ring-red-200"
                          : undefined
                      }
                    />
                  </FormField>
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
                  <FormField
                    key={field.id}
                    label={field.label}
                    htmlFor={fieldName}
                    required={field.is_required}
                    error={error}
                    style={{
                      order: field.sort_order,
                    }}
                  >
                    <Select
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
                      className={
                        fieldErrors[fieldName]
                          ? "border-red-500 focus-visible:ring-red-200"
                          : undefined
                      }
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
                    </Select>
                  </FormField>
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
                <FormField
                  key={field.id}
                  label={field.label}
                  htmlFor={fieldName}
                  required={field.is_required}
                  error={error}
                  style={{
                    order: field.sort_order,
                  }}
                >
                  <Input
                    id={fieldName}
                    name={fieldName}
                    type={htmlType}
                    defaultValue={
                      customFieldValues[field.id] != null
                        ? String(customFieldValues[field.id])
                        : ""
                    }
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
                    className={
                      fieldErrors[fieldName]
                        ? "border-red-500 focus-visible:ring-red-200"
                        : undefined
                    }
                  />
                </FormField>
              );
            })}
          </div>
        </FormSection>
      )}

      <FormActions>
        <SaveProfileButton />
      </FormActions>
    </form>
  );
}

function SaveProfileButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Saving changes...
        </>
      ) : (
        "Save Profile"
      )}
    </Button>
  );
}