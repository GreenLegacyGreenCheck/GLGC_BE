export type Grade = 'A' | 'B' | 'C' | 'D';

// 프론트엔드 report-data.ts의 GRADE_BANDS와 동일한 임계값(톤 단위) — 같은 진단에
// 프론트/백엔드가 서로 다른 등급을 매기지 않도록 숫자를 맞춰 둔다.
const GRADE_BAND_MAX_TONS: { grade: Grade; maxTons: number }[] = [
  { grade: 'A', maxTons: 1.5 },
  { grade: 'B', maxTons: 2.3 },
  { grade: 'C', maxTons: 3.0 },
  { grade: 'D', maxTons: Infinity },
];

export function getGradeForKg(targetEmissionKg: number): Grade {
  const tons = targetEmissionKg / 1000;
  const band = GRADE_BAND_MAX_TONS.find(({ maxTons }) => tons <= maxTons);
  return band?.grade ?? 'D';
}
