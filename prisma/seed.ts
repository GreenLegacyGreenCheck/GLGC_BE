import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ACTIONS = [
  {
    code: 'LED_LIGHTING',
    title: 'LED 조명 전면 교체',
    description: '기존 형광등을 LED로 교체해 조명 전력 최대 60% 절감',
    icon: '💡',
    category: 'ELECTRICITY',
    cause: '비효율 조명 사용',
    difficulty: '쉬움',
    costLabel: '50~150만원',
    reductionRateMin: 0.05,
    reductionRateMax: 0.1,
  },
  {
    code: 'STANDBY_POWER',
    title: '대기전력 차단기 설치',
    description: '영업 종료 후 일괄 차단으로 불필요한 전력 소비 방지',
    icon: '🔌',
    category: 'ELECTRICITY',
    cause: '대기전력 누수',
    difficulty: '쉬움',
    costLabel: '5~20만원',
    reductionRateMin: 0.03,
    reductionRateMax: 0.07,
  },
  {
    code: 'HVAC_EFFICIENCY',
    title: '인버터 에어컨 교체',
    description: '정속형 → 인버터 냉방기 교체로 냉방 효율 50% 향상',
    icon: '❄️',
    category: 'ELECTRICITY',
    cause: '냉방설비 노후화',
    difficulty: '중간',
    costLabel: '150~300만원',
    reductionRateMin: 0.1,
    reductionRateMax: 0.2,
  },
  {
    code: 'INSULATION',
    title: '단열 필름 시공',
    description: '창문 단열 필름으로 냉난방 부하를 줄여 에너지 20% 절감',
    icon: '🖼️',
    category: 'GAS',
    cause: '건물 단열 부족',
    difficulty: '중간',
    costLabel: '30~80만원',
    reductionRateMin: 0.1,
    reductionRateMax: 0.2,
  },
  {
    code: 'HEATING_EFFICIENCY',
    title: '보일러 난방 효율 개선',
    description: '노후 보일러 점검·교체로 동일 난방량 대비 가스 사용량 절감',
    icon: '🔥',
    category: 'GAS',
    cause: '난방설비 노후화',
    difficulty: '중간',
    costLabel: '20~100만원',
    reductionRateMin: 0.08,
    reductionRateMax: 0.15,
  },
];

async function main() {
  for (const action of ACTIONS) {
    await prisma.action.upsert({
      where: { code: action.code },
      create: action,
      update: action,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
