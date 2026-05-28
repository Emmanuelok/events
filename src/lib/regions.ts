export const REGIONS = [
  { value: "greater_accra", label: "Greater Accra" },
  { value: "ashanti", label: "Ashanti" },
  { value: "western", label: "Western" },
  { value: "central", label: "Central" },
  { value: "eastern", label: "Eastern" },
  { value: "volta", label: "Volta" },
  { value: "northern", label: "Northern" },
  { value: "upper_east", label: "Upper East" },
  { value: "upper_west", label: "Upper West" },
  { value: "bono", label: "Bono" },
  { value: "bono_east", label: "Bono East" },
  { value: "ahafo", label: "Ahafo" },
  { value: "oti", label: "Oti" },
  { value: "savannah", label: "Savannah" },
  { value: "north_east", label: "North East" },
  { value: "western_north", label: "Western North" },
] as const;

export type RegionValue = (typeof REGIONS)[number]["value"];

const map = new Map(REGIONS.map((r) => [r.value, r.label] as const));
export function regionLabel(value: string): string {
  return map.get(value as RegionValue) ?? value;
}
