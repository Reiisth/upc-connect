import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ provinceNumber: string }>;
  },
) {
  const { provinceNumber } = await params;

  const token = process.env.PSA_API_KEY;

  if (!token) {
    return NextResponse.json(
      { error: "PSA API token is not configured." },
      { status: 500 },
    );
  }

  let url =
    `https://classification.psa.gov.ph/psgc/Q2_2024/municipalities?prv=${encodeURIComponent(
      provinceNumber,
    )}&token=${encodeURIComponent(token)}`;

  const allResults: {
    code: string;
    area_name: string;
    geographic_level: string;
    mun: number;
  }[] = [];

  while (url) {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load cities and municipalities." },
        { status: response.status },
      );
    }

    const data = await response.json();

    allResults.push(...(data.results ?? []));
    url = data.next;
  }

  const cities = allResults
    .filter(
      (item) =>
        item.geographic_level === "City" ||
        item.geographic_level === "Mun",
    )
    .map((item) => ({
      code: item.code,
      name: item.area_name,
      municipalityNumber: item.mun,
    }));

  return NextResponse.json(cities);
}