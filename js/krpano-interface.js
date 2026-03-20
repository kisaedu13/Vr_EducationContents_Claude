/**
 * krpano JavaScript Interface 래퍼
 * krpano 뷰어와 웹 애플리케이션 간 통신을 담당
 */

const KrpanoInterface = {
  krpano: null,
  onHotspotClick: null,
  onSceneChange: null,
  currentScene: null,

  /** krpano 임베딩 초기화 */
  init(targetId, xmlPath, callback) {
    embedpano({
      xml: xmlPath,
      target: targetId,
      html5: 'only',
      mobilescale: 1.0,
      passQueryParameters: 'startscene,startlookat',
      onready: (krpanoObj) => {
        this.krpano = krpanoObj;
        if (callback) callback();
      },
    });
  },

  /** 현재 씬에 위험요인 핫스팟 추가 */
  addHazardHotspots(sceneName) {
    const scene = SCENE_DATA[sceneName];
    if (!scene) return;

    scene.hazards.forEach((hazard) => {
      const hsName = `hs_${hazard.id}`;

      this.krpano.call(`addhotspot(${hsName})`);
      this.krpano.set(`hotspot[${hsName}].ath`, hazard.ath);
      this.krpano.set(`hotspot[${hsName}].atv`, hazard.atv);
      this.krpano.set(`hotspot[${hsName}].url`, `data:image/svg+xml;base64,${this._createMarkerSVG(false)}`);
      this.krpano.set(`hotspot[${hsName}].scale`, 0.5);
      this.krpano.set(`hotspot[${hsName}].edge`, 'center');
      this.krpano.set(`hotspot[${hsName}].distorted`, false);
      this.krpano.set(`hotspot[${hsName}].onclick`, `js(KrpanoInterface._onHotspotClicked('${hazard.id}'))`);
      this.krpano.call(`set(hotspot[${hsName}].onover, tween(scale, 0.6, 0.2))`);
      this.krpano.call(`set(hotspot[${hsName}].onout, tween(scale, 0.5, 0.2))`);
    });
  },

  /** 기존 핫스팟 제거 */
  removeAllHotspots() {
    if (!this.krpano) return;
    const count = this.krpano.get('hotspot.count');
    const names = [];
    for (let i = 0; i < count; i++) {
      const name = this.krpano.get(`hotspot[${i}].name`);
      if (name && name.startsWith('hs_')) names.push(name);
    }
    names.forEach(name => this.krpano.call(`removehotspot(${name})`));
  },

  /** 씬 전환 */
  loadScene(sceneName) {
    if (!this.krpano) return;
    this.removeAllHotspots();
    this.krpano.call(`loadscene(${sceneName}, , MERGE, BLEND(1))`);
    this.currentScene = sceneName;

    setTimeout(() => {
      this.addHazardHotspots(sceneName);
      if (this.onSceneChange) this.onSceneChange(sceneName);
    }, 500);
  },

  /** 특정 핫스팟 위치로 뷰 이동 */
  lookToHotspot(hazardId) {
    if (!this.krpano) return;
    const scenes = Object.values(SCENE_DATA);
    for (const scene of scenes) {
      const hazard = scene.hazards.find(h => h.id === hazardId);
      if (hazard) {
        this.krpano.call(`lookto(${hazard.ath}, ${hazard.atv}, 100, smooth(2))`);
        return;
      }
    }
  },

  /** 핫스팟 완료 표시 (평가 완료 시 색상 변경) */
  markHotspotCompleted(hazardId) {
    const hsName = `hs_${hazardId}`;
    if (!this.krpano) return;
    try {
      this.krpano.set(`hotspot[${hsName}].url`,
        `data:image/svg+xml;base64,${this._createMarkerSVG(true)}`);
    } catch (e) { /* hotspot may not exist in current scene */ }
  },

  /** 핫스팟 클릭 핸들러 (krpano에서 호출) */
  _onHotspotClicked(hazardId) {
    if (this.onHotspotClick) this.onHotspotClick(hazardId);
  },

  /** SVG 마커 생성 (Base64) */
  _createMarkerSVG(completed) {
    if (completed) {
      // 완료 마커: 초록색 체크 아이콘
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" fill="#4CAF50" opacity="0.85"/>
        <circle cx="40" cy="40" r="28" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <polyline points="28,40 36,48 52,32" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      return btoa(unescape(encodeURIComponent(svg)));
    }
    // 위험 마커: 삼각형 경고 아이콘 + 펄스 링
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#FF5722" stroke-width="2" opacity="0.6">
        <animate attributeName="r" values="34;46;34" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,87,34,0.3)" stroke-width="1.5">
        <animate attributeName="r" values="30;42;30" dur="2.5s" repeatCount="indefinite" begin="0.4s"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" begin="0.4s"/>
      </circle>
      <polygon points="50,22 72,62 28,62" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="50,26 69,60 31,60" fill="#FF5722" opacity="0.85" stroke-linejoin="round"/>
      <line x1="50" y1="36" x2="50" y2="50" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="50" cy="56" r="2" fill="white"/>
    </svg>`;
    return btoa(unescape(encodeURIComponent(svg)));
  },
};
