import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    registrations: [
      {
        agentId: 10,
        agentRegistry:
          "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      },
    ],
  });
}
