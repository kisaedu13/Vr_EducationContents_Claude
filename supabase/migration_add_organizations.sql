-- 기존 DB에 기관(멀티테넌트) 기능 추가 마이그레이션
-- 기존 sessions/assessments 테이블이 있는 상태에서 실행

-- 1. organizations 테이블 생성
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_code TEXT UNIQUE NOT NULL,
  org_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(org_code);

-- 2. sessions 테이블에 org_id 컬럼 추가
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(org_id);

-- 3. organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read organizations"
  ON organizations FOR SELECT TO anon USING (true);

-- 4. 기관 시딩 (필요에 맞게 수정)
-- INSERT INTO organizations (org_code, org_name) VALUES
--   ('a7x9k2', '기관 1'),
--   ('b3m8p1', '기관 2');
