import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.PSA_API_KEY;

  if (!token) {
    return NextResponse.json(
      { error: "PSA API token is not configured." },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://classification.psa.gov.ph/psgc/Q2_2024/regions?token=${encodeURIComponent(
      token,
    )}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to load regions." },
      { status: response.status },
    );
  }

  const data = await response.json();

  const regions =
    data.results?.map(
      (region: {
        code: string;
        area_name: string;
        reg: number;
      }) => ({
        code: region.code,
        name: region.area_name,
        regionNumber: region.reg,
      }),
    ) ?? [];

  return NextResponse.json(regions);
}