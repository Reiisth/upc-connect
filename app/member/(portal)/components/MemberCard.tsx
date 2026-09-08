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

export default function MemberCard({ member }: MemberCardProps) {
  const [flipped, setFlipped] = useState(false);

  const fullName = [
    member.first_name,
    member.middle_name,
    member.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full [perspective:1200px]">
      <div
        className={`relative min-h-[430px] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* FRONT */}
        <div className="absolute inset-0 rounded-3xl bg-white p-6 shadow-lg [backface-visibility:hidden]">
          <p className="text-sm font-medium text-[#5D94E8]">
            UPC Connect Member
          </p>

          <h1 className="mt-2 font-body text-2xl font-semibold text-[#203264]">
            {fullName}
          </h1>

          {member.nickname && (
            <p className="text-sm text-muted-foreground">
              “{member.nickname}”
            </p>
          )}

          {/* Member details go here */}

          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="mt-6 w-full rounded-xl bg-brand-gradient px-5 py-3 font-semibold text-white"
          >
            Show QR Code
          </button>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
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