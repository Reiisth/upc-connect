import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ cityCode: string }>;
  },
) {
  const { cityCode } = await params;

  const token = process.env.PSA_API_KEY;

  if (!token) {
    return NextResponse.json(
      { error: "PSA API token is not configured." },
      { status: 500 },
    );
  }

  // 1. Find the selected city/municipality record
  let cityUrl =
    `https://classification.psa.gov.ph/psgc/Q2_2024/all?token=${encodeURIComponent(
      token,
    )}`;

  let selectedCity:
    | {
        code: string;
        reg: number;
        prv: number;
        mun: number;
      }
    | undefined;

  while (cityUrl && !selectedCity) {
    const response = await fetch(cityUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load city information." },
        { status: response.status },
      );
    }

    const data = await response.json();

    selectedCity = data.results?.find(
      (item: { code: string }) => item.code === cityCode,
    );

    cityUrl = data.next;
  }

  if (!selectedCity) {
    return NextResponse.json(
      { error: "City or municipality not found." },
      { status: 404 },
    );
  }

  // 2. Load barangays
  let barangayUrl =
    `https://classification.psa.gov.ph/psgc/Q2_2024/barangays?token=${encodeURIComponent(
      token,
    )}`;

  const allBarangays: {
    code: string;
    area_name: string;
    reg: number;
    prv: number;
    mun: number;
  }[] = [];

  while (barangayUrl) {
    const response = await fetch(barangayUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load barangays." },
        { status: response.status },
      );
    }

    const data = await response.json();

    allBarangays.push(...(data.results ?? []));
    barangayUrl = data.next;
  }

  // 3. Return only barangays belonging to the selected city
  const barangays = allBarangays
    .filter(
      (item) =>
        item.reg === selectedCity.reg &&
        item.prv === selectedCity.prv &&
        item.mun === selectedCity.mun,
    )
    .map((item) => ({
      code: item.code,
      name: item.area_name,
    }));

  return NextResponse.json(barangays);
}