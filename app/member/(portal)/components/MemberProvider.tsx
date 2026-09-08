"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type Member = {
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
  position: string | null;

  department:
  | {
    name: string;
  }
  | null;

  zone: number | null;
  photo_url: string | null;

  church_branch:
  | {
    name: string;
  }
  | null;
};

type MemberContextType = {
  member: Member;
};

const MemberContext = createContext<MemberContextType | null>(null);

export function MemberProvider({
  member,
  children,
}: {
  member: Member;
  children: ReactNode;
}) {
  return (
    <MemberContext.Provider value={{ member }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  const context = useContext(MemberContext);

  if (!context) {
    throw new Error("useMember must be used inside MemberProvider");
  }

  return context;
}