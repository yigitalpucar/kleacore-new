/** Plain, serialisable customer row shared by the admin customer lists. */
export type CustomerRow = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  status: string;
  customerType: string | null;
  companyName: string | null;
  balance: number;
  createdAt: string;
  orders: number;
  services: number;
  tickets: number;
};

type CustomerRecord = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  status: string;
  customerType: string | null;
  companyName: string | null;
  balance: unknown;
  createdAt: Date;
  _count: { orders: number; services: number; tickets: number };
};

export function toCustomerRow(c: CustomerRecord): CustomerRow {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    surname: c.surname,
    phone: c.phone,
    status: c.status,
    customerType: c.customerType,
    companyName: c.companyName,
    balance: Number(c.balance ?? 0),
    createdAt: c.createdAt.toISOString(),
    orders: c._count.orders,
    services: c._count.services,
    tickets: c._count.tickets,
  };
}

/** perPage for admin lists: 100 unless the URL asks for something else. */
export function listPerPage(sp: Record<string, string | string[] | undefined>, parsed: number) {
  return sp.perPage ? parsed : 100;
}

const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

export const customerFullName = (c: Pick<CustomerRow, "name" | "surname">) => `${c.name} ${c.surname}`.trim();

/** Search of the customer tables (and their CSV export); `q` is already lower-cased. */
export function customerSearch(c: CustomerRow, q: string) {
  return (
    tr(customerFullName(c)).includes(q) ||
    tr(c.email).includes(q) ||
    tr(c.id).includes(q) ||
    tr(c.companyName).includes(q) ||
    tr(c.phone).includes(q)
  );
}

export const CUSTOMER_FILTER_VALUES: Record<string, (c: CustomerRow) => string> = {
  status: (c) => c.status,
  type: (c) => c.customerType ?? "INDIVIDUAL",
};
