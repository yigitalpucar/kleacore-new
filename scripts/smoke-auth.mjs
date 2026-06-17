const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function login(email, password, callbackUrl) {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const ingest = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1));
    }
  };

  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  ingest(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${base}${callbackUrl}`,
    json: "true",
  });

  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  ingest(loginRes);

  const session = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookieHeader() },
  }).then((r) => r.json());

  const protectedRes = await fetch(`${base}${callbackUrl}`, {
    redirect: "manual",
    headers: { Cookie: cookieHeader() },
  });

  return {
    loginStatus: loginRes.status,
    location: loginRes.headers.get("location"),
    sessionEmail: session?.user?.email ?? null,
    sessionRole: session?.user?.role ?? null,
    protectedStatus: protectedRes.status,
  };
}

async function main() {
  console.log("admin:", await login("admin@kleacore.com", "Admin123!", "/yonetim"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});