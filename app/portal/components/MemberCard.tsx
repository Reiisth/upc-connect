"use client";

import Image from "next/image";
import { useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    zone: number | null;
    civil_status: string | null;
    street_address: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    photo_url: string | null;
    position: string | null;

    department:
    | {
      name: string;
    }
    | null;

    church_branch:
    | {
      name: string;
    }
    | null;
  };
  showBackToProfiles?: boolean;
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

export default function MemberCard({
  member,
  showBackToProfiles = false
}: MemberCardProps) {
  const [side, setSide] = useState<"front" | "back">("front");

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

  const birthDate = member.birth_date
    ? new Date(member.birth_date).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    : "—";

  const age = calculateAge(member.birth_date);

  return (
    <div className="mx-auto w-full max-w-[420px]">
      {/* FRONT / BACK SWITCH */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {showBackToProfiles ? (
          <Link
            href="/portal/profile"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-[#203264] shadow-sm transition hover:bg-[#EEF3FB]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profiles
          </Link>
        ) : (
          <div />
        )}

        <div className="flex rounded-xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setSide("front")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${side === "front"
              ? "bg-[#203264] text-white"
              : "text-muted-foreground"
              }`}
          >
            Front
          </button>

          <button
            type="button"
            onClick={() => setSide("back")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${side === "back"
              ? "bg-[#203264] text-white"
              : "text-muted-foreground"
              }`}
          >
            Back
          </button>
        </div>
      </div>

      <div className="[perspective:1200px]">
        <div
          className={`grid w-full transition-transform duration-500 [transform-style:preserve-3d] ${side === "back" ? "[transform:rotateY(180deg)]" : ""
            }`}
        >
          {/* FRONT */}
          <div className="col-start-1 row-start-1 overflow-hidden rounded-3xl border bg-white shadow-lg [backface-visibility:hidden]">
            <div className="border-b bg-brand-gradient px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-1">
                  <Image
                    src="/upc-logo.png"
                    alt="UPC Batangas"
                    width={50}
                    height={50}
                    priority
                  />
                </div>

                <div>
                  <p className="font-body text-sm font-semibold sm:text-base">
                    United Pentecostal Church Batangas
                  </p>

                  <p className="text-xs text-white/70">
                    Member Identification
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {/* NAME + AVATAR */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-body text-xl font-semibold leading-tight text-[#203264] sm:text-2xl">
                    {fullName}
                  </h2>

                  <p className="mt-1 text-l text-muted-foreground">
                    {member.nickname ? `“${member.nickname}”` : "—"}
                  </p>
                </div>

                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF3FB] text-[#203264] shadow-sm">
                  {member.photo_url ? (
                    <Image
                      src={member.photo_url}
                      alt={fullName}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-heading text-2xl font-semibold">
                      {member.first_name?.[0]}
                      {member.last_name?.[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* KEY MEMBER INFO */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <InfoItem label="Date of Birth" value={birthDate} />

                <InfoItem
                  label="Church Branch"
                  value={member.church_branch?.name || "—"}
                />

                <InfoItem
                  label="Department"
                  value={member.department?.name || "—"}
                />
              </div>

              {/* QR CODE */}
              <div className="mt-6 flex flex-col items-center rounded-2xl bg-[#EEF3FB] p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                  Attendance QR
                </p>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <QRCode value={member.id} size={120} />
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Present this QR code to the usher for attendance.
                </p>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="col-start-1 row-start-1 rounded-3xl border bg-white p-5 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="border-b pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                Member Details
              </p>

              <h2 className="mt-1 font-body text-xl font-semibold text-[#203264]">
                {fullName}
              </h2>
            </div>

            <div className="mt-5 space-y-5">
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                  Personal
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    label="Gender"
                    value={formatValue(member.gender)}
                  />

                  <InfoItem
                    label="Civil Status"
                    value={formatValue(member.civil_status)}
                  />

                  <InfoItem
                    label="Age"
                    value={age !== null ? `${age} years old` : "—"}
                  />

                  <InfoItem
                    label="Zone"
                    value={member.zone ? `Zone ${member.zone}` : "—"}
                  />
                </div>
              </section>

              <div className="border-t" />

              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                  Contact
                </p>

                <div className="space-y-3">
                  <InfoItem
                    label="Phone Number"
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
              </section>

              <div className="border-t" />

              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5D94E8]">
                  Church
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    label="Church Branch"
                    value={member.church_branch?.name || "—"}
                  />

                  <InfoItem
                    label="Department"
                    value={member.department?.name || "—"}
                  />

                  <InfoItem
                    label="Position"
                    value={member.position || "—"}
                  />
                </div>
              </section>
            </div>
          </div>
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
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-[#203264]">
        {value}
      </p>
    </div>
  );
}

function formatValue(value: string | null) {
  if (!value) return "—";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

