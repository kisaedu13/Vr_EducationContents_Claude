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
        this._startVRWatcher();
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

  /** VR 모드 상태 감시 (폴링 방식 — XML 수정 불필요) */
  _vrWatcherId: null,
  _startVRWatcher() {
    this._vrWatcherId = setInterval(() => {
      if (!this.krpano) return;
      const isVR = this.krpano.get('webvr.isenabled');
      if (isVR && !this.vrMode) {
        this.vrMode = true;
        document.body.classList.add('vr-active');
        if (this.onVRModeChange) this.onVRModeChange(true);
      } else if (!isVR && this.vrMode) {
        this.vrMode = false;
        document.body.classList.remove('vr-active');
        if (this.onVRModeChange) this.onVRModeChange(false);
      }
    }, 500);
  },

  /** SVG 위험요인 마커 생성 (Base64) — 주황-빨강 경고 스타일 */
  _createMarkerSVG() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140" viewBox="0 0 120 140">
      <defs>
        <radialGradient id="main-bg" cx="45%" cy="35%" r="55%">
          <stop offset="0%" stop-color="#FF8A3D"/>
          <stop offset="50%" stop-color="#FF5722"/>
          <stop offset="100%" stop-color="#D32F2F"/>
        </radialGradient>
        <radialGradient id="gloss" cx="50%" cy="25%" r="45%">
          <stop offset="0%" stop-color="white" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stop-color="#FF5722" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#FF5722" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#B71C1C" flood-opacity="0.5"/>
        </filter>
        <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#glow)"/>
      <circle cx="60" cy="60" r="38" fill="none" stroke="#FF5722" stroke-width="2.5" opacity="0" filter="url(#pulse-glow)">
        <animate attributeName="r" values="36;54;36" dur="2.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="2.5;0.5;2.5" dur="2.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="60" cy="60" r="36" fill="none" stroke="#FFAB91" stroke-width="1.5" opacity="0">
        <animate attributeName="r" values="36;50;36" dur="2.2s" repeatCount="indefinite" begin="0.7s"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" begin="0.7s"/>
      </circle>
      <g filter="url(#shadow)">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.33,0,0.67,1; 0.33,0,0.67,1"/>
        <circle cx="60" cy="60" r="34" fill="url(#main-bg)"/>
        <circle cx="60" cy="60" r="33" fill="none" stroke="white" stroke-width="2" opacity="0.35"/>
        <ellipse cx="58" cy="48" rx="22" ry="16" fill="url(#gloss)"/>
        <rect x="55.5" y="42" width="9" height="22" rx="4.5" fill="white"/>
        <circle cx="60" cy="73" r="5" fill="white"/>
        <polygon points="60,88 53,96 67,96" fill="url(#main-bg)" opacity="0.9" stroke="white" stroke-width="1" stroke-opacity="0.3"/>
      </g>
    </svg>`;
    return btoa(unescape(encodeURIComponent(svg)));
  },
};
