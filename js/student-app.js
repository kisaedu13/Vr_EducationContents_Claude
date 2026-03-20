/**
 * 교육생 메인 애플리케이션
 */

const StudentApp = {
  sessionId: null,
  studentName: '',
  currentScene: null,
  completedAssessments: {},  // { hazardId: { likelihood, severity, riskScore, sceneName, hazardTitle } }

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

    // 세션 자동 매칭
    try {
      const session = await SupabaseClient.getActiveSession();
      this.sessionId = session.id;
    } catch (err) {
      console.error('세션 로드 실패:', err);
      this._showSessionError();
      return;
    }

    // 항상 이름 입력 폼 표시 (매 접속 시 이름 입력 필수)
    this._showEntryForm();
  },

  /** 세션 없음 에러 표시 */
  _showSessionError() {
    document.getElementById('entry-screen').style.display = 'none';
    document.getElementById('vr-screen').style.display = 'none';
    document.getElementById('complete-screen').style.display = 'none';

    const errorScreen = document.getElementById('org-error-screen');
    if (errorScreen) {
      errorScreen.style.display = 'flex';
      errorScreen.querySelector('.org-error-title').textContent = '활성 세션 없음';
      errorScreen.querySelector('.org-error-message').innerHTML = '현재 활성화된 교육 세션이 없습니다.<br>교육 담당자에게 문의해주세요.';
      errorScreen.querySelector('.org-error-detail').textContent = '';
    }
  },

  /** 진입 화면 표시 */
  _showEntryForm() {
    document.getElementById('entry-screen').style.display = 'flex';
    document.getElementById('vr-screen').style.display = 'none';
    document.getElementById('complete-screen').style.display = 'none';

    // 오늘 날짜 표시
    const dateInput = document.getElementById('input-date');
    if (dateInput) {
      const now = new Date();
      dateInput.value = `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일`;
    }

    document.getElementById('entry-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();

      if (!name) return;

      this.studentName = name;

      const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
      localStorage.setItem(`${prefix}studentName`, name);
      localStorage.setItem(`${prefix}currentSessionId`, this.sessionId);

      this._showVRView();
    });
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
        studentOrg: '',
        sceneName: result.sceneName,
        hazardId: result.hazardId,
        hazardTitle: result.hazardTitle,
        likelihood: result.likelihood,
        severity: result.severity,
      });

      this.completedAssessments[result.hazardId] = {
        likelihood: result.likelihood,
        severity: result.severity,
        riskScore: result.likelihood * result.severity,
        sceneName: result.sceneName,
        hazardTitle: result.hazardTitle,
      };
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
    this._renderCompleteResults();
  },

  /** Scene별 완료 결과 렌더링 */
  _renderCompleteResults() {
    const container = document.getElementById('complete-results');
    if (!container) return;

    // Scene별 그룹핑
    const byScene = {};
    for (const [hazardId, data] of Object.entries(this.completedAssessments)) {
      const scene = data.sceneName;
      if (!byScene[scene]) byScene[scene] = [];
      byScene[scene].push({ hazardId, ...data });
    }

    let html = '';
    for (const [sceneName, hazards] of Object.entries(byScene)) {
      const sceneInfo = SCENE_DATA[sceneName];
      const sceneTitle = sceneInfo ? sceneInfo.title : sceneName;

      html += `<div class="scene-result-group">
        <h3>${sceneTitle}</h3>
        <div class="scene-result-cards">`;

      for (const h of hazards) {
        const level = getRiskLevel(h.riskScore);
        html += `<div class="scene-result-card">
          <div class="scene-result-title">${h.hazardTitle}</div>
          <div class="scene-result-values">
            <span>가능성 ${h.likelihood}</span>
            <span>×</span>
            <span>중대성 ${h.severity}</span>
            <span>=</span>
            <span class="risk-badge" style="background:${level.color}">${h.riskScore} ${level.label}</span>
          </div>
        </div>`;
      }

      html += `</div></div>`;
    }

    container.innerHTML = html;
  },

  /** 초기화 (다시 시작) */
  reset() {
    this.completedAssessments = {};
    const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
    localStorage.removeItem(`${prefix}studentName`);
    localStorage.removeItem(`${prefix}currentSessionId`);
    location.reload();
  },
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => StudentApp.init());
