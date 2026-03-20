/**
 * 위험성평가 UI — 핫스팟 정보 팝업 + 단계별 위험성평가 폼
 * Step 1: 위험요인 식별 + 빈도/강도 → 위험성 결정
 * Step 2: 허용 가능 여부 판단
 * Step 3: 감소대책 + 재평가 (허용 불가능 시만)
 */

const RiskAssessment = {

  /** 핫스팟 클릭 → 정보 팝업 (읽기 전용) */
  showHazardInfoPopup(hazardId, sceneName) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;
    const hazard = scene.hazards.find(h => h.id === hazardId);
    if (!hazard) return;

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
      <div class="popup info-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>
        <div class="hazard-info">
          <span class="hazard-category">${hazard.category}</span>
          <h2>${hazard.title}</h2>
          <p>${hazard.description}</p>
        </div>
        ${risksHtml}
        <button class="btn btn-secondary" style="width:100%" onclick="RiskAssessment.closePopup()">닫기</button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** Scene별 위험성평가 폼 팝업 — 단계별 프로세스 */
  showSceneAssessmentForm(sceneName, onSubmit) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;

    this.closePopup();

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    overlay.innerHTML = `
      <div class="popup assessment-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>

        <div class="hazard-info">
          <h2>위험성평가</h2>
          <p>${scene.title}</p>
        </div>

        <!-- 스텝 인디케이터 -->
        <div class="step-indicator">
          <div class="step-item active" data-step="1">
            <div class="step-circle">1</div>
            <div class="step-text">위험성 결정</div>
          </div>
          <div class="step-line" id="step-line-1-2"></div>
          <div class="step-item" data-step="2">
            <div class="step-circle">2</div>
            <div class="step-text">허용 여부</div>
          </div>
          <div class="step-line" id="step-line-2-3"></div>
          <div class="step-item" data-step="3">
            <div class="step-circle">3</div>
            <div class="step-text">감소대책</div>
          </div>
        </div>

        <!-- Step 1: 위험요인 + 빈도/강도 -->
        <div id="assess-step-1" class="assess-step assess-step-visible">
          <div class="form-group">
            <label>유해위험요인</label>
            <textarea id="hazard-description" class="form-textarea" rows="3" placeholder="발견한 유해위험요인을 작성해주세요"></textarea>
          </div>

          <div class="form-group">
            <label>빈도</label>
            <div class="rating-buttons" id="frequency-buttons">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-btn" data-field="frequency" data-value="${v}">
                  <span class="rating-value">${v}</span>
                  <span class="rating-label">${FREQUENCY_LABELS[v]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>강도</label>
            <div class="rating-buttons" id="intensity-buttons">
              ${[1,2,3,4].map(v => `
                <button type="button" class="rating-btn" data-field="intensity" data-value="${v}">
                  <span class="rating-value">${v}</span>
                  <span class="rating-label">${INTENSITY_LABELS[v]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="risk-result" id="risk-result" style="display:none">
            <div class="risk-score" id="risk-score-display">-</div>
            <div class="risk-result-text">
              <div class="risk-result-title">위험성 점수</div>
              <div class="risk-result-formula" id="risk-formula">빈도 × 강도</div>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-submit" id="step1-next-btn" disabled>
            다음 단계로 &rarr;
          </button>
        </div>

        <!-- Step 2: 허용 가능 여부 -->
        <div id="assess-step-2" class="assess-step">
          <div class="step2-question">이 위험을 허용할 수 있습니까?</div>
          <div class="step-summary" id="step2-summary"></div>
          <div class="accept-buttons">
            <button type="button" class="btn accept-btn acceptable" id="btn-acceptable">
              <span class="accept-icon">&#10003;</span>
              <span class="accept-text">허용 가능</span>
              <span class="accept-desc">현재 수준 수용</span>
            </button>
            <button type="button" class="btn accept-btn unacceptable" id="btn-unacceptable">
              <span class="accept-icon">&#10007;</span>
              <span class="accept-text">허용 불가능</span>
              <span class="accept-desc">감소대책 필요</span>
            </button>
          </div>
          <button type="button" class="btn btn-back" id="step2-back-btn">
            &larr; 이전 단계
          </button>
        </div>

        <!-- Step 3: 감소대책 + 재평가 -->
        <div id="assess-step-3" class="assess-step">
          <div class="step-summary" id="step3-summary"></div>

          <div class="assess-revised-section">
            <h3 class="revised-section-title">감소대책 수립 및 재평가</h3>

            <div class="form-group">
              <label>감소대책</label>
              <textarea id="reduction-measures" class="form-textarea" rows="3" placeholder="위험을 줄이기 위한 대책을 작성해주세요"></textarea>
            </div>

            <div class="form-group">
              <label>개선 후 빈도</label>
              <div class="rating-buttons" id="revised-frequency-buttons">
                ${[1,2,3,4,5].map(v => `
                  <button type="button" class="rating-btn" data-field="revisedFrequency" data-value="${v}">
                    <span class="rating-value">${v}</span>
                    <span class="rating-label">${FREQUENCY_LABELS[v]}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>개선 후 강도</label>
              <div class="rating-buttons" id="revised-intensity-buttons">
                ${[1,2,3,4].map(v => `
                  <button type="button" class="rating-btn" data-field="revisedIntensity" data-value="${v}">
                    <span class="rating-value">${v}</span>
                    <span class="rating-label">${INTENSITY_LABELS[v]}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="risk-result" id="revised-risk-result" style="display:none">
              <div class="risk-score" id="revised-risk-score-display">-</div>
              <div class="risk-result-text">
                <div class="risk-result-title">개선 후 위험성</div>
                <div class="risk-result-formula" id="revised-risk-formula">빈도 × 강도</div>
              </div>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-submit" id="step3-submit-btn" disabled>
            평가 제출
          </button>
          <button type="button" class="btn btn-back" id="step3-back-btn">
            &larr; 이전 단계
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // === 상태 관리 ===
    let frequency = null;
    let intensity = null;
    let revisedFrequency = null;
    let revisedIntensity = null;

    // === Step 1 이벤트 ===
    const step1 = overlay.querySelector('#assess-step-1');
    step1.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const value = parseInt(btn.dataset.value);

        btn.parentElement.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        if (field === 'frequency') frequency = value;
        if (field === 'intensity') intensity = value;

        if (frequency && intensity) {
          const score = frequency * intensity;
          const level = getRiskLevel(score);
          const resultEl = document.getElementById('risk-result');
          const scoreEl = document.getElementById('risk-score-display');
          const formulaEl = document.getElementById('risk-formula');

          resultEl.style.display = 'flex';
          scoreEl.textContent = score;
          scoreEl.style.backgroundColor = level.color;
          formulaEl.textContent = `${frequency} × ${intensity} = ${score}`;
        }

        this._checkStep1Valid(frequency, intensity);
      });
    });

    step1.querySelector('#hazard-description').addEventListener('input', () => {
      this._checkStep1Valid(frequency, intensity);
    });

    // Step 1 → Step 2
    document.getElementById('step1-next-btn').addEventListener('click', () => {
      const desc = document.getElementById('hazard-description').value.trim();
      if (!frequency || !intensity || !desc) return;

      const score = frequency * intensity;
      const level = getRiskLevel(score);

      // Step 2 요약
      document.getElementById('step2-summary').innerHTML = `
        <div class="summary-card-inner">
          <div class="summary-row">
            <span class="summary-label">유해위험요인</span>
            <span class="summary-value">${desc}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">위험성</span>
            <span class="summary-value">${frequency} × ${intensity} = <span class="risk-badge" style="background:${level.color}">${score}</span></span>
          </div>
        </div>
      `;

      this._goToStep(2);
    });

    // === Step 2 이벤트 ===
    document.getElementById('btn-acceptable').addEventListener('click', () => {
      const desc = document.getElementById('hazard-description').value.trim();
      if (onSubmit) {
        onSubmit({
          sceneName,
          hazardDescription: desc,
          frequency,
          intensity,
          riskScore: frequency * intensity,
          isAcceptable: true,
          reductionMeasures: null,
          revisedFrequency: null,
          revisedIntensity: null,
          revisedRiskScore: null,
        });
      }
    });

    document.getElementById('btn-unacceptable').addEventListener('click', () => {
      const desc = document.getElementById('hazard-description').value.trim();
      const score = frequency * intensity;
      const level = getRiskLevel(score);

      // Step 3 요약
      document.getElementById('step3-summary').innerHTML = `
        <div class="summary-card-inner">
          <div class="summary-row">
            <span class="summary-label">유해위험요인</span>
            <span class="summary-value">${desc}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">위험성</span>
            <span class="summary-value">${frequency} × ${intensity} = <span class="risk-badge" style="background:${level.color}">${score}</span></span>
          </div>
          <div class="summary-row">
            <span class="summary-label">판정</span>
            <span class="summary-value"><span class="accept-badge unacceptable">허용 불가능</span></span>
          </div>
        </div>
      `;

      this._goToStep(3);
    });

    document.getElementById('step2-back-btn').addEventListener('click', () => {
      this._goToStep(1);
    });

    // === Step 3 이벤트 ===
    const step3 = overlay.querySelector('#assess-step-3');
    step3.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const value = parseInt(btn.dataset.value);

        btn.parentElement.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        if (field === 'revisedFrequency') revisedFrequency = value;
        if (field === 'revisedIntensity') revisedIntensity = value;

        if (revisedFrequency && revisedIntensity) {
          const score = revisedFrequency * revisedIntensity;
          const level = getRiskLevel(score);
          const resultEl = document.getElementById('revised-risk-result');
          const scoreEl = document.getElementById('revised-risk-score-display');
          const formulaEl = document.getElementById('revised-risk-formula');

          resultEl.style.display = 'flex';
          scoreEl.textContent = score;
          scoreEl.style.backgroundColor = level.color;
          formulaEl.textContent = `${revisedFrequency} × ${revisedIntensity} = ${score}`;
        }

        this._checkStep3Valid(revisedFrequency, revisedIntensity);
      });
    });

    step3.querySelector('#reduction-measures').addEventListener('input', () => {
      this._checkStep3Valid(revisedFrequency, revisedIntensity);
    });

    document.getElementById('step3-submit-btn').addEventListener('click', () => {
      const desc = document.getElementById('hazard-description').value.trim();
      const measures = document.getElementById('reduction-measures').value.trim();
      if (!revisedFrequency || !revisedIntensity || !measures) return;

      if (onSubmit) {
        onSubmit({
          sceneName,
          hazardDescription: desc,
          frequency,
          intensity,
          riskScore: frequency * intensity,
          isAcceptable: false,
          reductionMeasures: measures,
          revisedFrequency,
          revisedIntensity,
          revisedRiskScore: revisedFrequency * revisedIntensity,
        });
      }
    });

    document.getElementById('step3-back-btn').addEventListener('click', () => {
      this._goToStep(2);
    });

    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** 스텝 전환 (애니메이션 포함) */
  _goToStep(stepNum) {
    // 현재 보이는 스텝 fade-out → 새 스텝 fade-in
    const allSteps = document.querySelectorAll('.assess-step');
    allSteps.forEach(el => el.classList.remove('assess-step-visible'));

    // 스텝 인디케이터 업데이트
    document.querySelectorAll('.step-item').forEach(item => {
      const s = parseInt(item.dataset.step);
      item.classList.toggle('active', s === stepNum);
      item.classList.toggle('completed', s < stepNum);
    });

    // 연결선 색상 업데이트
    const line12 = document.getElementById('step-line-1-2');
    const line23 = document.getElementById('step-line-2-3');
    if (line12) line12.classList.toggle('step-line-active', stepNum >= 2);
    if (line23) line23.classList.toggle('step-line-active', stepNum >= 3);

    // 약간의 딜레이 후 새 스텝 표시
    setTimeout(() => {
      const target = document.getElementById(`assess-step-${stepNum}`);
      if (target) {
        target.classList.add('assess-step-visible');
        // 스크롤 맨 위로
        target.closest('.popup').scrollTop = 0;
      }
    }, 150);
  },

  /** Step 1 유효성 검사 */
  _checkStep1Valid(frequency, intensity) {
    const desc = document.getElementById('hazard-description');
    const btn = document.getElementById('step1-next-btn');
    if (!btn) return;
    btn.disabled = !(frequency && intensity && desc && desc.value.trim());
  },

  /** Step 3 유효성 검사 */
  _checkStep3Valid(revisedFrequency, revisedIntensity) {
    const measures = document.getElementById('reduction-measures');
    const btn = document.getElementById('step3-submit-btn');
    if (!btn) return;
    btn.disabled = !(revisedFrequency && revisedIntensity && measures && measures.value.trim());
  },

  /** 강사용 위험요인별 교육생 결과 팝업 */
  showHazardResults(assessments, sceneName) {
    this.closePopup();

    const scene = SCENE_DATA[sceneName];
    const sceneTitle = scene ? scene.title : sceneName;

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    let listHtml = '';
    if (assessments.length === 0) {
      listHtml = '<p class="empty-msg">아직 제출된 평가가 없습니다.</p>';
    } else {
      listHtml = assessments.map(a => {
        const score = (a.frequency || 0) * (a.intensity || 0);
        const level = getRiskLevel(score);

        // 허용 여부 배지
        let acceptHtml = '';
        if (a.is_acceptable === true) {
          acceptHtml = '<span class="accept-badge acceptable">허용 가능</span>';
        } else if (a.is_acceptable === false) {
          acceptHtml = '<span class="accept-badge unacceptable">허용 불가능</span>';
        }

        // 감소대책 + 개선 후 점수 (허용 불가능 시)
        let revisedHtml = '';
        if (a.is_acceptable === false && a.reduction_measures) {
          const revisedScore = (a.revised_frequency || 0) * (a.revised_intensity || 0);
          const revisedLevel = getRiskLevel(revisedScore);
          revisedHtml = `
            <div class="assess-revised-info">
              <div class="overlay-assess-field"><strong>감소대책:</strong> ${a.reduction_measures}</div>
              <div class="overlay-assess-field"><strong>개선 후:</strong> ${a.revised_frequency || 0} × ${a.revised_intensity || 0} = <span class="risk-badge" style="background:${revisedLevel.color}">${revisedScore}</span></div>
            </div>
          `;
        }

        return `
          <div class="overlay-assessment-card">
            <div class="overlay-assess-header">
              <span class="result-name">${a.student_name}</span>
              <div class="overlay-assess-badges">
                <span class="risk-badge" style="background:${level.color}">${score}</span>
                ${acceptHtml}
              </div>
            </div>
            <div class="overlay-assess-body">
              <div class="overlay-assess-field"><strong>유해위험요인:</strong> ${a.hazard_description || '-'}</div>
              <div class="overlay-assess-field"><strong>빈도 × 강도:</strong> ${a.frequency || 0} × ${a.intensity || 0}</div>
              ${revisedHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    overlay.innerHTML = `
      <div class="popup hazard-results-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>
        <div class="hazard-info">
          <h2>${sceneTitle} - 교육생 평가 결과</h2>
        </div>
        <div class="results-list">
          <h3>평가 목록 (${assessments.length}건)</h3>
          ${listHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  /** 내 평가 목록 팝업 (교육생용) — Scene별 그룹핑 */
  showMyAssessments(assessments) {
    this.closePopup();

    const overlay = document.createElement('div');
    overlay.id = 'assessment-overlay';
    overlay.className = 'overlay';

    let listHtml = '';
    if (assessments.length === 0) {
      listHtml = '<p class="empty-msg">아직 제출한 평가가 없습니다.</p>';
    } else {
      // Scene별 그룹핑
      const grouped = {};
      assessments.forEach(a => {
        const key = a.sceneName;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      });

      listHtml = Object.entries(grouped).map(([sceneName, items]) => {
        const sceneInfo = SCENE_DATA[sceneName];
        const sceneTitle = sceneInfo ? sceneInfo.title : sceneName;

        const cardsHtml = items.map(a => {
          const score = a.riskScore || (a.frequency * a.intensity);
          const level = getRiskLevel(score);

          // 허용 여부 배지
          let acceptHtml = '';
          if (a.isAcceptable === true) {
            acceptHtml = '<span class="accept-badge acceptable">허용 가능</span>';
          } else if (a.isAcceptable === false) {
            acceptHtml = '<span class="accept-badge unacceptable">허용 불가능</span>';
          }

          // 감소대책 + 개선 후 점수
          let revisedHtml = '';
          if (a.isAcceptable === false && a.reductionMeasures) {
            const revisedScore = a.revisedRiskScore || (a.revisedFrequency * a.revisedIntensity);
            const revisedLevel = getRiskLevel(revisedScore);
            revisedHtml = `
              <div class="assess-revised-info">
                <div class="my-assess-field"><strong>감소대책:</strong> ${a.reductionMeasures}</div>
                <div class="my-assess-field"><strong>개선 후:</strong> ${a.revisedFrequency} × ${a.revisedIntensity} = <span class="risk-badge" style="background:${revisedLevel.color}">${revisedScore}</span></div>
              </div>
            `;
          }

          return `
            <div class="my-assessment-item">
              <div class="my-assess-header">
                <span class="risk-badge" style="background:${level.color}">${score}</span>
                ${acceptHtml}
              </div>
              <div class="my-assess-body">
                <div class="my-assess-field"><strong>유해위험요인:</strong> ${a.hazardDescription || '-'}</div>
                <div class="my-assess-field"><strong>빈도 × 강도:</strong> ${a.frequency} × ${a.intensity}</div>
                ${revisedHtml}
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="scene-group">
            <div class="scene-group-header">${sceneTitle} <span class="scene-group-count">${items.length}건</span></div>
            ${cardsHtml}
          </div>
        `;
      }).join('');
    }

    overlay.innerHTML = `
      <div class="popup hazard-results-popup">
        <button class="popup-close" onclick="RiskAssessment.closePopup()">&times;</button>
        <div class="hazard-info">
          <h2>내 평가 목록</h2>
        </div>
        <div class="results-list">
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
