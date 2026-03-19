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

    scene.hazards.forEach((hazard, index) => {
      const hsName = `hs_${hazard.id}`;

      this.krpano.call(`addhotspot(${hsName})`);
      this.krpano.set(`hotspot[${hsName}].ath`, hazard.ath);
      this.krpano.set(`hotspot[${hsName}].atv`, hazard.atv);
      this.krpano.set(`hotspot[${hsName}].url`, `data:image/svg+xml;base64,${this._createMarkerSVG(index + 1)}`);
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
        `data:image/svg+xml;base64,${this._createMarkerSVG('✓', true)}`);
    } catch (e) { /* hotspot may not exist in current scene */ }
  },

  /** 핫스팟 클릭 핸들러 (krpano에서 호출) */
  _onHotspotClicked(hazardId) {
    if (this.onHotspotClick) this.onHotspotClick(hazardId);
  },

  /** SVG 마커 생성 (Base64) */
  _createMarkerSVG(number, completed) {
    const fillColor = completed ? '#4CAF50' : '#FF5722';
    const text = completed ? '✓' : number;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="36" fill="${fillColor}" stroke="white" stroke-width="4" opacity="0.9"/>
      <circle cx="40" cy="40" r="36" fill="none" stroke="${fillColor}" stroke-width="2" opacity="0.5">
        <animate attributeName="r" values="36;44;36" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="40" y="48" text-anchor="middle" font-size="28" font-weight="bold" fill="white" font-family="Arial">${text}</text>
    </svg>`;
    return btoa(unescape(encodeURIComponent(svg)));
  },
};
