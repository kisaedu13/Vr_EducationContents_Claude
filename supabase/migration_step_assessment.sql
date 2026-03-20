-- 위험성평가 단계별 프로세스 지원을 위한 컬럼 추가
-- Supabase SQL Editor에서 수동 실행

-- 허용 가능 여부
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS is_acceptable BOOLEAN;

-- 개선 후 빈도/강도
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS revised_frequency INT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS revised_intensity INT;

-- 개선 후 위험성 점수 (앱에서 계산하여 저장)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS revised_risk_score INT;
