import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ regionNumber: string }>;
  },
) {
  const { regionNumber } = await params;

  const token = process.env.PSA_API_KEY;

  if (!token) {
    return NextResponse.json(
      { error: "PSA API token is not configured." },
      { status: 500 },
    );
  }

  let url =
    `https://classification.psa.gov.ph/psgc/Q2_2024/provinces?reg=${encodeURIComponent(
      regionNumber,
    )}&token=${encodeURIComponent(token)}`;

  const allResults: {
    code: string;
    area_name: string;
    geographic_level: string;
    prv: number;
  }[] = [];

  while (url) {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load provinces." },
        { status: response.status },
      );
    }

    const data = await response.json();

    allResults.push(...(data.results ?? []));
    url = data.next;
  }

  const provinces = allResults
    .filter((item) => item.geographic_level === "Prov")
    .map((item) => ({
      code: item.code,
      name: item.area_name,
      provinceNumber: item.prv,
    }));

  return NextResponse.json(provinces);
}