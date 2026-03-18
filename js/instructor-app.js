/**
 * 강사 대시보드 애플리케이션
 */

const InstructorApp = {
  currentSessionId: null,
  subscription: null,
  assessments: [],

  /** 앱 초기화 */
  async init() {
    SupabaseClient.init(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);

    // 기관 컨텍스트 검증
    const orgValid = await OrgContext.init();
    if (!orgValid) return;

    // 기관명 UI 표시
    const orgDisplay = document.getElementById('org-name-display');
    if (orgDisplay) orgDisplay.textContent = OrgContext.orgName;

    this._showSessionManager();
    this._loadSessions();
  },

  // === 세션 관리 ===

  /** 세션 목록 로드 */
  async _loadSessions() {
    const list = document.getElementById('session-list');
    try {
      const sessions = await SupabaseClient.getActiveSessions();
      if (sessions.length === 0) {
        list.innerHTML = '<p class="empty-msg">활성 세션이 없습니다. 새 세션을 생성하세요.</p>';
        return;
      }
      list.innerHTML = sessions.map(s => `
        <div class="session-card" onclick="InstructorApp.selectSession('${s.id}', '${s.session_name.replace(/'/g, "\\'")}')">
          <div class="session-card-title">${s.session_name}</div>
          <div class="session-card-meta">
            ${s.instructor_name ? `강사: ${s.instructor_name} | ` : ''}
            생성: ${new Date(s.created_at).toLocaleString('ko-KR')}
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('세션 로드 실패:', err);
      list.innerHTML = '<p class="empty-msg">로컬 모드로 동작 중</p>';
    }
  },

  /** 새 세션 생성 */
  async createSession() {
    const nameInput = document.getElementById('new-session-name');
    const instrInput = document.getElementById('new-instructor-name');
    const name = nameInput.value.trim();
    const instructor = instrInput.value.trim();

    if (!name) {
      nameInput.focus();
      return;
    }

    try {
      const session = await SupabaseClient.createSession(name, instructor);
      nameInput.value = '';
      instrInput.value = '';
      await this._loadSessions();
      this.selectSession(session.id, session.session_name);
    } catch (err) {
      console.error('세션 생성 실패:', err);
      alert('세션 생성에 실패했습니다.');
    }
  },

  /** 세션 선택 → 대시보드 표시 */
  async selectSession(sessionId, sessionName) {
    this.currentSessionId = sessionId;

    document.getElementById('session-manager').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('dashboard-session-name').textContent = sessionName;

    await this._refreshDashboard();

    // 실시간 구독
    if (this.subscription) SupabaseClient.unsubscribe(this.subscription);
    this.subscription = SupabaseClient.subscribeAssessments(sessionId, (newAssessment) => {
      this.assessments.push(newAssessment);
      this._renderDashboard();
      this._showNewSubmitToast(newAssessment);
    });
  },

  /** 대시보드 데이터 새로고침 */
  async _refreshDashboard() {
    try {
      const stats = await SupabaseClient.getSessionStats(this.currentSessionId);
      this.assessments = stats.raw;
      this._renderDashboard();
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  },

  /** 세션 관리 화면으로 돌아가기 */
  backToSessions() {
    if (this.subscription) {
      SupabaseClient.unsubscribe(this.subscription);
      this.subscription = null;
    }
    this.currentSessionId = null;
    document.getElementById('session-manager').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    this._loadSessions();
  },

  // === 대시보드 렌더링 ===

  _renderDashboard() {
    this._renderSummary();
    this._renderStudentTable();
    this._renderHazardStats();
    this._renderRiskMatrix();
  },

  /** 요약 카드 */
  _renderSummary() {
    const students = [...new Set(this.assessments.map(a => a.student_name))];
    const totalHazards = getAllHazards().length;

    document.getElementById('stat-students').textContent = students.length;
    document.getElementById('stat-assessments').textContent = this.assessments.length;
    document.getElementById('stat-hazards').textContent = totalHazards;

    const avgScore = this.assessments.length > 0
      ? (this.assessments.reduce((sum, a) => sum + (a.likelihood * a.severity), 0) / this.assessments.length).toFixed(1)
      : '-';
    document.getElementById('stat-avg-risk').textContent = avgScore;
  },

  /** 교육생 제출 현황 테이블 */
  _renderStudentTable() {
    const tbody = document.getElementById('student-table-body');
    const students = [...new Set(this.assessments.map(a => a.student_name))];
    const totalHazards = getAllHazards().length;

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">아직 제출된 평가가 없습니다.</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(name => {
      const studentAssessments = this.assessments.filter(a => a.student_name === name);
      const org = studentAssessments[0]?.student_org || '-';
      const completed = studentAssessments.length;
      const avgScore = (studentAssessments.reduce((sum, a) => sum + (a.likelihood * a.severity), 0) / completed).toFixed(1);
      const level = getRiskLevel(Math.round(parseFloat(avgScore)));

      return `
        <tr>
          <td>${name}</td>
          <td>${org}</td>
          <td>${completed}/${totalHazards}</td>
          <td><span class="risk-badge" style="background:${level.color}">${avgScore}</span></td>
          <td>${new Date(studentAssessments[studentAssessments.length - 1].submitted_at).toLocaleTimeString('ko-KR')}</td>
        </tr>
      `;
    }).join('');
  },

  /** 위험요인별 통계 */
  _renderHazardStats() {
    const container = document.getElementById('hazard-stats');
    const allHazards = getAllHazards();

    container.innerHTML = allHazards.map(hazard => {
      const ha = this.assessments.filter(a => a.hazard_id === hazard.id);
      const count = ha.length;

      if (count === 0) {
        return `
          <div class="hazard-stat-card">
            <div class="hazard-stat-title">${hazard.title}</div>
            <div class="hazard-stat-scene">${hazard.sceneTitle}</div>
            <div class="empty-msg">평가 없음</div>
          </div>
        `;
      }

      const avgL = (ha.reduce((s, a) => s + a.likelihood, 0) / count).toFixed(1);
      const avgS = (ha.reduce((s, a) => s + a.severity, 0) / count).toFixed(1);
      const avgScore = (parseFloat(avgL) * parseFloat(avgS)).toFixed(1);
      const level = getRiskLevel(Math.round(parseFloat(avgScore)));

      return `
        <div class="hazard-stat-card">
          <div class="hazard-stat-title">${hazard.title}</div>
          <div class="hazard-stat-scene">${hazard.sceneTitle}</div>
          <div class="hazard-stat-values">
            <div class="stat-item">
              <span class="stat-label">평가 수</span>
              <span class="stat-value">${count}명</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">평균 가능성</span>
              <span class="stat-value">${avgL}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">평균 중대성</span>
              <span class="stat-value">${avgS}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">평균 위험도</span>
              <span class="stat-value risk-badge" style="background:${level.color}">${avgScore} ${level.label}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /** 5x4 위험도 매트릭스 히트맵 */
  _renderRiskMatrix() {
    const container = document.getElementById('risk-matrix');

    // 매트릭스 데이터 수집
    const matrix = {};
    for (let l = 1; l <= 5; l++) {
      for (let s = 1; s <= 4; s++) {
        matrix[`${l}_${s}`] = 0;
      }
    }

    this.assessments.forEach(a => {
      const key = `${a.likelihood}_${a.severity}`;
      if (matrix[key] !== undefined) matrix[key]++;
    });

    const maxCount = Math.max(1, ...Object.values(matrix));

    let html = '<table class="matrix-table"><thead><tr><th></th>';
    for (let s = 1; s <= 4; s++) {
      html += `<th>${s}<br><small>${SEVERITY_LABELS[s]}</small></th>`;
    }
    html += '</tr></thead><tbody>';

    for (let l = 5; l >= 1; l--) {
      html += `<tr><th>${l}<br><small>${LIKELIHOOD_LABELS[l]}</small></th>`;
      for (let s = 1; s <= 4; s++) {
        const score = l * s;
        const level = getRiskLevel(score);
        const count = matrix[`${l}_${s}`];
        const opacity = count > 0 ? 0.3 + (count / maxCount) * 0.7 : 0.15;

        html += `<td class="matrix-cell" style="background:${level.color}; opacity:${opacity}" title="가능성${l} x 중대성${s} = ${score} (${count}건)">
          <div class="matrix-score">${score}</div>
          ${count > 0 ? `<div class="matrix-count">${count}건</div>` : ''}
        </td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    // 범례
    html += '<div class="matrix-legend">';
    Object.values(RISK_LEVELS).forEach(level => {
      html += `<span class="legend-item"><span class="legend-color" style="background:${level.color}"></span>${level.label} (${level.min}~${level.max})</span>`;
    });
    html += '</div>';

    container.innerHTML = html;
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

  /** 세션 종료 */
  async endSession() {
    if (!confirm('이 세션을 종료하시겠습니까?')) return;
    try {
      await SupabaseClient.deactivateSession(this.currentSessionId);
      this.backToSessions();
    } catch (err) {
      console.error('세션 종료 실패:', err);
    }
  },

  _showSessionManager() {
    document.getElementById('session-manager').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
  },
};

document.addEventListener('DOMContentLoaded', () => InstructorApp.init());
