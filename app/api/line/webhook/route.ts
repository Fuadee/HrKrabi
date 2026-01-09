import { NextResponse } from "next/server";

type LineWebhookEvent = {
  type?: string;
  source?: {
    groupId?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

export async function POST(req: Request) {
  let body: LineWebhookBody;

  try {
    body = (await req.json()) as LineWebhookBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  events.forEach((event) => {
    const groupId = event.source?.groupId;
    const eventType = event.type;

    if (eventType) {
      console.log("LINE event type:", eventType);
    }

    if (groupId) {
      console.log("LINE groupId:", groupId);
    }
  });

  return NextResponse.json({ ok: true });
}
