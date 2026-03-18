/**
 * 기관 컨텍스트 모듈
 * URL 경로에서 기관 코드를 파싱하고 Supabase에서 기관 정보를 검증한다.
 * 경로 형식: /edu/{org_code}/student 또는 /edu/{org_code}/instructor
 */

const OrgContext = {
  /** @type {string|null} 기관 코드 (URL 경로에서 추출) */
  orgCode: null,
  /** @type {string|null} 기관 UUID (DB에서 조회) */
  orgId: null,
  /** @type {string|null} 기관명 */
  orgName: null,

  /**
   * URL 경로에서 기관 코드 추출
   * @returns {string|null} 기관 코드 또는 null
   */
  parseFromURL() {
    const match = window.location.pathname.match(/^\/edu\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  },

  /**
   * 기관 컨텍스트 초기화
   * URL에서 기관 코드를 추출하고 DB에서 검증한다.
   * @returns {Promise<boolean>} 유효한 기관이면 true
   */
  async init() {
    this.orgCode = this.parseFromURL();

    if (!this.orgCode) {
      this._showNoOrgError();
      return false;
    }

    // Supabase 미연결 시 로컬 모드
    if (!SupabaseClient.isConnected()) {
      this.orgId = this.orgCode;
      this.orgName = '로컬 테스트';
      return true;
    }

    try {
      const { data, error } = await SupabaseClient.client
        .from('organizations')
        .select('*')
        .eq('org_code', this.orgCode)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        this._showInvalidOrgError();
        return false;
      }

      this.orgId = data.id;
      this.orgName = data.org_name;
      return true;
    } catch (err) {
      console.error('기관 검증 실패:', err);
      this._showInvalidOrgError();
      return false;
    }
  },

  /**
   * 기관 링크 없이 접근 시 안내 화면 표시
   */
  _showNoOrgError() {
    this._showErrorScreen(
      '기관 전용 URL이 필요합니다',
      '이 서비스는 기관별 전용 URL을 통해 접근할 수 있습니다.<br>교육 담당자에게 전달받은 URL로 접속해주세요.',
      '예시: /edu/abc123/student'
    );
  },

  /**
   * 유효하지 않은 기관 코드 안내 화면 표시
   */
  _showInvalidOrgError() {
    this._showErrorScreen(
      '유효하지 않은 기관 코드',
      '입력하신 기관 코드를 찾을 수 없습니다.<br>URL을 다시 확인해주세요.',
      `요청한 코드: ${this.orgCode}`
    );
  },

  /**
   * 에러 화면 표시 (기존 콘텐츠 숨기고 에러 화면 노출)
   * @param {string} title - 에러 제목
   * @param {string} message - 에러 메시지 (HTML 허용)
   * @param {string} detail - 부가 정보
   */
  _showErrorScreen(title, message, detail) {
    // 기존 콘텐츠 모두 숨기기
    document.querySelectorAll('#entry-screen, #vr-screen, #complete-screen, #session-manager, #dashboard').forEach(el => {
      if (el) el.style.display = 'none';
    });

    // 에러 화면 표시
    const errorScreen = document.getElementById('org-error-screen');
    if (errorScreen) {
      errorScreen.style.display = 'flex';
      errorScreen.querySelector('.org-error-title').textContent = title;
      errorScreen.querySelector('.org-error-message').innerHTML = message;
      errorScreen.querySelector('.org-error-detail').textContent = detail;
    }
  },
};
