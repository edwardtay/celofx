type NotifyMethod = "sms" | "whatsapp";

interface RecipientNotifyInput {
  method: NotifyMethod;
  phone: string;
  message: string;
}

function hasTwilioConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export async function notifyRecipient(input: RecipientNotifyInput): Promise<{
  sent: boolean;
  channel: string | null;
  error?: string;
}> {
  if (!hasTwilioConfig()) {
    return { sent: false, channel: null, error: "twilio_not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN as string;
  const fromNumber = process.env.TWILIO_FROM_NUMBER as string;
  const whatsappFrom =
    process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const to = input.phone.trim();
  const from = input.method === "whatsapp" ? whatsappFrom : fromNumber;
  const toFormatted =
    input.method === "whatsapp" && !to.startsWith("whatsapp:")
      ? `whatsapp:${to}`
      : to;

  const params = new URLSearchParams();
  params.set("To", toFormatted);
  params.set("From", from);
  params.set("Body", input.message);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${accountSid}:${authToken}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      return { sent: false, channel: input.method, error: `twilio_${res.status}` };
    }

    return { sent: true, channel: input.method };
  } catch {
    return { sent: false, channel: input.method, error: "twilio_request_failed" };
  }
}

export async function notifyOps(event: string, payload: Record<string, unknown>) {
  const channels: string[] = [];
  const errors: string[] = [];

  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          payload,
          timestamp: Date.now(),
        }),
      });
      if (res.ok) channels.push("webhook");
      else errors.push(`webhook_${res.status}`);
    } catch {
      errors.push("webhook_request_failed");
    }
  }

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) {
    try {
      const message = `CeloFX ${event}\n${JSON.stringify(payload).slice(0, 1200)}`;
      const res = await fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            disable_web_page_preview: true,
          }),
        }
      );
      if (res.ok) channels.push("telegram");
      else errors.push(`telegram_${res.status}`);
    } catch {
      errors.push("telegram_request_failed");
    }
  }

  return {
    delivered: channels.length > 0,
    channels,
    errors,
  };
}
