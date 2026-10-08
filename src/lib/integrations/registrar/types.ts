import type { DnsRecord, Domain, User } from "@prisma/client";

export type DomainCustomer = Pick<
  User,
  "id" | "name" | "surname" | "email" | "phone" | "address" | "city" | "country" | "companyName"
>;

export interface RegisterDomainInput {
  domain: string;
  years: number;
  nameservers: string[];
  customer?: DomainCustomer | null;
}

export interface RenewDomainInput {
  domain: string;
  years: number;
}

/** Registrar's view of a domain (status sync). Missing fields mean "unknown", never "empty". */
export interface RegistrarDomainInfo {
  domain: string;
  expiresAt?: Date | null;
  /** Raw registrar status, e.g. "active", "expired", "transfer_pending". */
  status?: string | null;
  nameservers?: string[];
}

export interface RenewDomainResultData {
  reference?: string;
  /** New expiry reported by the registrar, when its response carries one. */
  expiresAt?: Date | null;
}

export interface NameserverInput {
  domain: string;
  nameservers: string[];
}

export interface DnsRecordInput {
  domain: Domain;
  records: Array<Pick<DnsRecord, "type" | "name" | "value" | "ttl" | "priority">>;
}

export interface TransferInput {
  domain: string;
  eppCode: string;
  customer?: DomainCustomer | null;
}

export interface DomainAvailabilityData {
  domain: string;
  available: boolean;
}

export interface RegistrarConfig {
  enabled: boolean;
  provider: string;
  apiUrl?: string;
  apiKey?: string;
}

export interface GriRegistrarConfig extends RegistrarConfig {
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  testMode: boolean;
}

export interface GriTldPricingRow {
  tld: string;
  register: number;
  renew: number;
  transfer: number;
  currency: string;
}