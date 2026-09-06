import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ cityCode: string }>;
  },
) {
  const { cityCode } = await params;

  const response = await fetch(
    `https://psgc.cloud/api/v2/cities-municipalities/${cityCode}/barangays`,
    {
      next: {
        revalidate: 86400,
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to load barangays." },
      { status: 500 },
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}