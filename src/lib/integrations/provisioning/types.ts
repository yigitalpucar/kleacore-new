import type { Product, Service, User } from "@prisma/client";

export type ServiceWithProduct = Service & {
  product?:
    | (Product & {
        category?: { slug: string; name?: string } | null;
      })
    | null;
  customer?: Pick<User, "id" | "name" | "surname" | "email"> | null;
};

export type ServerAction = "start" | "stop" | "restart";

export interface ProvisioningConfig {
  enabled: boolean;
  provider: string;
  apiUrl?: string;
  apiKey?: string;
}

export interface CpanelWhmConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  apiToken: string;
  defaultPlan: string;
  useSsl: boolean;
}

export interface VpsVdsConfig {
  enabled: boolean;
  provider: string;
  apiUrl?: string;
  apiKey?: string;
  apiUsername?: string;
  apiPassword?: string;
}