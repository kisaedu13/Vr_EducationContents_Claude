/**
 * 위험성평가 5x4 기법 로직 및 UI
 */

const RiskAssessment = {
  currentHazard: null,

  /** 위험성평가 팝업 표시 */
  showAssessmentForm(hazardId, sceneName, onSubmit) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;
    const hazard = scene.hazards.find(h => h.id === hazardId);
    if (!hazard) return;

    this.currentHazard = hazard;

    // 기존 팝업 제거
    this.closePopup();

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    // 주요 위험요인 이미지 카드 렌더링
    const risksHtml = hazard.risks && hazard.risks.length > 0 ? `
      <div class="risk-images-section">
        <h3 class="risk-images-title">주요 위험요인</h3>
        <div class="risk-images-grid">
          ${hazard.risks.map(r => `
            <div class="risk-image-card">
              <div class="risk-image-wrap">
                <img src="${r.image}" alt="${r.title}" loading="lazy">
              </div>
              <div class="risk-image-label">${r.title}</div>
              <div class="risk-image-desc">${r.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    overlay.innerHTML = `
      <div class="popup assessment-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>

        <div class="hazard-info">
          <span class="hazard-category">${hazard.category}</span>
          <h2>${hazard.title}</h2>
          <p>${hazard.description}</p>
        </div>

        ${risksHtml}

        <form id="assessment-form" class="assessment-form">
          <div class="form-group">
            <label>가능성 (빈도)</label>
            <div class="rating-buttons" id="likelihood-buttons">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-btn" data-field="likelihood" data-value="${v}">
                  <span class="rating-value">${v}</span>
                  <span class="rating-label">${LIKELIHOOD_LABELS[v]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>중대성 (강도)</label>
            <div class="rating-buttons" id="severity-buttons">
              ${[1,2,3,4].map(v => `
                <button type="button" class="rating-btn" data-field="severity" data-value="${v}">
                  <span class="rating-value">${v}</span>
                  <span class="rating-label">${SEVERITY_LABELS[v]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="risk-result" id="risk-result" style="display:none">
            <div class="risk-score" id="risk-score-display">-</div>
            <div class="risk-label" id="risk-label-display">평가 미완료</div>
          </div>

          <button type="submit" class="btn btn-primary btn-submit" id="submit-btn" disabled>
            평가 제출
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    // 이벤트 바인딩
    let likelihood = null;
    let severity = null;

    overlay.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const value = parseInt(btn.dataset.value);

        // 같은 그룹 버튼 선택 해제
        btn.parentElement.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        if (field === 'likelihood') likelihood = value;
        if (field === 'severity') severity = value;

        // 위험도 계산
        if (likelihood && severity) {
          const score = likelihood * severity;
          const level = getRiskLevel(score);
          const resultEl = document.getElementById('risk-result');
          const scoreEl = document.getElementById('risk-score-display');
          const labelEl = document.getElementById('risk-label-display');

          resultEl.style.display = 'flex';
          scoreEl.textContent = score;
          scoreEl.style.backgroundColor = level.color;
          labelEl.textContent = level.label;
          labelEl.style.color = level.color;

          document.getElementById('submit-btn').disabled = false;
        }
      });
    });

    document.getElementById('assessment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!likelihood || !severity) return;

      if (onSubmit) {
        onSubmit({
          hazardId: hazard.id,
          hazardTitle: hazard.title,
          sceneName,
          likelihood,
          severity,
          riskScore: likelihood * severity,
        });
      }
    });

    // 애니메이션
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** 위험요인 정보만 표시 (강사용) */
  showHazardInfo(hazardId, sceneName) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;
    const hazard = scene.hazards.find(h => h.id === hazardId);
    if (!hazard) return;

    this.closePopup();

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    overlay.innerHTML = `
      <div class="popup info-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>
        <div class="hazard-info">
          <span class="hazard-category">${hazard.category}</span>
          <h2>${hazard.title}</h2>
          <p>${hazard.description}</p>
        </div>
        <div class="hazard-meta">
          <span>위치: ath=${hazard.ath}, atv=${hazard.atv}</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** 강사용 위험요인별 교육생 결과 팝업 */
  showHazardResults(hazardId, sceneName, assessments) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;
    const hazard = scene.hazards.find(h => h.id === hazardId);
    if (!hazard) return;

    this.closePopup();

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    let listHtml = '';
    if (assessments.length === 0) {
      listHtml = '<p class="empty-msg">아직 제출된 평가가 없습니다.</p>';
    } else {
      listHtml = assessments.map(a => {
        const score = a.likelihood * a.severity;
        const level = getRiskLevel(score);
        return `
          <div class="result-item">
            <span class="result-name">${a.student_name}</span>
            <span class="result-values">가능성 ${a.likelihood} × 중대성 ${a.severity}</span>
            <span class="risk-badge" style="background:${level.color}">${score} ${level.label}</span>
          </div>
        `;
      }).join('');
    }

    overlay.innerHTML = `
      <div class="popup hazard-results-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>
        <div class="hazard-info">
          <span class="hazard-category">${hazard.category}</span>
          <h2>${hazard.title}</h2>
          <p>${hazard.description}</p>
        </div>
        <div class="results-list">
          <h3>교육생 평가 결과 (${assessments.length}명)</h3>
          ${listHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** 팝업 닫기 */
  closePopup() {
    const existing = document.getElementById('assessment-overlay');
    if (existing) {
      existing.classList.remove('active');
      setTimeout(() => existing.remove(), 200);
    }
  },

  /** 제출 완료 표시 */
  showSubmitSuccess() {
    this.closePopup();

    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = '위험성평가가 제출되었습니다!';
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  },
};
