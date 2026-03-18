/**
 * 교육생 메인 애플리케이션
 */

const StudentApp = {
  sessionId: null,
  studentName: '',
  studentOrg: '',
  currentScene: null,
  completedAssessments: {},  // { hazardId: true }

  /** 앱 초기화 */
  async init() {
    // Supabase 초기화
    SupabaseClient.init(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);

    // 기관 컨텍스트 검증
    const orgValid = await OrgContext.init();
    if (!orgValid) return;

    // 기관명 UI 표시
    const orgDisplay = document.getElementById('org-name-display');
    if (orgDisplay) orgDisplay.textContent = OrgContext.orgName;

    // 저장된 학생 정보 복원 (기관별 격리)
    const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
    this.studentName = localStorage.getItem(`${prefix}studentName`) || '';
    this.studentOrg = localStorage.getItem(`${prefix}studentOrg`) || '';
    this.sessionId = localStorage.getItem(`${prefix}currentSessionId`) || null;

    if (this.studentName && this.sessionId) {
      this._showVRView();
    } else {
      this._showEntryForm();
    }
  },

  /** 진입 화면 표시 */
  _showEntryForm() {
    document.getElementById('entry-screen').style.display = 'flex';
    document.getElementById('vr-screen').style.display = 'none';
    document.getElementById('complete-screen').style.display = 'none';

    // 세션 목록 로드
    this._loadSessions();

    document.getElementById('entry-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();
      const org = document.getElementById('input-org').value.trim();
      const sessionId = document.getElementById('input-session').value;

      if (!name || !sessionId) return;

      this.studentName = name;
      this.studentOrg = org;
      this.sessionId = sessionId;

      const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
      localStorage.setItem(`${prefix}studentName`, name);
      localStorage.setItem(`${prefix}studentOrg`, org);
      localStorage.setItem(`${prefix}currentSessionId`, sessionId);

      this._showVRView();
    });
  },

  /** 세션 목록 불러오기 */
  async _loadSessions() {
    const select = document.getElementById('input-session');
    try {
      let sessions = await SupabaseClient.getActiveSessions();
      // 로컬 모드에서 세션이 없으면 자동 생성
      if (sessions.length === 0 && !SupabaseClient.isConnected()) {
        const localSession = SupabaseClient._localCreate('sessions', {
          session_name: '로컬 테스트 세션',
          instructor_name: '테스트',
          org_id: OrgContext.orgId,
        });
        sessions = [localSession];
      }
      if (sessions.length === 0) {
        select.innerHTML = '<option value="">활성 세션이 없습니다</option>';
        return;
      }
      select.innerHTML = '<option value="">세션을 선택하세요</option>' +
        sessions.map(s => `<option value="${s.id}">${s.session_name}${s.instructor_name ? ` (${s.instructor_name})` : ''}</option>`).join('');
    } catch (err) {
      console.error('세션 로드 실패:', err);
      // 로컬 모드: 자동 세션 생성
      const localSession = SupabaseClient._localCreate('sessions', {
        session_name: '로컬 테스트 세션',
        instructor_name: '테스트',
      });
      select.innerHTML = `<option value="${localSession.id}">${localSession.session_name}</option>`;
    }
  },

  /** VR 뷰 표시 */
  _showVRView() {
    document.getElementById('entry-screen').style.display = 'none';
    document.getElementById('vr-screen').style.display = 'block';
    document.getElementById('complete-screen').style.display = 'none';

    // 학생 이름 표시
    document.getElementById('student-name-display').textContent = this.studentName;

    // krpano 초기화
    KrpanoInterface.init('krpano-viewer', '/vtour/tour.xml', () => {
      const firstScene = Object.keys(SCENE_DATA)[0];
      KrpanoInterface.loadScene(firstScene);
    });

    // 핫스팟 클릭 핸들러
    KrpanoInterface.onHotspotClick = (hazardId) => {
      if (this.completedAssessments[hazardId]) {
        this._showAlreadyCompleted(hazardId);
        return;
      }
      RiskAssessment.showAssessmentForm(
        hazardId,
        KrpanoInterface.currentScene,
        (result) => this._handleSubmit(result)
      );
    };

    // 씬 변경 핸들러
    KrpanoInterface.onSceneChange = (sceneName) => {
      this.currentScene = sceneName;
      this._updateSceneUI(sceneName);
    };

    // 씬 이동 버튼
    this._renderSceneButtons();
    this._updateProgress();
  },

  /** 씬 이동 버튼 렌더링 */
  _renderSceneButtons() {
    const container = document.getElementById('scene-buttons');
    container.innerHTML = Object.entries(SCENE_DATA).map(([name, scene]) =>
      `<button class="btn btn-scene" data-scene="${name}" onclick="StudentApp.changeScene('${name}')">${scene.title}</button>`
    ).join('');
  },

  /** 씬 변경 */
  changeScene(sceneName) {
    KrpanoInterface.loadScene(sceneName);
  },

  /** 씬 UI 업데이트 */
  _updateSceneUI(sceneName) {
    document.querySelectorAll('.btn-scene').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scene === sceneName);
    });
    const scene = SCENE_DATA[sceneName];
    if (scene) {
      document.getElementById('scene-title').textContent = scene.title;
    }
    this._updateProgress();
  },

  /** 평가 제출 처리 */
  async _handleSubmit(result) {
    try {
      await SupabaseClient.submitAssessment({
        sessionId: this.sessionId,
        studentName: this.studentName,
        studentOrg: this.studentOrg,
        sceneName: result.sceneName,
        hazardId: result.hazardId,
        hazardTitle: result.hazardTitle,
        likelihood: result.likelihood,
        severity: result.severity,
      });

      this.completedAssessments[result.hazardId] = true;
      KrpanoInterface.markHotspotCompleted(result.hazardId);
      RiskAssessment.showSubmitSuccess();
      this._updateProgress();

      // 전체 완료 확인
      const totalHazards = getAllHazards().length;
      const completed = Object.keys(this.completedAssessments).length;
      if (completed >= totalHazards) {
        setTimeout(() => this._showCompleteScreen(), 1500);
      }
    } catch (err) {
      console.error('제출 실패:', err);
      alert('제출에 실패했습니다. 다시 시도해주세요.');
    }
  },

  /** 이미 완료된 위험요인 알림 */
  _showAlreadyCompleted(hazardId) {
    const hazard = getAllHazards().find(h => h.id === hazardId);
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.textContent = `"${hazard?.title}" - 이미 평가 완료`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  },

  /** 진행률 업데이트 */
  _updateProgress() {
    const totalHazards = getAllHazards().length;
    const completed = Object.keys(this.completedAssessments).length;
    const pct = totalHazards > 0 ? Math.round((completed / totalHazards) * 100) : 0;

    document.getElementById('progress-text').textContent = `${completed}/${totalHazards}`;
    document.getElementById('progress-bar-fill').style.width = `${pct}%`;
  },

  /** 완료 화면 표시 */
  _showCompleteScreen() {
    document.getElementById('vr-screen').style.display = 'none';
    document.getElementById('complete-screen').style.display = 'flex';
    document.getElementById('complete-name').textContent = this.studentName;
    document.getElementById('complete-count').textContent = Object.keys(this.completedAssessments).length;
  },

  /** 초기화 (다시 시작) */
  reset() {
    this.completedAssessments = {};
    const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
    localStorage.removeItem(`${prefix}studentName`);
    localStorage.removeItem(`${prefix}studentOrg`);
    localStorage.removeItem(`${prefix}currentSessionId`);
    location.reload();
  },
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => StudentApp.init());
