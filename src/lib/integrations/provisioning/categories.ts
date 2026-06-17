export const CPANEL_CATEGORY_SLUGS = ["hosting", "email"] as const;

export const VPS_VDS_CATEGORY_SLUGS = ["vps", "vds", "cloud", "server"] as const;

export type CpanelCategorySlug = (typeof CPANEL_CATEGORY_SLUGS)[number];
export type VpsVdsCategorySlug = (typeof VPS_VDS_CATEGORY_SLUGS)[number];

export function getProductCategorySlug(
  product?: { category?: { slug: string } | null } | null
) {
  return product?.category?.slug?.toLowerCase() ?? "";
}

export function isCpanelCategory(slug: string) {
  return CPANEL_CATEGORY_SLUGS.includes(slug as CpanelCategorySlug);
}

export function isVpsVdsCategory(slug: string) {
  return VPS_VDS_CATEGORY_SLUGS.includes(slug as VpsVdsCategorySlug);
}