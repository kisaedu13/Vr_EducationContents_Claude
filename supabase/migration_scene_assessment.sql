-- 위험성평가 구조 변경: 핫스팟별 → Scene별 자유형 평가
-- Supabase SQL Editor에서 수동 실행 필요

-- 1. 새 컬럼 추가
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS hazard_description TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS reduction_measures TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS frequency INT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS intensity INT;

-- 2. 기존 데이터 마이그레이션 (likelihood→frequency, severity→intensity)
UPDATE assessments SET frequency = likelihood, intensity = severity WHERE frequency IS NULL;

-- 3. risk_score GENERATED 컬럼 재정의 (frequency × intensity)
ALTER TABLE assessments DROP COLUMN IF EXISTS risk_score;
ALTER TABLE assessments ADD COLUMN risk_score INT GENERATED ALWAYS AS (frequency * intensity) STORED;

-- 4. hazard_id NULL 허용 (Scene별 평가에는 특정 hazard_id 불필요)
ALTER TABLE assessments ALTER COLUMN hazard_id DROP NOT NULL;

-- 5. 기존 컬럼 제거
ALTER TABLE assessments DROP COLUMN IF EXISTS likelihood;
ALTER TABLE assessments DROP COLUMN IF EXISTS severity;
