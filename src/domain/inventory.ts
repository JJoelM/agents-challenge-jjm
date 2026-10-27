export interface EquipmentUnit {
  id: string;
  name: string;
  description: string;
}

export const PRELOADED_INVENTORY: readonly EquipmentUnit[] = [
  { id: 'MIC-01', name: 'Microscopio digital', description: 'Microscopio digital - Unidad 1' },
  { id: 'MIC-02', name: 'Microscopio digital', description: 'Microscopio digital - Unidad 2' },
  { id: 'OSC-01', name: 'Osciloscopio', description: 'Osciloscopio digital de laboratorio' },
  { id: 'MUL-01', name: 'Multímetro', description: 'Multímetro de precisión' },
  { id: 'FUE-01', name: 'Fuente de alimentación', description: 'Fuente de alimentación regulable' },
] as const;

export function getInventory(): readonly EquipmentUnit[] {
  return PRELOADED_INVENTORY;
}

export function isKnownUnit(unitId: string): boolean {
  return PRELOADED_INVENTORY.some((unit) => unit.id === unitId);
}

export function getUnitById(unitId: string): EquipmentUnit | undefined {
  return PRELOADED_INVENTORY.find((unit) => unit.id === unitId);
}
