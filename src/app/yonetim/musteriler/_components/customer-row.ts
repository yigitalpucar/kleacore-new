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
