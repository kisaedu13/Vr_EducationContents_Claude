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

  /** 기관의 활성 세션 1개 자동 반환 */
  async getActiveSession() {
    if (!this.client) {
      const sessions = this._localGet('sessions').filter(s => s.is_active && s.org_id === OrgContext.orgId);
      if (sessions.length > 0) return sessions[0];
      return this._localCreate('sessions', {
        session_name: '기본 교육 세션',
        instructor_name: '',
        org_id: OrgContext.orgId,
      });
    }

    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .eq('org_id', OrgContext.orgId)
      .order('created_at', { ascending: false })
      .limit(1)
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

    const row = {
      session_id: data.sessionId,
      student_name: data.studentName,
      student_org: data.studentOrg || '',
      scene_name: data.sceneName,
      hazard_description: data.hazardDescription,
      frequency: data.frequency,
      intensity: data.intensity,
      is_acceptable: data.isAcceptable ?? null,
      reduction_measures: data.reductionMeasures ?? null,
      revised_frequency: data.revisedFrequency ?? null,
      revised_intensity: data.revisedIntensity ?? null,
    };

    let result, error;
    ({ data: result, error } = await this.client
      .from('assessments')
      .insert(row)
      .select());

    // 컬럼 미존재 시 단계별 폴백
    if (error) {
      console.warn('평가 저장 실패, 단계별 컬럼으로 재시도:', error.message);
      const { revised_frequency, revised_intensity, ...step2Row } = row;
      ({ data: result, error } = await this.client
        .from('assessments')
        .insert(step2Row)
        .select());
    }
    if (error) {
      console.warn('2차 재시도, 기본 컬럼만:', error.message);
      const { is_acceptable, reduction_measures, revised_frequency, revised_intensity, ...baseRow } = row;
      ({ data: result, error } = await this.client
        .from('assessments')
        .insert(baseRow)
        .select());
    }

    if (error) throw error;
    return result?.[0];
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
    const byScene = {};

    assessments.forEach(a => {
      if (!byScene[a.scene_name]) {
        byScene[a.scene_name] = {
          sceneName: a.scene_name,
          assessments: [],
        };
      }
      byScene[a.scene_name].assessments.push(a);
    });

    // Scene별 평균 계산
    Object.values(byScene).forEach(s => {
      const scores = s.assessments.map(a => (a.frequency || 0) * (a.intensity || 0));
      s.avgScore = scores.reduce((sum, v) => sum + v, 0) / scores.length;
      s.count = s.assessments.length;
    });

    return {
      totalAssessments: assessments.length,
      studentCount: students.length,
      students,
      byScene: Object.values(byScene),
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
      item.risk_score = (data.frequency || 0) * (data.intensity || 0);
      item.is_acceptable = data.is_acceptable ?? data.isAcceptable ?? null;
      item.reduction_measures = data.reduction_measures ?? data.reductionMeasures ?? null;
      item.revised_frequency = data.revised_frequency ?? data.revisedFrequency ?? null;
      item.revised_intensity = data.revised_intensity ?? data.revisedIntensity ?? null;
      item.revised_risk_score = (item.revised_frequency && item.revised_intensity)
        ? item.revised_frequency * item.revised_intensity : null;
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
