/**
 * VR 안전교육 - 씬/위험요인 데이터 설정
 * 테스트용 더미 데이터 (실제 데이터로 교체 예정)
 */

const APP_CONFIG = {
  supabaseUrl: 'https://wqxunwyjplbfneukxgdx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeHVud3lqcGxiZm5ldWt4Z2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDk2ODksImV4cCI6MjA4OTM4NTY4OX0.kEY3JWfveZMFxtLs1bN7sZ9Xa3cgZDQJcWp_Xtk-Ybg',
};

// 위험성평가 5x4 매트릭스 등급 정의
const RISK_LEVELS = {
  LOW:      { min: 1,  max: 4,  label: '저위험',   color: '#4CAF50', bgColor: '#E8F5E9' },
  CAUTION:  { min: 5,  max: 9,  label: '주의',     color: '#FF9800', bgColor: '#FFF3E0' },
  HIGH:     { min: 10, max: 15, label: '고위험',   color: '#FF5722', bgColor: '#FBE9E7' },
  CRITICAL: { min: 16, max: 20, label: '매우위험', color: '#D32F2F', bgColor: '#FFEBEE' },
};

// 빈도 단계
const FREQUENCY_LABELS = {
  1: '거의없음',
  2: '가끔',
  3: '때때로',
  4: '자주',
  5: '매우자주',
};

// 강도 단계
const INTENSITY_LABELS = {
  1: '경미',
  2: '상해',
  3: '중상해',
  4: '치명적',
};

// 씬별 위험요인 데이터 (더미)
const SCENE_DATA = {
  scene_pico_1: {
    title: '작업장 A - 제조 현장',
    description: '제조 공정이 이루어지는 작업 현장입니다.',
    hazards: [
      {
        id: 'h1_01',
        title: '롤테이너',
        description: '작업장 내 롤테이너가 이동 중입니다. 주변 근로자의 안전에 주의가 필요합니다.',
        category: '운반장비',
        ath: -30,
        atv: 5,
        risks: [
          {
            title: '발끼임',
            image: '/assets/risks/sample_foot_caught.svg',
            description: '롤테이너 바퀴에 발이 끼일 수 있습니다.',
          },
          {
            title: '다른 근로자와 부딪힘',
            image: '/assets/risks/sample_collision.svg',
            description: '이동 중 다른 근로자와 충돌할 수 있습니다.',
          },
        ],
      },
      {
        id: 'h1_02',
        title: '바닥 정리정돈 불량',
        description: '작업 통로에 자재와 공구가 방치되어 있습니다. 넘어짐 사고 위험이 있습니다.',
        category: '작업환경',
        ath: 120,
        atv: 30,
      },
      {
        id: 'h1_03',
        title: '전기 배선 노출',
        description: '전기 배선의 피복이 벗겨져 있어 감전 위험이 있습니다.',
        category: '전기안전',
        ath: 80,
        atv: -10,
      },
    ],
  },
  scene_pico_3: {
    title: '작업장 B - 외부 현장',
    description: '외부에서 작업이 진행되는 현장입니다.',
    hazards: [
      {
        id: 'h3_01',
        title: '안전난간 미설치',
        description: '높이 2m 이상의 작업 구역에 안전난간이 설치되지 않았습니다. 추락 위험이 있습니다.',
        category: '추락방지',
        ath: 45,
        atv: 0,
      },
      {
        id: 'h3_02',
        title: '소화기 접근 차단',
        description: '소화기 앞에 자재가 적재되어 접근이 불가합니다. 화재 시 초기 대응이 어렵습니다.',
        category: '소방안전',
        ath: -90,
        atv: 10,
      },
      {
        id: 'h3_03',
        title: '중장비 안전구역 미표시',
        description: '중장비 작업 반경 내 안전구역 표시가 없습니다. 협착 사고 위험이 있습니다.',
        category: '중장비안전',
        ath: 160,
        atv: 15,
      },
    ],
  },
};

// 위험도 등급 판정
function getRiskLevel(score) {
  for (const level of Object.values(RISK_LEVELS)) {
    if (score >= level.min && score <= level.max) return level;
  }
  return RISK_LEVELS.LOW;
}

// 전체 위험요인 목록 (flat)
function getAllHazards() {
  const hazards = [];
  for (const [sceneName, scene] of Object.entries(SCENE_DATA)) {
    for (const hazard of scene.hazards) {
      hazards.push({ ...hazard, sceneName, sceneTitle: scene.title });
    }
  }
  return hazards;
}
