import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch(
    "https://psgc.cloud/api/v2/provinces",
    {
      next: {
        revalidate: 86400,
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to load provinces." },
      { status: 500 },
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}