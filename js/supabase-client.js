/**
 * Supabase 클라이언트 연동
 * CDN에서 로드한 supabase-js를 사용
 */

const SupabaseClient = {
  client: null,

  /** 초기화 */
  init(url, anonKey) {
    if (!url || !anonKey) {
      console.warn('Supabase 설정이 없습니다. 로컬 모드로 동작합니다.');
      return false;
    }
    this.client = supabase.createClient(url, anonKey);
    return true;
  },

  /** Supabase 연결 여부 */
  isConnected() {
    return this.client !== null;
  },

  // === 세션 관리 ===

  /** 새 교육 세션 생성 */
  async createSession(sessionName, instructorName) {
    if (!this.client) return this._localCreate('sessions', { session_name: sessionName, instructor_name: instructorName, org_id: OrgContext.orgId });

    const { data, error } = await this.client
      .from('sessions')
      .insert({ session_name: sessionName, instructor_name: instructorName, org_id: OrgContext.orgId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** 활성 세션 목록 조회 (기관별 필터링) */
  async getActiveSessions() {
    if (!this.client) return this._localGet('sessions').filter(s => s.is_active && s.org_id === OrgContext.orgId);

    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .eq('org_id', OrgContext.orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /** 세션 비활성화 */
  async deactivateSession(sessionId) {
    if (!this.client) return;

    const { error } = await this.client
      .from('sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (error) throw error;
  },

  // === 위험성평가 ===

  /** 평가 결과 저장 */
  async submitAssessment(data) {
    if (!this.client) return this._localCreate('assessments', data);

    const { data: result, error } = await this.client
      .from('assessments')
      .insert({
        session_id: data.sessionId,
        student_name: data.studentName,
        student_org: data.studentOrg,
        scene_name: data.sceneName,
        hazard_id: data.hazardId,
        hazard_title: data.hazardTitle,
        likelihood: data.likelihood,
        severity: data.severity,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  /** 세션별 평가 결과 조회 */
  async getAssessments(sessionId) {
    if (!this.client) return this._localGet('assessments').filter(a => a.session_id === sessionId);

    const { data, error } = await this.client
      .from('assessments')
      .select('*')
      .eq('session_id', sessionId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /** 세션별 통계 */
  async getSessionStats(sessionId) {
    const assessments = await this.getAssessments(sessionId);

    const students = [...new Set(assessments.map(a => a.student_name))];
    const byHazard = {};

    assessments.forEach(a => {
      if (!byHazard[a.hazard_id]) {
        byHazard[a.hazard_id] = {
          hazardId: a.hazard_id,
          hazardTitle: a.hazard_title,
          sceneName: a.scene_name,
          assessments: [],
        };
      }
      byHazard[a.hazard_id].assessments.push(a);
    });

    // 위험요인별 평균 계산
    Object.values(byHazard).forEach(h => {
      const scores = h.assessments.map(a => a.likelihood * a.severity);
      h.avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      h.avgLikelihood = h.assessments.reduce((sum, a) => sum + a.likelihood, 0) / h.assessments.length;
      h.avgSeverity = h.assessments.reduce((sum, a) => sum + a.severity, 0) / h.assessments.length;
      h.count = h.assessments.length;
    });

    return {
      totalAssessments: assessments.length,
      studentCount: students.length,
      students,
      byHazard: Object.values(byHazard),
      raw: assessments,
    };
  },

  /** 실시간 구독 (강사 대시보드용) */
  subscribeAssessments(sessionId, callback) {
    if (!this.client) return null;

    return this.client
      .channel(`assessments-${sessionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'assessments', filter: `session_id=eq.${sessionId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
  },

  /** 구독 해제 */
  unsubscribe(subscription) {
    if (subscription && this.client) {
      this.client.removeChannel(subscription);
    }
  },

  // === 로컬 폴백 (Supabase 미연결 시 localStorage 사용) ===

  /**
   * localStorage 키에 기관 코드 접두사 추가
   * @param {string} table - 테이블명
   * @returns {string} 기관별 격리된 키
   */
  _localKey(table) {
    return OrgContext.orgCode ? `${table}_${OrgContext.orgCode}` : table;
  },

  _localCreate(table, data) {
    const key = this._localKey(table);
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    const item = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      is_active: true,
    };
    if (table === 'assessments') {
      item.risk_score = (data.likelihood || 0) * (data.severity || 0);
    }
    items.push(item);
    localStorage.setItem(key, JSON.stringify(items));
    return item;
  },

  _localGet(table) {
    const key = this._localKey(table);
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
};
