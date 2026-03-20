/**
 * krpano JavaScript Interface 래퍼
 * krpano 뷰어와 웹 애플리케이션 간 통신을 담당
 */

const KrpanoInterface = {
  krpano: null,
  onHotspotClick: null,
  onSceneChange: null,
  onVRModeChange: null,
  currentScene: null,
  vrMode: false,

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
      this.krpano.set(`hotspot[${hsName}].url`, `data:image/svg+xml;base64,${this._createMarkerSVG()}`);
      this.krpano.set(`hotspot[${hsName}].scale`, 0.55);
      this.krpano.set(`hotspot[${hsName}].edge`, 'center');
      this.krpano.set(`hotspot[${hsName}].distorted`, false);
      this.krpano.set(`hotspot[${hsName}].zoom`, true);
      this.krpano.set(`hotspot[${hsName}].onclick`, `js(KrpanoInterface._onHotspotClicked('${hazard.id}'))`);
      this.krpano.call(`set(hotspot[${hsName}].onover, tween(scale, 0.7, 0.15))`);
      this.krpano.call(`set(hotspot[${hsName}].onout, tween(scale, 0.55, 0.15))`);
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

  /** 핫스팟 클릭 핸들러 (krpano에서 호출) */
  _onHotspotClicked(hazardId) {
    if (this.onHotspotClick) this.onHotspotClick(hazardId);
  },

  /** VR 모드 진입 핸들러 (krpano에서 호출) */
  _onEnterVR() {
    this.vrMode = true;
    document.body.classList.add('vr-active');
    if (this.onVRModeChange) this.onVRModeChange(true);
  },

  /** VR 모드 해제 핸들러 (krpano에서 호출) */
  _onExitVR() {
    this.vrMode = false;
    document.body.classList.remove('vr-active');
    if (this.onVRModeChange) this.onVRModeChange(false);
  },

  /** SVG 정보 마커 생성 (Base64) */
  _createMarkerSVG() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140" viewBox="0 0 120 140">
      <defs>
        <filter id="ds" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000" flood-opacity="0.5"/>
        </filter>
        <radialGradient id="bg" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#42A5F5"/>
          <stop offset="100%" stop-color="#1565C0"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="58" r="44" fill="none" stroke="#42A5F5" stroke-width="2" opacity="0">
        <animate attributeName="r" values="38;52;38" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="60" cy="58" r="44" fill="none" stroke="#42A5F5" stroke-width="1.5" opacity="0">
        <animate attributeName="r" values="38;48;38" dur="2s" repeatCount="indefinite" begin="0.5s"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" begin="0.5s"/>
      </circle>
      <g filter="url(#ds)">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-6; 0,0" dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.33,0,0.67,1; 0.33,0,0.67,1"/>
        <circle cx="60" cy="58" r="34" fill="url(#bg)"/>
        <circle cx="60" cy="58" r="34" fill="none" stroke="white" stroke-width="2.5" opacity="0.6"/>
        <circle cx="60" cy="58" r="26" fill="none" stroke="white" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
        <line x1="60" y1="44" x2="60" y2="58" stroke="white" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="66" r="2.5" fill="white"/>
        <polygon points="60,82 54,92 66,92" fill="white" opacity="0.9"/>
      </g>
    </svg>`;
    return btoa(unescape(encodeURIComponent(svg)));
  },
};
