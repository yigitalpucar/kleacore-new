/** Where an add-to-cart button sends a plan (mirrors the cart store payloads). */
export type CartTarget =
  | { kind: "server"; category: "vds" | "vps" | "cloud" | "fiziksel" }
  | { kind: "datacenter"; subType: string };
