import { NextRequest, NextResponse } from "next/server";

// Alias route following Phala Cloud convention — redirects to /api/attestation
export async function GET(request: NextRequest) {
  const url = new URL("/api/attestation", request.url);
  return NextResponse.redirect(url, 307);
}
