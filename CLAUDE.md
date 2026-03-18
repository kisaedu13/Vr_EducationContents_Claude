# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
VR 안전교육 위험성평가 웹앱 — 교육생이 360° VR 파노라마에서 위험요소를 찾아 평가하고, 강사가 실시간 대시보드로 모니터링한다.

## Tech Stack
- Language: JavaScript (ES6, vanilla — 프레임워크 없음)
- VR Engine: krpano (360° 파노라마 뷰어)
- Database: Supabase (PostgreSQL + Realtime)
- Hosting: Vercel (정적 사이트)
- UI: HTML5 + CSS3 (순수 CSS, 프레임워크 없음)

## Project Structure
```
VR_Educaiton_Web/
├── index.html             # 랜딩 페이지 (/edu/{code} → 역할 선택)
├── student.html           # 교육생 페이지 (/edu/{code}/student)
├── instructor.html        # 강사 페이지 (/edu/{code}/instructor)
├── assets/                # 이미지/아이콘 리소스
├── css/
│   └── style.css          # 공통 스타일
├── js/
│   ├── config.js          # Supabase 설정, SCENE_DATA (위험요소 좌표/정의)
│   ├── org-context.js     # 기관 컨텍스트 (URL 파싱 + DB 검증)
│   ├── supabase-client.js # Supabase CRUD + localStorage 폴백
│   ├── krpano-interface.js# krpano API 래퍼 (핫스팟, 씬 전환)
│   ├── risk-assessment.js # 5×4 리스크 매트릭스 폼 UI
│   ├── student-app.js     # 교육생 워크플로우 오케스트레이션
│   └── instructor-app.js  # 강사 대시보드 + Realtime 구독
├── supabase/
│   ├── schema.sql         # DB 스키마 (organizations, sessions, assessments)
│   └── migration_add_organizations.sql  # 기존 DB 마이그레이션
├── vtour/                 # krpano 가상투어
│   ├── tour.html/js/xml   # 뷰어 엔진 + 씬 설정
│   ├── panos/             # 360° 큐브맵 타일 (자동생성, 수동편집 불필요)
│   ├── plugins/           # krpano 플러그인 (WebVR, 자이로 등)
│   └── skin/              # UI 스킨
├── package.json
├── vercel.json            # URL 리라이트 + 캐시 설정
└── .env.example           # SUPABASE_URL, SUPABASE_ANON_KEY
```

## Commands
- `npm install` — 의존성 설치
- `npm run dev` — 개발 서버 실행 (http://localhost:3000)
- `npm run start` — 동일 (serve로 정적 파일 서빙)

빌드 스텝 없음. vanilla JS를 정적 파일로 직접 서빙한다.

## Architecture

### Multi-Tenant URL 구조
각 기관에 고유 토큰(org_code)이 부여되고, URL 경로에 포함:
- `/edu/{org_code}` — 랜딩 페이지 (역할 선택)
- `/edu/{org_code}/student` — 교육생 페이지
- `/edu/{org_code}/instructor` — 강사 대시보드

### Three Entry Points
- **`index.html`** (`/edu/{code}`) — 기관 검증 + 역할 선택 (교육생/강사)
- **`student.html`** (`/edu/{code}/student`) — 세션 참가 → krpano VR 뷰어에서 핫스팟 클릭 → 5×4 위험성 평가 (가능성 1-5 × 심각도 1-4) → Supabase에 제출
- **`instructor.html`** (`/edu/{code}/instructor`) — 세션 생성/관리 → 실시간 대시보드 (학생 진행도, 위험도 통계, 리스크 매트릭스 히트맵)

### Data Flow
```
교육생 핫스팟 클릭 → RiskAssessment 폼 → SupabaseClient.submitAssessment()
    → assessments 테이블 INSERT
    → Supabase Realtime → 강사 대시보드 자동 갱신
```

### krpano Integration
- `vtour/tour.xml` — 2개 씬 (`scene_pico_1`, `scene_pico_3`), 큐브맵 멀티레졸루션 타일
- 핫스팟 위치는 `js/config.js`의 `SCENE_DATA`에서 `ath`(수평각)/`atv`(수직각)로 정의
- `KrpanoInterface`가 krpano API(`call()`, `get()`, `set()`)를 JS에서 추상화

### Supabase Schema (supabase/schema.sql)
- **`organizations`** — id, org_code(UNIQUE), org_name, is_active (읽기 전용, RLS SELECT만 허용)
- **`sessions`** — id, org_id(FK→organizations), session_name, instructor_name, is_active
- **`assessments`** — session_id(FK), student_name, scene_name, hazard_id, likelihood(1-5), severity(1-4), risk_score(generated: L×S)
- RLS: anon 사용자 전체 허용. sessions, assessments Realtime 활성화
- 기관 격리: sessions.org_id로 필터링, assessments는 session_id FK로 간접 격리

### Vercel Config
- URL 리라이트: `/edu/:code/student` → `student.html`, `/edu/:code/instructor` → `instructor.html`, `/edu/:code` → `index.html`
- 레거시 경로: `/student`, `/instructor` 유지 (기관 코드 없이 접근 시 안내 메시지 표시)
- `vtour/**` 정적 에셋: 1년 캐시 (immutable)

## Code Style Rules
- 커밋 메시지는 한글로 작성
- 모든 함수에 JSDoc 주석 추가
- ES6 클래스 패턴 사용 (static 메서드 기반 모듈)
- Supabase CDN import (`supabase-js@2`) — npm 번들링 없음

## Important Notes
- 위험요소 추가 시: `js/config.js`의 `SCENE_DATA`에 항목 추가 + krpano에서 해당 위치의 `ath`/`atv` 값 확인 필요
- `vtour/panos/` 타일 이미지는 krpano 도구가 자동 생성한 것이므로 수동 편집하지 않는다
- Supabase 미연결 시 localStorage 폴백으로 오프라인 동작 가능 (기관별 키 격리)
- 환경변수(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)는 Vercel 대시보드에서 설정
- 한국어 UI — 모든 라벨, 메시지, 카테고리가 한국어
- 기관 추가: `organizations` 테이블에 INSERT 1행 (org_code는 6자리 랜덤 영숫자)
- 기관별 URL: `/edu/{org_code}/student`, `/edu/{org_code}/instructor`
