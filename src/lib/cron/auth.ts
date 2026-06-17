function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || "";
}

export function isCronConfigured() {
  return Boolean(getCronSecret());
}

export function verifyCronRequest(request: Request) {
  const secret = getCronSecret();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return headerSecret === secret;
}