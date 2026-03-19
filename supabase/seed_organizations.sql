-- 28개 기관 시딩 + 각 기관별 활성 세션 1개 자동 생성
-- Supabase SQL Editor에서 실행

-- 1. 기관 등록
INSERT INTO organizations (org_code, org_name) VALUES
  ('sel001', '서울지역본부'),
  ('sel002', '서울동부지회'),
  ('bus001', '부산지역본부'),
  ('uls001', '울산지회'),
  ('chw001', '창원지회'),
  ('gne001', '경남동부지회'),
  ('gnw001', '경남서부지회'),
  ('dae001', '대구지역본부'),
  ('dae002', '대구서부지회'),
  ('gbn001', '경북북부지회'),
  ('poh001', '포항지회'),
  ('jun001', '중부지역본부'),
  ('gnw002', '강원지회'),
  ('gyg001', '경기지역본부'),
  ('ans001', '안산지회'),
  ('gyw001', '경기서부지회'),
  ('gys001', '경기남부지회'),
  ('snm001', '성남지회'),
  ('gyn001', '경기북부지회'),
  ('gwj001', '광주지역본부'),
  ('jnb001', '전북지회'),
  ('jnm001', '전남지회'),
  ('jej001', '제주지회'),
  ('daj001', '대전지역본부'),
  ('chb001', '충북지회'),
  ('chb002', '충북북부지회'),
  ('chn001', '충남북부지회'),
  ('chn002', '충남서부지회')
ON CONFLICT (org_code) DO NOTHING;

-- 2. 각 기관에 활성 세션 1개씩 생성 (이미 있는 경우 건너뜀)
INSERT INTO sessions (org_id, session_name, instructor_name, is_active)
SELECT
  o.id,
  o.org_name || ' 안전교육 세션',
  '',
  TRUE
FROM organizations o
WHERE o.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.org_id = o.id AND s.is_active = TRUE
  );
