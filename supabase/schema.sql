-- VR 안전교육 위험성평가 DB 스키마
-- Supabase SQL Editor에서 실행

-- 기관 (멀티테넌트)
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_code TEXT UNIQUE NOT NULL,     -- 6자리 랜덤 코드 (URL 경로용)
  org_name TEXT NOT NULL,            -- 기관명
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_organizations_code ON organizations(org_code);

-- 교육 세션
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  session_name TEXT NOT NULL,
  instructor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_org ON sessions(org_id);

-- 위험성평가 결과
CREATE TABLE assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_org TEXT,
  scene_name TEXT NOT NULL,
  hazard_id TEXT NOT NULL,
  hazard_title TEXT,
  likelihood INT CHECK (likelihood BETWEEN 1 AND 5),
  severity INT CHECK (severity BETWEEN 1 AND 4),
  risk_score INT GENERATED ALWAYS AS (likelihood * severity) STORED,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_assessments_session ON assessments(session_id);
CREATE INDEX idx_assessments_scene ON assessments(scene_name);

-- RLS 정책 (anon 키로 읽기/쓰기 허용)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read organizations"
  ON organizations FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous read sessions"
  ON sessions FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert sessions"
  ON sessions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update sessions"
  ON sessions FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous read assessments"
  ON assessments FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert assessments"
  ON assessments FOR INSERT TO anon WITH CHECK (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE assessments;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- 기관 시딩 예시 (28개 기관)
-- INSERT INTO organizations (org_code, org_name) VALUES
--   ('a7x9k2', '기관 1'),
--   ('b3m8p1', '기관 2'),
--   ... 필요한 만큼 추가
-- ;
