import { NextRequest, NextResponse } from "next/server";

import { sendToGroup } from "@/lib/line/send";

type TestSendPayload = {
  text?: string;
};

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: TestSendPayload;

  try {
    payload = (await request.json()) as TestSendPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";

  if (!text) {
    return NextResponse.json(
      { success: false, error: "Missing text." },
      { status: 400 },
    );
  }

  try {
    const result = await sendToGroup(text);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
