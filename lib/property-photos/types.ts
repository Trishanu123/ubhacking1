import { z } from "zod";

export const PhotoInventorySchema = z.object({
  items: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    count: z.number().int().min(1).max(500),
    energySource: z.enum(["electric", "gas", "both", "unclear"]),
    confidence: z.number().min(0).max(1),
  })).max(100),
  note: z.string().max(600),
});
export type PhotoInventory = z.infer<typeof PhotoInventorySchema>;

export function inventoryCounts(inventory: PhotoInventory) {
  return inventory.items.reduce((counts, item) => ({
    electric: counts.electric + (item.energySource === "electric" || item.energySource === "both" ? item.count : 0),
    gas: counts.gas + (item.energySource === "gas" || item.energySource === "both" ? item.count : 0),
    unclear: counts.unclear + (item.energySource === "unclear" ? item.count : 0),
  }), { electric: 0, gas: 0, unclear: 0 });
}
