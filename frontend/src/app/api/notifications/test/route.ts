import { NextResponse } from "next/server";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { notifyOps, notifyRecipient } from "@/lib/notify";

export async function POST(request: Request) {
  if (!hasAgentSecret()) {
    return missingSecretResponse();
  }
  const auth = await requireSignedAuth(request);
  if (!auth.ok) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as {
    method?: "sms" | "whatsapp";
    phone?: string;
  };

  const [ops, recipient] = await Promise.all([
    notifyOps("notification_test", { source: "api/notifications/test" }),
    body.method && body.phone
      ? notifyRecipient({
          method: body.method,
          phone: body.phone,
          message: "CeloFX test notification: channel is configured.",
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    success: true,
    ops,
    recipient,
  });
}
