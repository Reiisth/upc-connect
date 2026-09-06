import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ provinceCode: string }>;
  },
) {
  const { provinceCode } = await params;

  const response = await fetch(
    `https://psgc.cloud/api/v2/provinces/${provinceCode}/cities-municipalities`,
    {
      next: {
        revalidate: 86400,
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to load cities and municipalities." },
      { status: 500 },
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}