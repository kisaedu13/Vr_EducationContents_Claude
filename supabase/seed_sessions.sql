-- 28개 기관에 각 1개 고정 세션 시딩
-- organizations 테이블에 이미 기관이 등록되어 있어야 함
-- 각 기관의 활성 세션이 1개씩 생성됨

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
