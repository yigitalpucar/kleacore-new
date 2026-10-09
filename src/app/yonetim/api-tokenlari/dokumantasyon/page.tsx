import type { Metadata } from "next";
import { CopyButton, PageHeader, SectionCard } from "@/components/app";
import { ADMIN_API_OPERATIONS } from "@/lib/admin-api/registry";
import { ADMIN_API_BASE } from "@/lib/admin-api/route";
import { scopeLabel } from "@/lib/admin-api/scopes";
import { toolDefinition } from "@/lib/admin-api/tools";
import { getAppBaseUrl } from "@/lib/stripe";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin API dokümantasyonu" };

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative rounded-md border bg-muted/40">
      <div className="absolute right-1 top-1">
        <CopyButton value={code} label={`${label} kopyala`} />
      </div>
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default async function AdminApiDocsPage() {
  await requirePermission("api_tokens.manage");
  const base = `${getAppBaseUrl()}${ADMIN_API_BASE}`;
  const tags = [...new Set(ADMIN_API_OPERATIONS.map((operation) => operation.tag))];
  const exampleTools = ["listTickets", "replyToTicket"].map((id) =>
    toolDefinition(ADMIN_API_OPERATIONS.find((operation) => operation.id === id)!)
  );

  const curl = `export KLEACORE_TOKEN="kc_admin_…"   # Yönetim → API token'ları

# Token'ın kim adına ve hangi yetkilerle çalıştığı
curl -s ${base}/me -H "Authorization: Bearer $KLEACORE_TOKEN"

# Yanıt bekleyen destek talepleri (cursor ile sayfalama)
curl -s "${base}/tickets?status=CUSTOMER_REPLY&limit=20" -H "Authorization: Bearer $KLEACORE_TOKEN"
curl -s "${base}/tickets?status=CUSTOMER_REPLY&limit=20&cursor=<pagination.nextCursor>" -H "Authorization: Bearer $KLEACORE_TOKEN"

# Talebe yanıt (token sahibi adına); tekrar denemede çift mesaj olmasın diye Idempotency-Key
curl -s -X POST ${base}/tickets/<id>/reply \\
  -H "Authorization: Bearer $KLEACORE_TOKEN" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"message":"Merhaba, sorunu inceledik…","status":"WAITING"}'

# Faturayı havale ile ödendi işaretle (manuel ödeme kaydı + normal tahsilat akışı)
curl -s -X POST ${base}/invoices/<id>/mark-paid \\
  -H "Authorization: Bearer $KLEACORE_TOKEN" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: dekont-2026-0412" \\
  -d '{"method":"BANK_TRANSFER","reference":"DEKONT-2026-0412"}'

# Yeni olayları yoklama: order=asc, dönen nextCursor'ı saklayıp bir sonraki çağrıda gönderin
curl -s "${base}/events?order=asc&type=invoice.&limit=50&cursor=<son nextCursor>" -H "Authorization: Bearer $KLEACORE_TOKEN"

# Makine tarafından okunur tanım
curl -s ${base}/openapi.json -H "Authorization: Bearer $KLEACORE_TOKEN" -o kleacore-admin-openapi.json`;

  const errorExample = `{
  "error": {
    "code": "insufficient_scope",
    "message": "Bu işlem için \\"services.manage\\" yetkisi gerekli",
    "details": { "required": "services.manage", "granted": ["services.view"] }
  },
  "requestId": "6f1c…"
}`;

  const toolsJson = JSON.stringify(
    exampleTools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
    null,
    2
  );

  const agentLoop = `// Aracı çağırınca: x-http bilgisiyle HTTP isteğine çevirin (TypeScript örneği)
async function runTool(tool: { method: string; path: string; pathParams: string[]; queryParams: string[]; bodyParams: string[] }, input: Record<string, unknown>) {
  let path = tool.path;
  for (const name of tool.pathParams) path = path.replace(\`{\${name}}\`, encodeURIComponent(String(input[name])));
  const query = new URLSearchParams(tool.queryParams.filter((n) => input[n] !== undefined).map((n) => [n, String(input[n])]));
  const body = Object.fromEntries(tool.bodyParams.filter((n) => input[n] !== undefined).map((n) => [n, input[n]]));
  const response = await fetch(\`${base}\${path}\${query.size ? "?" + query : ""}\`, {
    method: tool.method,
    headers: {
      Authorization: \`Bearer \${process.env.KLEACORE_TOKEN}\`,
      "Content-Type": "application/json",
      ...(tool.method === "POST" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: tool.method === "GET" ? undefined : JSON.stringify(body),
  });
  return await response.json(); // hata da olsa modele verin: error.code / error.message açıklayıcıdır
}`;

  return (
    <>
      <PageHeader
        title="Admin API dokümantasyonu"
        description="Otomasyon ve yapay zekâ ajanlarının KLEACORE'u yönetmesi için REST API. Tam tanım: OpenAPI 3.1 (openapi.json, token gerekir)."
        back={{ href: "/yonetim/api-tokenlari", label: "API token'ları" }}
      />

      <SectionCard title="Temel kurallar">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            Taban adres <code className="font-mono">{base}</code>; her istek <code className="font-mono">Authorization: Bearer kc_admin_…</code> ister.
          </li>
          <li>
            Token yalnız seçilen yetkileri (scope) kullanabilir ve bunlar her istekte sahibinin <strong>o anki</strong> rol yetkileriyle kesiştirilir. Sahibi
            pasifleşirse, rolü değişirse veya token iptal edilirse/süresi dolarsa erişim anında kesilir.
          </li>
          <li>
            Yanıt <code className="font-mono">{"{ data }"}</code>, listelerde <code className="font-mono">{"{ data, pagination: { nextCursor, hasMore, limit } }"}</code>.
            Sonraki sayfa için <code className="font-mono">cursor=nextCursor</code> gönderin (limit ≤ 100).
          </li>
          <li>
            POST isteklerinde <code className="font-mono">Idempotency-Key</code> başlığı: aynı anahtar ve aynı gövdeyle 24 saat içindeki tekrar, işlemi yeniden
            yapmadan ilk yanıtı döndürür (<code className="font-mono">Idempotent-Replayed: true</code>). Aynı anahtar farklı gövdeyle 422 döner.
          </li>
          <li>
            Token başına dakikalık istek sınırı vardır; aşılınca 429 ve <code className="font-mono">Retry-After</code>. Tutarlar ondalık metin
            (&quot;1234.50&quot;), zamanlar ISO 8601 UTC.
          </li>
          <li>Her çağrı (reddedilenler dahil) token sahibi adına Aktivite kayıtlarına yazılır: token, uç nokta, yöntem, durum kodu, IP.</li>
        </ul>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Hata biçimi</p>
          <CodeBlock code={errorExample} label="Hata örneği" />
        </div>
      </SectionCard>

      <SectionCard title="Uç noktalar" description={`${ADMIN_API_OPERATIONS.length} işlem`} flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Admin API uç noktaları</caption>
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Uç nokta</th>
                <th scope="col" className="px-4 py-2 font-medium">Açıklama</th>
                <th scope="col" className="px-4 py-2 font-medium">Yetki</th>
              </tr>
            </thead>
            {tags.map((tag) => (
              <tbody key={tag} className="border-b last:border-0">
                <tr>
                  <th scope="rowgroup" colSpan={3} className="bg-muted/40 px-4 py-1.5 text-left font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {tag}
                  </th>
                </tr>
                {ADMIN_API_OPERATIONS.filter((operation) => operation.tag === tag).map((operation) => (
                  <tr key={operation.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      <span className="inline-block w-12 font-semibold">{operation.method}</span>
                      {operation.path}
                    </td>
                    <td className="px-4 py-2">{operation.summary}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs" title={operation.permission ? scopeLabel(operation.permission) : undefined}>
                      {operation.permission ?? "herhangi bir token"}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </SectionCard>

      <SectionCard title="curl örnekleri">
        <CodeBlock code={curl} label="curl örnekleri" />
      </SectionCard>

      <SectionCard
        title="Yapay zekâ ajanları için"
        description="Her işlem bir araç (tool) olarak tanımlanabilir. Aşağıdaki tanımlar OpenAPI'deki şemalardan üretilmiştir; diğer işlemler için openapi.json'daki operationId, parametreler ve requestBody aynı şekilde kullanılır."
      >
        <div className="space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ajan için ayrı bir token oluşturun; yalnız gereken yetkileri, mümkünse IP kısıtı ve kısa geçerlilik verin.</li>
            <li>Ajan önce <code className="font-mono">GET /me</code> ile etkin yetkilerini öğrensin; yetkisi olmayan araçları modele hiç vermeyin.</li>
            <li>Yazma işlemlerinde (askıya alma, sonlandırma, ödendi, yenileme) her denemeye benzersiz bir <code className="font-mono">Idempotency-Key</code> verin; ağ hatasında aynı anahtarla tekrarlayın.</li>
            <li>Hata yanıtlarını modele olduğu gibi iletin: <code className="font-mono">error.code</code> (ör. conflict, insufficient_scope) bir sonraki adımı belirler.</li>
          </ol>
          <p className="font-medium">Araç tanımı örneği (name / description / input_schema)</p>
          <CodeBlock code={toolsJson} label="Araç tanımları" />
          <p className="font-medium">Araç çağrısını HTTP isteğine çevirme</p>
          <CodeBlock code={agentLoop} label="Ajan kodu" />
        </div>
      </SectionCard>
    </>
  );
}
