/**
 * Pure naming helpers of the Proxmox module (safe for client components:
 * the admin backup card computes a target server's name for confirmation).
 */

/** VM name for a service: "kc-" + last 12 id characters (DNS-safe, unique enough; ownership is checked by marker). */
export function vmNameFor(serviceId: string) {
  return `kc-${serviceId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-12)}`;
}

/** Written into the VM description; the only proof a VM belongs to a service. */
export function ownerMarker(serviceId: string) {
  return `kleacore-service:${serviceId}`;
}
