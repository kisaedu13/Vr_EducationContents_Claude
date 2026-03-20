/**
 * 교육생 메인 애플리케이션
 */

const StudentApp = {
  sessionId: null,
  studentName: '',
  currentScene: null,
  myAssessments: [],  // [{ sceneName, hazardDescription, frequency, intensity, riskScore, isAcceptable, reductionMeasures, revisedFrequency, revisedIntensity, revisedRiskScore }]

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

    // 학생 이름 표시
    document.getElementById('student-name-display').textContent = this.studentName;

    // krpano 초기화
    KrpanoInterface.init('krpano-viewer', '/vtour/tour.xml', () => {
      const firstScene = Object.keys(SCENE_DATA)[0];
      KrpanoInterface.loadScene(firstScene);
    });

    // 핫스팟 클릭 → 정보 팝업만 표시
    KrpanoInterface.onHotspotClick = (hazardId) => {
      RiskAssessment.showHazardInfoPopup(hazardId, KrpanoInterface.currentScene);
    };

    // 씬 변경 핸들러
    KrpanoInterface.onSceneChange = (sceneName) => {
      this.currentScene = sceneName;
      this._updateSceneUI(sceneName);
    };

    // 씬 이동 버튼
    this._renderSceneButtons();
    this._updateAssessmentCount();
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
  },

  /** "위험성평가" 버튼 클릭 핸들러 */
  openAssessmentForm() {
    if (!this.currentScene) return;
    RiskAssessment.showSceneAssessmentForm(
      this.currentScene,
      (result) => this._handleSubmit(result)
    );
  },

  /** "내 평가" 목록 표시 */
  showMyAssessments() {
    RiskAssessment.showMyAssessments(this.myAssessments);
  },

  /** 평가 제출 처리 */
  async _handleSubmit(result) {
    try {
      await SupabaseClient.submitAssessment({
        sessionId: this.sessionId,
        studentName: this.studentName,
        studentOrg: '',
        sceneName: result.sceneName,
        hazardDescription: result.hazardDescription,
        frequency: result.frequency,
        intensity: result.intensity,
        reductionMeasures: result.reductionMeasures,
        isAcceptable: result.isAcceptable,
        revisedFrequency: result.revisedFrequency,
        revisedIntensity: result.revisedIntensity,
      });

      this.myAssessments.unshift(result);
      RiskAssessment.showSubmitSuccess();
      this._updateAssessmentCount();
    } catch (err) {
      console.error('제출 실패:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      alert(`제출에 실패했습니다.\n${msg}`);
    }
  },

  /** 제출 건수 카운터 업데이트 */
  _updateAssessmentCount() {
    const countEl = document.getElementById('my-assessment-count');
    if (countEl) countEl.textContent = this.myAssessments.length;
  },

  /** 나가기 (초기화) */
  reset() {
    this.myAssessments = [];
    const prefix = OrgContext.orgCode ? `${OrgContext.orgCode}_` : '';
    localStorage.removeItem(`${prefix}studentName`);
    localStorage.removeItem(`${prefix}currentSessionId`);
    location.reload();
  },
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => StudentApp.init());
