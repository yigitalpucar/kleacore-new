import { describe, expect, it } from "vitest";
import type { ProductConfigOptionView } from "@/lib/products/configurator-types";
import {
  defaultSelections,
  findOsOption,
  osFamily,
  planForResource,
  quoteVds,
  resourceStops,
  sliderPlans,
  toVdsPlan,
  type VdsPlan,
} from "./vds-configurator";

function vds(sku: string, cpu: string, ram: string, disk: string, monthly: number, yearly: number | null, extra: Partial<Parameters<typeof toVdsPlan>[0]> = {}) {
  return toVdsPlan({
    sku,
    slug: sku.toLowerCase(),
    name: sku,
    isPopular: false,
    basePrice: monthly,
    features: [{ label: "İşlemci", value: cpu }],
    includedFeatures: [],
    resourceLimits: { cpu, ram, disk },
    pricingTiers: [
      { period: "monthly", price: monthly },
      ...(yearly === null ? [] : [{ period: "yearly", price: yearly }]),
    ],
    ...extra,
  });
}

const plans: VdsPlan[] = [
  vds("VDS-3", "4 vCPU", "8 GB", "80 GB", 179.99, 151.19),
  vds("VDS-1", "1 vCPU", "2 GB", "30 GB", 99.99, 83.99),
  vds("VDS-2", "2 vCPU", "4 GB", "50 GB", 139.99, 117.59),
  vds("VDS-X", "2 vCPU", "—", "50 GB", 120, null),
];

const osOption: ProductConfigOptionView = {
  id: "o1",
  productId: "p",
  name: "İşletim Sistemi",
  slug: "os",
  optionType: "select",
  choices: [
    { value: "ubuntu-24-04", label: "Ubuntu 24.04 LTS", priceMonthly: 0, priceYearly: 0 },
    { value: "win-2022", label: "Windows Server 2022", priceMonthly: 150, priceYearly: 1500 },
  ],
  minValue: null,
  maxValue: null,
  unitPrice: 0,
  unitPriceYearly: 0,
  isRequired: true,
  displayOrder: 0,
  isActive: true,
};

const ipOption: ProductConfigOptionView = {
  ...osOption,
  id: "o2",
  name: "Ek IPv4",
  slug: "extra-ip",
  optionType: "quantity",
  choices: [],
  minValue: 0,
  maxValue: 4,
  unitPrice: 50,
  unitPriceYearly: 500,
  isRequired: false,
};

describe("toVdsPlan", () => {
  it("parses resources and the yearly saving from DB records", () => {
    const plan = plans[1];
    expect(plan.resources).toEqual({ cpu: 1, ram: 2, disk: 30 });
    expect(plan.savingsPercent).toBe(16);
    expect(plans[3].resources.ram).toBeNull();
  });
  it("picks up a module-bound fixed OS label", () => {
    const plan = vds("P", "1 vCPU", "1 GB", "10 GB", 10, null, { moduleOptions: { osLabel: " Ubuntu 22.04 LTS " } });
    expect(plan.fixedOs).toBe("Ubuntu 22.04 LTS");
  });
});

describe("snap-to-plan sliders", () => {
  const usable = sliderPlans(plans);

  it("drops plans with unknown resources and sorts by price", () => {
    expect(usable.map((p) => p.sku)).toEqual(["VDS-1", "VDS-2", "VDS-3"]);
  });

  it("offers only values that real plans have", () => {
    expect(resourceStops(usable, "cpu")).toEqual([1, 2, 4]);
    expect(resourceStops(usable, "disk")).toEqual([30, 50, 80]);
  });

  it("selects the cheapest plan with at least the chosen amount", () => {
    expect(planForResource(usable, "ram", 4)?.sku).toBe("VDS-2");
    expect(planForResource(usable, "ram", 3)?.sku).toBe("VDS-2");
    expect(planForResource(usable, "cpu", 1)?.sku).toBe("VDS-1");
    expect(planForResource(usable, "disk", 999)?.sku).toBe("VDS-3");
  });
});

describe("operating system", () => {
  it("finds the OS option by slug or name", () => {
    expect(findOsOption([ipOption, osOption])?.slug).toBe("os");
    expect(findOsOption([{ ...osOption, slug: "sistem", name: "İşletim sistemi" }])?.slug).toBe("sistem");
    expect(findOsOption([ipOption])).toBeUndefined();
  });
  it("maps choices to logo families", () => {
    expect(osFamily({ value: "ubuntu-24-04", label: "Ubuntu" })).toBe("ubuntu");
    expect(osFamily({ value: "alma9", label: "AlmaLinux 9" })).toBe("almalinux");
    expect(osFamily({ value: "rocky", label: "Rocky Linux 9" })).toBe("rockylinux");
    expect(osFamily({ value: "w22", label: "Windows Server 2022" })).toBe("windows");
    expect(osFamily({ value: "x", label: "Özel kurulum" })).toBe("other");
  });
});

describe("selections and quote", () => {
  const plan: VdsPlan = { ...plans[1], options: [osOption, ipOption] };

  it("defaults required selects and keeps valid previous choices", () => {
    expect(defaultSelections(plan.options)).toEqual({ os: "ubuntu-24-04" });
    expect(defaultSelections(plan.options, { os: "win-2022", "extra-ip": 2 })).toEqual({ os: "win-2022", "extra-ip": 2 });
    expect(defaultSelections(plan.options, { os: "gone", "extra-ip": 9 })).toEqual({ os: "ubuntu-24-04" });
  });

  it("quotes monthly: tier + option monthly prices", () => {
    const q = quoteVds(plan, "monthly", { os: "win-2022", "extra-ip": 2 });
    expect(q.planTotal).toBe(99.99);
    expect(q.optionsTotal).toBe(250);
    expect(q.total).toBe(349.99);
  });

  it("quotes yearly as 12 × the monthly equivalent plus yearly option totals", () => {
    const q = quoteVds(plan, "yearly", { os: "ubuntu-24-04" });
    expect(q.period).toBe("yearly");
    expect(q.planTotal).toBe(1007.88);
    expect(q.total).toBe(1007.88);
  });

  it("falls back to monthly when the plan has no yearly tier", () => {
    expect(quoteVds(plans[3], "yearly", {}).period).toBe("monthly");
  });
});
