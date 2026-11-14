// The sizes customers will pick from. Chosen from printed test pendants
// (Nov 2026): 19 mm looked best, so it's medium and the default. The
// default outline is Liquid, as on the caster samples.
//
// Thickness grows with size so small pendants stay castable without big
// ones looking chunky: 1.0 mm at 15 mm up to 1.2 mm at 25 mm. Bar and rim
// widths stay the same in mm at every size (see pendant-defaults.json).

export type PendantSizeId = 'small' | 'medium' | 'large';

export function thicknessForDiameter(diameterMm: number) {
  return Math.round((1.0 + (diameterMm - 15) * 0.02) * 100) / 100;
}

export const PENDANT_SIZES: { id: PendantSizeId; label: string; diameterMm: number; thicknessMm: number }[] = [
  { id: 'small', label: 'Small', diameterMm: 17, thicknessMm: thicknessForDiameter(17) }, // 1.04 mm
  { id: 'medium', label: 'Medium', diameterMm: 19, thicknessMm: thicknessForDiameter(19) }, // 1.08 mm
  { id: 'large', label: 'Large', diameterMm: 22, thicknessMm: thicknessForDiameter(22) }, // 1.14 mm
];

export const DEFAULT_SIZE: PendantSizeId = 'medium';
