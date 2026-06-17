export interface KleacoreApiErrorBody {
  success: false;
  error: string;
  errors?: Record<string, string[]>;
}

export class KleacoreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: KleacoreApiErrorBody | unknown
  ) {
    super(message);
    this.name = "KleacoreApiError";
  }
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ListInvoicesParams extends PaginationParams {
  status?: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
}

export interface ListServicesParams extends PaginationParams {
  status?: "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  category?:
    | "hosting"
    | "vds"
    | "vps"
    | "server"
    | "cloud"
    | "datacenter"
    | "domain"
    | "ssl"
    | "email";
}

export interface ListOrdersParams extends PaginationParams {
  status?:
    | "PENDING"
    | "APPROVED"
    | "PROCESSING"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
}

export interface ListDomainsParams extends PaginationParams {
  status?: "ACTIVE" | "EXPIRED" | "TRANSFERRING" | "PENDING";
}

export interface ListTicketsParams extends PaginationParams {
  status?: "OPEN" | "CUSTOMER_REPLY" | "ADMIN_REPLY" | "WAITING" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  department?: "GENERAL" | "TECHNICAL" | "BILLING" | "SALES";
}

export interface CreateTicketData {
  subject: string;
  message: string;
  department?: "GENERAL" | "TECHNICAL" | "BILLING" | "SALES";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedServiceId?: string | null;
}

function buildQuery(params?: object): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export class KleacoreClient {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = "https://kleacore.com/api/v1"
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new KleacoreApiError(
        "API yanıtı geçerli JSON değil",
        response.status,
        null
      );
    }

    const parsed = body as { success?: boolean; data?: T; error?: string };

    if (!response.ok || parsed.success === false) {
      throw new KleacoreApiError(
        parsed.error ?? `API isteği başarısız (${response.status})`,
        response.status,
        body
      );
    }

    return parsed.data as T;
  }

  listInvoices(params?: ListInvoicesParams) {
    return this.request(`/invoices${buildQuery(params)}`);
  }

  getInvoice(id: string) {
    return this.request(`/invoices/${encodeURIComponent(id)}`);
  }

  listServices(params?: ListServicesParams) {
    return this.request(`/services${buildQuery(params)}`);
  }

  getService(id: string) {
    return this.request(`/services/${encodeURIComponent(id)}`);
  }

  listOrders(params?: ListOrdersParams) {
    return this.request(`/orders${buildQuery(params)}`);
  }

  getOrder(id: string) {
    return this.request(`/orders/${encodeURIComponent(id)}`);
  }

  listDomains(params?: ListDomainsParams) {
    return this.request(`/domains${buildQuery(params)}`);
  }

  getDomain(idOrName: string) {
    return this.request(`/domains/${encodeURIComponent(idOrName)}`);
  }

  listTickets(params?: ListTicketsParams) {
    return this.request(`/tickets${buildQuery(params)}`);
  }

  createTicket(data: CreateTicketData) {
    return this.request("/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}