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

    // 핫스팟 클릭 → 정보 팝업
    KrpanoInterface.onHotspotClick = (hazardId) => {
      RiskAssessment.showHazardInfoPopup(hazardId, this.currentScene);
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

  /** 현재 Scene의 교육생 평가 목록 팝업 */
  _showSceneResults() {
    if (!this.currentScene) return;
    const sceneAssessments = this.assessments
      .filter(a => a.scene_name === this.currentScene)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    RiskAssessment.showHazardResults(sceneAssessments, this.currentScene);
  },

  /** 교육생 평가 목록 오버레이 (시간 역순) */
  _updateOverlay(sceneName) {
    const overlay = document.getElementById('result-overlay-content');
    if (!sceneName || !overlay) return;

    const scene = SCENE_DATA[sceneName];
    if (!scene) return;

    const sceneAssessments = this.assessments
      .filter(a => a.scene_name === sceneName)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    const studentCount = new Set(sceneAssessments.map(a => a.student_name)).size;

    let html = `<div class="overlay-summary">
      <span>참여 교육생: <strong>${studentCount}명</strong></span>
      <span>총 평가: <strong>${sceneAssessments.length}건</strong></span>
    </div>`;

    if (sceneAssessments.length === 0) {
      html += '<div class="overlay-hazard-empty" style="padding:20px;text-align:center">아직 제출된 평가가 없습니다.</div>';
    } else {
      html += sceneAssessments.map(a => {
        const score = (a.frequency || 0) * (a.intensity || 0);
        const level = getRiskLevel(score);
        const desc = a.hazard_description || '-';

        // 허용 상태 영역
        let borderClass = '';
        let statusHtml = '';
        if (a.is_acceptable === true) {
          borderClass = 'overlay-card-acceptable';
          statusHtml = '<div class="ov-status ov-status-ok">&#10003; 허용 가능</div>';
        } else if (a.is_acceptable === false) {
          borderClass = 'overlay-card-unacceptable';
          statusHtml = '<div class="ov-status ov-status-no">&#10007; 허용 불가능</div>';
        }

        // 감소대책 + 개선 전후 비교
        let revisedHtml = '';
        if (a.is_acceptable === false && a.reduction_measures) {
          const rScore = (a.revised_frequency || 0) * (a.revised_intensity || 0);
          const rLevel = getRiskLevel(rScore);
          const improvement = score - rScore;
          revisedHtml = `<div class="ov-revised">
            <div class="ov-row-label">감소대책</div>
            <div class="ov-row-value">${a.reduction_measures}</div>
            <div class="ov-revised-score">
              <span>개선 후 빈도 ${a.revised_frequency || 0} × 강도 ${a.revised_intensity || 0} =</span>
              <span class="risk-badge" style="background:${rLevel.color}">${rScore}</span>
              ${improvement > 0 ? `<span class="ov-improved">-${improvement}</span>` : ''}
            </div>
          </div>`;
        }

        return `<div class="overlay-hazard-card ${borderClass}">
          <div class="ov-name">${a.student_name}</div>
          <div class="ov-section">
            <div class="ov-row-label">유해위험요인</div>
            <div class="ov-row-value">${desc}</div>
          </div>
          <div class="ov-section">
            <div class="ov-row-label">위험성</div>
            <div class="ov-risk-calc">
              <span>빈도 ${a.frequency || 0} × 강도 ${a.intensity || 0} =</span>
              <span class="risk-badge risk-badge-lg" style="background:${level.color}">${score}</span>
            </div>
          </div>
          ${statusHtml}
          ${revisedHtml}
        </div>`;
      }).join('');
    }

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
    const acceptText = assessment.is_acceptable === true ? '허용 가능'
      : assessment.is_acceptable === false ? '허용 불가능' : '';
    const statusText = acceptText ? ` (${acceptText})` : '';
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.textContent = `${assessment.student_name}님이 평가를 제출했습니다.${statusText}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => InstructorApp.init());
