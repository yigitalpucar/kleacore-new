import { NextRequest, NextResponse } from "next/server";
import {
  AFFILIATE_REF_COOKIE,
  AFFILIATE_REF_MAX_AGE_SECONDS,
  getSafeRedirectPath,
  resolveAffiliateByRefCode,
} from "@/lib/affiliate";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const redirectPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("redirect")
  );
  const redirectUrl = new URL(redirectPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  const affiliate = await resolveAffiliateByRefCode(db, code);
  if (!affiliate?.affiliateCode) {
    return response;
  }

  response.cookies.set(AFFILIATE_REF_COOKIE, affiliate.affiliateCode, {
    maxAge: AFFILIATE_REF_MAX_AGE_SECONDS,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}