/**
 * 강사 VR Scene + 결과 오버레이 애플리케이션
 */

const InstructorApp = {
  currentSessionId: null,
  subscription: null,
  assessments: [],
  currentScene: null,
  overlayVisible: true,

  /** 앱 초기화 */
  async init() {
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
      this.currentSessionId = session.id;
      this._showVRView();
    } catch (err) {
      console.error('세션 로드 실패:', err);
      this._showNoSession();
    }
  },

  /** 세션 없음 화면 표시 */
  _showNoSession() {
    document.getElementById('no-session-screen').style.display = 'flex';
    document.getElementById('instructor-vr-screen').style.display = 'none';
  },

  /** VR 뷰어 + 결과 오버레이 표시 */
  _showVRView() {
    document.getElementById('no-session-screen').style.display = 'none';
    document.getElementById('instructor-vr-screen').style.display = 'block';

    // krpano 초기화
    KrpanoInterface.init('krpano-viewer', '/vtour/tour.xml', () => {
      const firstScene = Object.keys(SCENE_DATA)[0];
      KrpanoInterface.loadScene(firstScene);
    });

    // 핫스팟 클릭 → 결과 팝업
    KrpanoInterface.onHotspotClick = (hazardId) => {
      this._showHazardResults(hazardId);
    };

    // 씬 변경 → 오버레이 갱신
    KrpanoInterface.onSceneChange = (sceneName) => {
      this.currentScene = sceneName;
      this._updateSceneUI(sceneName);
      this._updateOverlay(sceneName);
    };

    // 씬 이동 버튼
    this._renderSceneButtons();

    // 데이터 로드
    this._refreshData();

    // 실시간 구독
    this.subscription = SupabaseClient.subscribeAssessments(this.currentSessionId, (newAssessment) => {
      this.assessments.push(newAssessment);
      this._updateOverlay(this.currentScene);
      this._showNewSubmitToast(newAssessment);
    });
  },

  /** 씬 이동 버튼 렌더링 */
  _renderSceneButtons() {
    const container = document.getElementById('scene-buttons');
    container.innerHTML = Object.entries(SCENE_DATA).map(([name, scene]) =>
      `<button class="btn btn-scene" data-scene="${name}" onclick="InstructorApp.changeScene('${name}')">${scene.title}</button>`
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
  },

  /** 핫스팟 클릭 시 해당 위험요인의 교육생별 평가 결과 팝업 */
  _showHazardResults(hazardId) {
    const sceneAssessments = this.assessments.filter(a => a.hazard_id === hazardId);
    RiskAssessment.showHazardResults(hazardId, this.currentScene, sceneAssessments);
  },

  /** 현재 Scene의 위험요인별 요약 오버레이 갱신 */
  _updateOverlay(sceneName) {
    const overlay = document.getElementById('result-overlay-content');
    if (!sceneName || !overlay) return;

    const scene = SCENE_DATA[sceneName];
    if (!scene) return;

    const sceneAssessments = this.assessments.filter(a => a.scene_name === sceneName);
    const studentCount = new Set(sceneAssessments.map(a => a.student_name)).size;

    let html = `<div class="overlay-summary">
      <span>참여 교육생: <strong>${studentCount}명</strong></span>
      <span>총 평가: <strong>${sceneAssessments.length}건</strong></span>
    </div>`;

    html += scene.hazards.map(hazard => {
      const ha = sceneAssessments.filter(a => a.hazard_id === hazard.id);
      const count = ha.length;

      if (count === 0) {
        return `<div class="overlay-hazard-card" onclick="InstructorApp._showHazardResults('${hazard.id}')">
          <div class="overlay-hazard-title">${hazard.title}</div>
          <div class="overlay-hazard-meta">${hazard.category}</div>
          <div class="overlay-hazard-empty">평가 없음</div>
        </div>`;
      }

      const avgScore = (ha.reduce((s, a) => s + (a.likelihood * a.severity), 0) / count).toFixed(1);
      const level = getRiskLevel(Math.round(parseFloat(avgScore)));

      return `<div class="overlay-hazard-card" onclick="InstructorApp._showHazardResults('${hazard.id}')">
        <div class="overlay-hazard-title">${hazard.title}</div>
        <div class="overlay-hazard-meta">${hazard.category}</div>
        <div class="overlay-hazard-stats">
          <span class="overlay-stat">${count}명 참여</span>
          <span class="risk-badge" style="background:${level.color}">${avgScore}</span>
        </div>
      </div>`;
    }).join('');

    overlay.innerHTML = html;
  },

  /** 전체 데이터 새로고침 */
  async _refreshData() {
    try {
      const stats = await SupabaseClient.getSessionStats(this.currentSessionId);
      this.assessments = stats.raw;
      this._updateOverlay(this.currentScene);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  },

  /** 결과 패널 접기/펼치기 */
  toggleOverlay() {
    const panel = document.getElementById('result-overlay');
    this.overlayVisible = !this.overlayVisible;
    panel.classList.toggle('collapsed', !this.overlayVisible);
  },

  /** 새 제출 토스트 */
  _showNewSubmitToast(assessment) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.textContent = `${assessment.student_name}님이 "${assessment.hazard_title}" 평가를 제출했습니다.`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => InstructorApp.init());
