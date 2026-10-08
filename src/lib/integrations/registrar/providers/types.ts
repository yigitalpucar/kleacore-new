import type { IntegrationResult } from "../../settings";
import type {
  DnsRecordInput,
  DomainAvailabilityData,
  GriTldPricingRow,
  NameserverInput,
  RegisterDomainInput,
  RegistrarDomainInfo,
  RenewDomainResultData,
  RenewDomainInput,
  TransferInput,
} from "../types";

export interface RegistrarProvider {
  readonly name: string;
  registerDomain(
    input: RegisterDomainInput
  ): Promise<IntegrationResult<{ reference?: string }>>;
  renewDomain(input: RenewDomainInput): Promise<IntegrationResult<RenewDomainResultData>>;
  /** Registrar status/expiry/nameservers for the daily sync (optional). */
  getDomainInfo?(domain: string): Promise<IntegrationResult<RegistrarDomainInfo>>;
  updateNameservers(
    input: NameserverInput
  ): Promise<IntegrationResult<{ reference?: string }>>;
  updateDnsRecords(
    input: DnsRecordInput
  ): Promise<IntegrationResult<{ reference?: string }>>;
  transferDomain(input: TransferInput): Promise<IntegrationResult<{ reference?: string }>>;
  checkDomainAvailability(
    domain: string
  ): Promise<IntegrationResult<DomainAvailabilityData>>;
  checkDomainsAvailability?(
    domains: string[]
  ): Promise<IntegrationResult<DomainAvailabilityData[]>>;
  fetchTldPricing?(): Promise<IntegrationResult<GriTldPricingRow[]>>;
  healthCheck(): Promise<IntegrationResult<{ status: string }>>;
}