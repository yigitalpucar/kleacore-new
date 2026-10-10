import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getBellNotifications, markNotificationsRead } from "@/lib/dal/notifications";
import { isSameOriginRequest } from "@/lib/support/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * In-app bell for the signed-in user (customer or staff): GET lists the
 * latest notifications + unread count, POST marks them read. Every query is
 * filtered by the session user id; there is no way to address another user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getBellNotifications(session.user.id);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

const markSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) }),
]);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const updated = await markNotificationsRead(session.user.id, parsed.data);
  const data = await getBellNotifications(session.user.id);
  return NextResponse.json({ updated, ...data }, { headers: { "Cache-Control": "no-store" } });
}
