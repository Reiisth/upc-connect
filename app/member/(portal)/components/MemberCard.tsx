"use client";

import { useState } from "react";
import QRCode from "react-qr-code";

type MemberCardProps = {
  member: {
    id: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    nickname: string | null;
    birth_date: string | null;
    gender: string | null;
    phone_number: string | null;
    email: string | null;
    civil_status: string | null;
    street_address: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    department?: {
      name: string;
    } | null;
    position: string | null;
  };
};

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null;

  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
}

export default function MemberCard({ member }: MemberCardProps) {
  const [flipped, setFlipped] = useState(false);

  const fullName = [
    member.first_name,
    member.middle_name,
    member.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [
    member.street_address,
    member.barangay,
    member.city,
    member.province,
    member.country,
  ]
    .filter(Boolean)
    .join(", ");

  const age = calculateAge(member.birth_date);

  return (
    <div className="w-full [perspective:1200px]">
      <div
        className={`grid w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
      >
        {/* FRONT */}
        <div className="col-start-1 row-start-1 overflow-hidden rounded-3xl border bg-white shadow-lg [backface-visibility:hidden]">
          {/* Header */}
          <div className="bg-brand-gradient px-5 pb-7 pt-5 text-white">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-white text-[#203264] shadow-sm">
                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-heading text-2xl font-semibold">
                    {member.first_name?.[0]}
                    {member.last_name?.[0]}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                  UPC Connect Member
                </p>

                <h2 className="mt-1 font-heading text-xl font-semibold leading-tight">
                  {fullName}
                </h2>

                {member.nickname && (
                  <p className="mt-1 text-sm text-white/80">
                    “{member.nickname}”
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-5 p-5">
            {/* Personal */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                Personal Information
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem
                  label="Birthdate"
                  value={
                    member.birth_date
                      ? new Date(member.birth_date).toLocaleDateString("en-PH", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                      : "—"
                  }
                />

                <InfoItem
                  label="Age"
                  value={age !== null ? `${age} years old` : "—"}
                />

                <InfoItem
                  label="Gender"
                  value={formatValue(member.gender)}
                />

                <InfoItem
                  label="Civil Status"
                  value={formatValue(member.civil_status)}
                />

                <InfoItem
                  label="Zone"
                  value={member.zone ? `Zone ${member.zone}` : "—"}
                />
              </div>
            </div>

            <div className="border-t" />

            {/* Contact */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                Contact
              </p>

              <div className="space-y-3">
                <InfoItem
                  label="Phone"
                  value={member.phone_number || "—"}
                />

                <InfoItem
                  label="Email"
                  value={member.email || "—"}
                />

                <InfoItem
                  label="Address"
                  value={fullAddress || "—"}
                />
              </div>
            </div>

            <div className="border-t" />

            {/* Church */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                Church Information
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <InfoItem
                    label="Church Branch"
                    value={member.church_branch?.name || "—"}
                  />
                </div>

                <InfoItem
                  label="Department"
                  value={member.department?.name || "—"}
                />

                <InfoItem
                  label="Position"
                  value={member.position || "—"}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full rounded-xl bg-brand-gradient px-5 py-3 font-semibold text-white transition hover:opacity-95"
            >
              Show Attendance QR
            </button>
          </div>
        </div>

        {/* BACK */}
        <div className="col-start-1 row-start-1 flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-sm font-medium text-[#5D94E8]">
            Attendance QR
          </p>

          <div className="mt-6 rounded-2xl bg-white p-4">
            <QRCode
              value={member.id}
              size={210}
            />
          </div>

          <p className="mt-5 text-center font-semibold text-[#203264]">
            {fullName}
          </p>

          <button
            type="button"
            onClick={() => setFlipped(false)}
            className="mt-6 rounded-xl border px-5 py-3 text-sm font-medium text-[#203264]"
          >
            Back to Member Info
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-0.5 break-words text-sm font-medium text-[#203264]">
        {value}
      </p>
    </div>
  );
}

function formatValue(value: string | null) {
  if (!value) return "—";

  return value.charAt(0).toUpperCase() + value.slice(1);
}