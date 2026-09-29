"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useFormStatus } from "react-dom";
import ConfiguredField from "./ConfiguredField";

type Branch = {
  id: string;
  name: string;
};

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

type PSGCProvince = {
  code: string;
  name: string;
};

type PSGCCity = {
  code: string;
  name: string;
};

type PSGCBarangay = {
  code: string;
  name: string;
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
  action: (formData: FormData) => void | Promise<void>;
};

export default function MemberProfileForm({
  member,
  accountEmail,
  branches,
  departments,
  fieldDefinitions,
  action,
}: MemberProfileFormProps) {
  const getFieldDefinition = (fieldKey: string) =>
    fieldDefinitions.find(
      (field) => field.field_key === fieldKey,
    );
  const today = new Date().toISOString().split("T")[0];
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [country, setCountry] = useState(member.country ?? "Philippines");
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);

  const [province, setProvince] = useState(member.province ?? "");

  const [cities, setCities] = useState<PSGCCity[]>([]);

  const [city, setCity] = useState(member.city ?? "");

  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);

  const [barangay, setBarangay] = useState(member.barangay ?? "");

  const [civilStatus, setCivilStatus] = useState(member.civil_status ?? "");

  const [firstName, setFirstName] = useState(member.first_name ?? "");
  const [lastName, setLastName] = useState(member.last_name ?? "");
  const [birthDate, setBirthDate] = useState(member.birth_date ?? "");

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

    const requiredFields = [
      "first_name",
      "last_name",
      "nickname",
      "birth_date",
      "gender",
      "civil_status",
      "country",
      "province",
      "city",
      "barangay",
      "church_branch_id",
    ];

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
    if (country !== "Philippines") return;

    async function loadProvinces() {
      const response = await fetch("/api/psgc/provinces");
      const data = await response.json();

      setProvinces(Array.isArray(data) ? data : data.data ?? []);
    }

    loadProvinces();
  }, [country]);

  useEffect(() => {
    if (country !== "Philippines" || !province) {
      setCities([]);
      return;
    }

    const selectedProvince = provinces.find(
      (item) => item.name.toLowerCase() === province.toLowerCase(),
    );

    if (!selectedProvince) {
      setCities([]);
      return;
    }

    async function loadCities() {
      const response = await fetch(
        `/api/psgc/cities/${selectedProvince!.code}`,
      );

      const data = await response.json();

      setCities(Array.isArray(data) ? data : data.data ?? []);
    }

    loadCities();
  }, [country, province, provinces]);

  useEffect(() => {
    if (country !== "Philippines" || !city) {
      setBarangays([]);
      return;
    }

    const selectedCity = cities.find(
      (item) => item.name.toLowerCase() === city.toLowerCase(),
    );

    if (!selectedCity) {
      setBarangays([]);
      return;
    }

    async function loadBarangays() {
      const response = await fetch(
        `/api/psgc/barangays/${selectedCity!.code}`,
      );

      const data = await response.json();

      setBarangays(Array.isArray(data) ? data : data.data ?? []);
    }

    loadBarangays();
  }, [country, city, cities]);

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

  const nicknameField = getFieldDefinition("nickname");

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
          <div>
            <label className={labelClass}>First Name</label>
            <input
              id="first_name"
              name="first_name"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  first_name: false,
                }));
              }}
              className={getInputClass("first_name")}
              required
            />
            <RequiredMessage field="first_name" />
          </div>

          <div>
            <label htmlFor="middle_name" className={labelClass}>
              Middle Name
            </label>
            <input
              id="middle_name"
              name="middle_name"
              defaultValue={member.middle_name ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Last Name</label>
            <input
              id="last_name"
              name="last_name"
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  last_name: false,
                }));
              }}
              className={getInputClass("last_name")}
              required
            />

            <RequiredMessage field="last_name" />
          </div>

          {nicknameField?.is_visible !== false && (
            <ConfiguredField
              definition={getFieldDefinition("nickname")}
              fallbackLabel="Nickname"
              htmlFor="nickname"
            >
              <input
                id="nickname"
                name="nickname"
                defaultValue={member.nickname ?? ""}
                required={
                  getFieldDefinition("nickname")?.is_required ?? false
                }
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
              />
            </ConfiguredField>
          )}

          <div>
            <label htmlFor="birth_date" className={labelClass}>
              Birthday
            </label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              value={birthDate}
              max={today}
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

          <div>
            <label className={labelClass}>Age</label>
            <input
              value={age ?? "Calculated from birthday"}
              disabled
              className={`${inputClass} bg-muted`}
            />
          </div>

          <div>
            <label htmlFor="gender" className={labelClass}>
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              defaultValue={member.gender ?? ""}
              onChange={() => {
                setFieldErrors((current) => ({
                  ...current,
                  gender: false,
                }));
              }}
              className={getInputClass("gender")}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            <RequiredMessage field="gender" />
          </div>

          <div>
            <label htmlFor="civil_status" className={labelClass}>
              Civil Status
            </label>

            <select
              id="civil_status"
              name="civil_status"
              value={civilStatus}
              onChange={(event) => {
                setCivilStatus(event.target.value);

                setFieldErrors((current) => ({
                  ...current,
                  civil_status: false,
                }));
              }}
              className={getInputClass("civil_status")}
            >
              <option value="">Select civil status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
            </select>

            <RequiredMessage field="civil_status" />
          </div>

          <div>
            <label htmlFor="zone" className={labelClass}>
              Zone
            </label>
            <select
              id="zone"
              name="zone"
              defaultValue={member.zone ?? ""}
              className={inputClass}
            >
              <option value="">Select zone</option>
              <option value="1">Zone 1</option>
              <option value="2">Zone 2</option>
              <option value="3">Zone 3</option>
              <option value="4">Zone 4</option>
              <option value="5">Zone 5</option>
            </select>
          </div>

          <div>
            <label htmlFor="phone_number" className={labelClass}>
              Mobile Number
            </label>
            <input
              id="phone_number"
              name="phone_number"
              defaultValue={member.phone_number ?? ""}
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

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={member.email ?? accountEmail}
              readOnly
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Address
        </h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="country" className={labelClass}>
              Country
            </label>

            <input
              id="country"
              name="country"
              list="countries"
              value={country}
              onChange={(event) => {
                const value = event.target.value;

                setCountry(value);
                setProvince("");
                setCity("");
                setBarangay("");
                setProvinces([]);
                setCities([]);
                setBarangays([]);

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

          <div className="sm:col-span-2">
            <label htmlFor="street_address" className={labelClass}>
              Street Address
            </label>
            <input
              id="street_address"
              name="street_address"
              defaultValue={member.street_address ?? ""}
              className={inputClass}
            />
          </div>

          {country === "Philippines" ? (
            <>
              <div>
                <label htmlFor="province" className={labelClass}>
                  Province
                </label>

                <input
                  id="province"
                  name="province"
                  list="province-options"
                  placeholder="Search province"
                  value={province}
                  onChange={(event) => {
                    setProvince(event.target.value);
                    setCity("");
                    setBarangay("");
                    setCities([]);
                    setBarangays([]);

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

                <datalist id="province-options">
                  {provinces.map((province) => (
                    <option key={province.code} value={province.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="city" className={labelClass}>
                  City / Municipality
                </label>

                <input
                  id="city"
                  name="city"
                  list="city-options"
                  placeholder="Search city or municipality"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setBarangay("");
                    setBarangays([]);

                    setFieldErrors((current) => ({
                      ...current,
                      city: false,
                      barangay: false,
                    }));
                  }}
                  className={getInputClass("city")}
                />

                <RequiredMessage field="city" />

                <datalist id="city-options">
                  {cities.map((city) => (
                    <option key={city.code} value={city.name} />
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="barangay" className={labelClass}>
                  Barangay
                </label>

                <input
                  id="barangay"
                  name="barangay"
                  list="barangay-options"
                  placeholder="Search barangay"
                  value={barangay}
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

                <datalist id="barangay-options">
                  {barangays.map((barangay) => (
                    <option key={barangay.code} value={barangay.name} />
                  ))}
                </datalist>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="province" className={labelClass}>
                  State / Province / Region
                </label>

                <input
                  id="province"
                  name="province"
                  list="province-options"
                  placeholder="Enter state/province/region"
                  value={province}
                  onChange={(event) => {
                    setProvince(event.target.value);
                    setCity("");
                    setBarangay("");
                    setCities([]);
                    setBarangays([]);

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

              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>

                <input
                  id="city"
                  name="city"
                  list="city-options"
                  placeholder="Enter city or municipality"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setBarangay("");
                    setBarangays([]);

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

              <div className="sm:col-span-2">
                <label htmlFor="barangay" className={labelClass}>
                  Local Area / District
                </label>

                <input
                  id="barangay"
                  name="barangay"
                  list="barangay-options"
                  placeholder="Enter local area/district"
                  value={barangay}
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
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-body text-xl font-semibold text-[#203264]">
          Church Information
        </h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="church_branch_id" className={labelClass}>
              Church Branch
            </label>

            <select
              id="church_branch_id"
              name="church_branch_id"
              defaultValue={member.church_branch_id ?? ""}
              onChange={() => {
                setFieldErrors((current) => ({
                  ...current,
                  church_branch_id: false,
                }));
              }}
              className={getInputClass("church_branch_id")}
            >
              <option value="">Select church branch</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <RequiredMessage field="church_branch_id" />
          </div>

          <div>
            <label htmlFor="department_id" className={labelClass}>
              Department
            </label>

            <select
              id="department_id"
              name="department_id"
              defaultValue={member.department_id ?? ""}
              className={inputClass}
            >
              <option value="">Select department</option>

              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="position" className={labelClass}>
              Position
            </label>
            <input
              id="position"
              name="position"
              defaultValue={member.position ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="first_attendance_date" className={labelClass}>
              First Date of Attendance
            </label>
            <input
              id="first_attendance_date"
              name="first_attendance_date"
              type="date"
              defaultValue={member.first_attendance_date ?? ""}
              max={today}
              className={inputClass}
            />
          </div>

          {["married", "widowed"].includes(civilStatus) && (
            <div>
              <label htmlFor="wedding_anniversary" className={labelClass}>
                Wedding Anniversary
              </label>

              <input
                id="wedding_anniversary"
                name="wedding_anniversary"
                type="date"
                defaultValue={member.wedding_anniversary ?? ""}
                className={inputClass}
              />
            </div>
          )}
        </div>
      </section>

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