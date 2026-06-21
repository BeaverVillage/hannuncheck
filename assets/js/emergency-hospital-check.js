(() => {
  const root = document.querySelector('[data-emergency-hospital-tool]');
  if (!root) return;

  const toolkit = window.HannunCheckToolkit || {};
  const fetchJson = toolkit.fetchJson || ((url) => fetch(url, { cache: 'no-store' }).then((response) => response.json()));
  const formatDistance = toolkit.formatDistance || ((meters) => {
    const value = Number(meters || 0);
    if (!Number.isFinite(value) || value <= 0) return '거리 정보 없음';
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}km` : `${Math.round(value)}m`;
  });
  const buildKakaoSearchUrl = toolkit.buildKakaoSearchUrl || ((item) => `https://map.kakao.com/link/search/${encodeURIComponent(`${item.name} ${item.address}`)}`);
  const MEDICAL_KAKAO_CACHE_URL = '/assets/data/medical/kakao-place-cache.json?v=20260621-v94-emergency-national-local-cache';
  const EMERGENCY_NATIONAL_CACHE_URL = '/assets/data/medical/emergency-national-cache.json?v=20260621-v94-emergency-national-local-cache';

  const MODE_META = {
    emergency: { label: '응급실', searchLabel: '응급실 확인하기', listLabel: '응급실 비교 목록', mapSuffix: '응급실', detailTitle: '선택한 응급실' },
    hospital: { label: '야간 병원', searchLabel: '야간 병원 확인하기', listLabel: '야간 병원 비교 목록', mapSuffix: '야간 병원', detailTitle: '선택한 야간 병원' },
    pharmacy: { label: '야간 약국', searchLabel: '야간 약국 확인하기', listLabel: '야간 약국 비교 목록', mapSuffix: '야간 약국', detailTitle: '선택한 야간 약국' },
  };
  const REGION_CENTERS = {
    서울: { lat: 37.5665, lng: 126.9780 }, 부산: { lat: 35.1796, lng: 129.0756 }, 대구: { lat: 35.8714, lng: 128.6014 },
    인천: { lat: 37.4563, lng: 126.7052 }, 광주: { lat: 35.1595, lng: 126.8526 }, 대전: { lat: 36.3504, lng: 127.3845 },
    울산: { lat: 35.5384, lng: 129.3114 }, 세종: { lat: 36.4800, lng: 127.2890 }, 경기: { lat: 37.4138, lng: 127.5183 },
    강원: { lat: 37.8228, lng: 128.1555 }, 충북: { lat: 36.6357, lng: 127.4917 }, 충남: { lat: 36.5184, lng: 126.8000 },
    전북: { lat: 35.7175, lng: 127.1530 }, 전남: { lat: 34.8679, lng: 126.9910 }, 경북: { lat: 36.4919, lng: 128.8889 },
    경남: { lat: 35.4606, lng: 128.2132 }, 제주: { lat: 33.4996, lng: 126.5312 },
  };


  const elements = {
    form: document.querySelector('#emergency-hospital-form'),
    modeTabs: Array.from(document.querySelectorAll('[data-care-mode]')),
    region: document.querySelector('#emergency-region'),
    district: document.querySelector('#emergency-district'),
    keyword: document.querySelector('#emergency-keyword'),
    department: document.querySelector('#emergency-department'),
    sort: document.querySelector('#emergency-sort'),
    submit: document.querySelector('#emergency-submit'),
    status: document.querySelector('#emergency-status'),
    location: document.querySelector('#emergency-use-location'),
    summaryCount: document.querySelector('#emergency-count-card'),
    summaryBeds: document.querySelector('#emergency-beds-card'),
    summaryPhone: document.querySelector('#emergency-phone-card'),
    summaryStatus: document.querySelector('#emergency-status-card'),
    mapTitle: document.querySelector('#emergency-map-title'),
    map: document.querySelector('#emergency-map'),
    mapNotice: document.querySelector('.emergency-map-notice'),
    markers: document.querySelector('#emergency-map-markers'),
    list: document.querySelector('#emergency-result-list'),
    listTitle: document.querySelector('#emergency-list-title'),
    listSummary: document.querySelector('#emergency-list-summary'),
    detail: document.querySelector('#emergency-detail-card'),
    mobileDetail: document.querySelector('#emergency-mobile-detail-card'),
    warningList: document.querySelector('#emergency-warning-list'),
    quickButtons: Array.from(document.querySelectorAll('.emergency-quick-row button, .emergency-result-sort-tabs--v88 button, [data-emergency-map-sort], [data-emergency-mobile-sort]')),
    mapToolbarSearch: document.querySelector('#emergency-map-toolbar-search'),
    mapKeyword: document.querySelector('#emergency-map-keyword'),
    mapModeToggle: document.querySelector('#emergency-map-mode-toggle'),
    mapModePanel: document.querySelector('#emergency-map-mode-panel'),
    mapModeButtons: Array.from(document.querySelectorAll('[data-emergency-map-mode]')),
    mapRegionToggle: document.querySelector('#emergency-map-region-toggle'),
    mapRegionPanel: document.querySelector('#emergency-map-region-panel'),
    mapRegion: document.querySelector('#emergency-map-region'),
    mapDistrict: document.querySelector('#emergency-map-district'),
    mapRegionApply: document.querySelector('#emergency-map-region-apply'),
    mapSortToggle: document.querySelector('#emergency-map-sort-toggle'),
    mapSortPanel: document.querySelector('#emergency-map-sort-panel'),
    mapSortButtons: Array.from(document.querySelectorAll('[data-emergency-map-sort]')),
    mapLocation: document.querySelector('#emergency-map-location'),
    mobileListToggle: document.querySelector('#emergency-mobile-list-toggle'),
    mobileSheet: document.querySelector('#emergency-mobile-bottom-sheet'),
    mobileResults: document.querySelector('#emergency-mobile-results'),
    mobileSheetTitle: document.querySelector('#emergency-mobile-sheet-title'),
    mobileSheetSubtitle: document.querySelector('#emergency-mobile-sheet-subtitle'),
    mobileSheetMapButton: document.querySelector('#emergency-mobile-sheet-map-button'),
    mobileSortButton: document.querySelector('#emergency-mobile-sort-button'),
    mobileModeButton: document.querySelector('#emergency-mobile-mode-button'),
    mobileRegionButton: document.querySelector('#emergency-mobile-region-button'),
    mobileSheetSort: document.querySelector('#emergency-mobile-sheet-sort'),
  };

  const state = {
    dataMode: 'idle',
    careMode: 'emergency',
    loading: false,
    geo: null,
    items: [],
    summary: {},
    warnings: [],
    selectedId: '',
    kakaoCache: null,
    emergencyCache: null,
    emergencyCacheReady: false,
    kakaoReady: false,
    map: null,
    kakaoOverlays: [],
    mapLoadStarted: false,
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const meta = () => MODE_META[state.careMode] || MODE_META.emergency;
  const getRegionLabel = () => elements.region?.value || '대전';
  const numberOrMax = (value) => Number.isFinite(Number(value)) ? Number(value) : 999999999;
  const numberOrNeg = (value) => Number.isFinite(Number(value)) ? Number(value) : -1;
  const buildTelLink = (phone) => phone ? `tel:${String(phone).replace(/[^0-9+]/g, '')}` : '';
  const hasUsableDistance = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
  const formatDistanceSafe = (value) => (hasUsableDistance(value) ? formatDistance(Number(value)) : '');
  const formatBeds = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('ko-KR')}개` : '전화 확인';
  const countGood = (items) => (Array.isArray(items) ? items.filter((item) => item.tone === 'good').length : 0);

  const setStatus = (message, tone = 'info') => {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
    const formStatus = document.querySelector('#emergency-form-status');
    if (formStatus) formStatus.textContent = message;
  };

  const closeToolbarPopovers = () => {
    [elements.mapModePanel, elements.mapRegionPanel, elements.mapSortPanel, elements.mobileSheetSort].forEach((panel) => { if (panel) panel.hidden = true; });
    [elements.mapModeToggle, elements.mapRegionToggle, elements.mapSortToggle, elements.mobileSortButton].forEach((button) => { if (button) button.setAttribute('aria-expanded', 'false'); });
  };

  const toggleToolbarPanel = (toggle, panel) => {
    if (!toggle || !panel) return;
    const willOpen = panel.hidden;
    closeToolbarPopovers();
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  };

  const sortLabel = (value) => ({ distance: '가까운 순', beds: '병상 우선', phone: '전화 우선', critical: '중증 정보', night: '야간 운영' }[value] || '가까운 순');

  const syncToolbarInputs = () => {
    if (elements.mapKeyword && elements.keyword && elements.mapKeyword !== document.activeElement) elements.mapKeyword.value = elements.keyword.value || '';
    if (elements.mapRegion && elements.region) elements.mapRegion.value = elements.region.value || '대전';
    if (elements.mapDistrict && elements.district && elements.mapDistrict !== document.activeElement) elements.mapDistrict.value = elements.district.value || '';
    if (elements.mapModeToggle) elements.mapModeToggle.textContent = meta().label;
    if (elements.mapRegionToggle) elements.mapRegionToggle.textContent = elements.district?.value ? `${getRegionLabel()} ${elements.district.value}` : getRegionLabel();
    const currentSort = elements.sort?.value || 'distance';
    if (elements.mapSortToggle) elements.mapSortToggle.textContent = sortLabel(currentSort);
    if (elements.mobileSortButton) elements.mobileSortButton.textContent = sortLabel(currentSort);
    if (elements.mobileModeButton) elements.mobileModeButton.textContent = meta().label;
    if (elements.mobileRegionButton) elements.mobileRegionButton.textContent = elements.district?.value ? `${getRegionLabel()} ${elements.district.value}` : getRegionLabel();
    elements.mapModeButtons?.forEach((button) => button.classList.toggle('active', button.dataset.emergencyMapMode === state.careMode));
    elements.mapSortButtons?.forEach((button) => button.classList.toggle('active', button.dataset.emergencyMapSort === currentSort));
    document.querySelectorAll('[data-emergency-mobile-sort]').forEach((button) => button.classList.toggle('active', button.dataset.emergencyMobileSort === currentSort));
  };

  const syncFromToolbar = () => {
    if (elements.mapKeyword && elements.keyword) elements.keyword.value = elements.mapKeyword.value || '';
    if (elements.mapRegion && elements.region) elements.region.value = elements.mapRegion.value || elements.region.value;
    if (elements.mapDistrict && elements.district) elements.district.value = elements.mapDistrict.value || '';
    syncToolbarInputs();
  };

  const isEmergencyItem = (item) => (item?.kind || state.careMode) === 'emergency';

  const getKakaoAction = (item) => {
    const util = window.HannunKakaoPlaceLink;
    const directMatch = item?.kakaoPlace || item?.kakaoPlaceMatch || item?.kakao || null;
    const cachedMatch = util?.findMatch ? util.findMatch(state.kakaoCache, item, { mode: state.careMode }) : null;
    const match = directMatch || cachedMatch;
    if (util?.getAction) {
      return util.getAction(item, match, { allowMedium: state.careMode !== 'emergency', mode: state.careMode });
    }
    return { type: 'search', label: '카카오맵 검색', url: buildKakaoSearchUrl(item), confidence: 'none' };
  };

  const loadKakaoPlaceCache = async () => {
    const util = window.HannunKakaoPlaceLink;
    if (!util?.loadCache) return;
    state.kakaoCache = await util.loadCache(MEDICAL_KAKAO_CACHE_URL);
    if (state.items.length) render();
  };


  const normalizeRegionForCache = (value) => {
    const raw = String(value || '').trim();
    const full = {
      서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시', 대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시',
      경기: '경기도', 강원: '강원특별자치도', 충북: '충청북도', 충남: '충청남도', 전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도', 제주: '제주특별자치도',
    }[raw];
    return { raw, full: full || raw };
  };

  const normalizeTextForCache = (value) => String(value || '').trim().replace(/\s+/g, ' ');
  const normalizeMatchText = (value) => normalizeTextForCache(value).replace(/[\s()\[\]{}·.,-]/g, '').toLowerCase();

  const distanceBetweenM = (a, b) => {
    const lat1 = Number(a?.lat); const lng1 = Number(a?.lng); const lat2 = Number(b?.lat); const lng2 = Number(b?.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    const toRad = (d) => d * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
  };

  const normalizeEmergencyCacheEntry = (entry = {}) => {
    const id = normalizeTextForCache(entry.id || entry.sourceId || entry.hpid || '');
    const lat = Number(entry.lat);
    const lng = Number(entry.lng);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && lat >= 30 && lat <= 45 && lng >= 120 && lng <= 135;
    const item = {
      id,
      sourceId: id,
      kind: 'emergency',
      type: 'emergency',
      name: normalizeTextForCache(entry.name || entry.dutyName || '응급의료기관'),
      address: normalizeTextForCache(entry.address || entry.dutyAddr || ''),
      region: normalizeTextForCache(entry.sido || entry.region || ''),
      district: normalizeTextForCache(entry.sigungu || entry.district || ''),
      emergencyTel: normalizeTextForCache(entry.emergencyTel || entry.dutyTel3 || ''),
      mainTel: normalizeTextForCache(entry.mainTel || entry.dutyTel1 || ''),
      lat: hasCoordinates ? lat : null,
      lng: hasCoordinates ? lng : null,
      hasCoordinates,
      distanceM: null,
      emergencyBeds: null,
      totalBeds: null,
      statusLabel: '실시간 병상 확인 필요',
      statusTone: 'neutral',
      criticalCare: [],
      criticalAvailableCount: 0,
      facilityStatus: [],
      facilityAvailableCount: 0,
      messages: [],
      sourceMode: 'local_emergency_cache',
      source: 'LOCAL EMERGENCY NATIONAL CACHE',
      updatedAt: normalizeTextForCache(entry.updatedAt || ''),
      isLocalCacheOnly: true,
    };
    if (state.geo && item.hasCoordinates) item.distanceM = distanceBetweenM(state.geo, item);
    return item;
  };

  const createEmergencyCacheIndex = (payload = {}) => {
    const rawEntries = payload.entries || payload.items || [];
    const entries = (Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries))
      .map(normalizeEmergencyCacheEntry)
      .filter((item) => item.id && item.name);
    const byId = new Map();
    const byName = new Map();
    entries.forEach((item) => {
      byId.set(item.id, item);
      byId.set(`emergency:${item.id}`, item);
      byId.set(`NMC_${item.id}`, item);
      const nameKey = normalizeMatchText(item.name);
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, item);
    });
    return { ...payload, entries, byId, byName };
  };

  const loadEmergencyNationalCache = async () => {
    try {
      const response = await fetch(EMERGENCY_NATIONAL_CACHE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`emergency cache ${response.status}`);
      state.emergencyCache = createEmergencyCacheIndex(await response.json());
      state.emergencyCacheReady = true;
      if (state.items.length) {
        state.items = mergeEmergencyCacheBasics(state.items);
        render();
      }
    } catch (error) {
      state.emergencyCache = createEmergencyCacheIndex({ entries: {} });
      state.emergencyCacheReady = false;
    }
  };

  const getEmergencyCacheMatch = (item = {}) => {
    if (!state.emergencyCache) return null;
    const id = normalizeTextForCache(item.id || item.sourceId || item.hpid || '');
    if (id) {
      const match = state.emergencyCache.byId?.get(id) || state.emergencyCache.byId?.get(`emergency:${id}`) || state.emergencyCache.byId?.get(`NMC_${id}`);
      if (match) return match;
    }
    const nameKey = normalizeMatchText(item.name || '');
    return nameKey ? state.emergencyCache.byName?.get(nameKey) || null : null;
  };

  const mergeEmergencyCacheBasics = (items = []) => items.map((item) => {
    if (!isEmergencyItem(item)) return item;
    const cached = getEmergencyCacheMatch(item);
    if (!cached) return item;
    const hasItemCoords = hasMapCoordinates(item);
    const merged = {
      ...cached,
      ...item,
      sourceId: item.sourceId || item.id || cached.sourceId,
      id: item.id || cached.id,
      name: item.name || cached.name,
      address: item.address || cached.address,
      emergencyTel: item.emergencyTel || cached.emergencyTel,
      mainTel: item.mainTel || cached.mainTel,
      lat: hasItemCoords ? item.lat : cached.lat,
      lng: hasItemCoords ? item.lng : cached.lng,
      hasCoordinates: hasItemCoords || cached.hasCoordinates,
      isLocalCacheOnly: false,
      locationSourceMode: hasItemCoords ? item.locationSourceMode : 'local_emergency_cache',
    };
    if (!hasUsableDistance(merged.distanceM) && state.geo && merged.hasCoordinates) merged.distanceM = distanceBetweenM(state.geo, merged);
    return merged;
  });

  const filterEmergencyCache = () => {
    if (state.careMode !== 'emergency' || !state.emergencyCache?.entries?.length) return [];
    const { raw, full } = normalizeRegionForCache(elements.region?.value || getRegionLabel());
    const district = normalizeTextForCache(elements.district?.value || '');
    const keyword = normalizeMatchText(elements.keyword?.value || elements.mapKeyword?.value || '');
    const result = state.emergencyCache.entries.filter((item) => {
      const address = item.address || '';
      if (full && raw && !address.includes(full) && !address.includes(raw) && item.region !== full && item.region !== raw) return false;
      if (district && !address.includes(district) && item.district !== district) return false;
      if (keyword && !normalizeMatchText(`${item.name} ${item.address}`).includes(keyword)) return false;
      return true;
    }).map((item) => {
      const copy = { ...item };
      if (state.geo && copy.hasCoordinates) copy.distanceM = distanceBetweenM(state.geo, copy);
      return copy;
    });
    return sortItems(result, elements.sort?.value || 'distance').slice(0, 40);
  };

  const hasMapCoordinates = (item) => {
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 32 && lat <= 39.8 && lng >= 123 && lng <= 132.5;
  };

  const mappableItems = (items = []) => items.filter(hasMapCoordinates);

  const getMapCenter = (items = state.items) => {
    const selected = items.find((item) => item.id === state.selectedId);
    const candidate = hasMapCoordinates(selected) ? selected : items.find(hasMapCoordinates);
    if (candidate && hasMapCoordinates(candidate)) {
      return { lat: Number(candidate.lat), lng: Number(candidate.lng) };
    }
    if (state.geo && Number.isFinite(Number(state.geo.lat)) && Number.isFinite(Number(state.geo.lng))) return state.geo;
    return REGION_CENTERS[getRegionLabel()] || REGION_CENTERS.대전;
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) || document.querySelector('script[data-kakao-map-sdk]');
    if (existing) {
      if (window.kakao?.maps?.load) return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('카카오맵 SDK 스크립트 로드 실패')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.kakaoMapSdk = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('카카오맵 SDK 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

  const resolveKakaoMapKey = async () => {
    const fromWindow = window.HANNUNCHECK_CONFIG?.KAKAO_MAP_JS_KEY || window.HANNUNCALC_CONFIG?.KAKAO_MAP_JS_KEY || window.KAKAO_MAP_JS_KEY;
    if (fromWindow) return fromWindow;
    const meta = document.querySelector('meta[name="kakao-map-js-key"]')?.content?.trim();
    if (meta) return meta;
    try {
      const config = await fetchJson('/api/config', { cache: 'no-store' });
      return config?.kakaoMapJsKey || '';
    } catch (_) {
      return '';
    }
  };

  const clearKakaoOverlays = () => {
    state.kakaoOverlays.forEach((overlay) => overlay?.setMap?.(null));
    state.kakaoOverlays = [];
  };

  const setMapFallbackMessage = (title, message) => {
    if (!elements.mapNotice) return;
    elements.mapNotice.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  };

  const initKakaoMap = async () => {
    if (!elements.map || state.mapLoadStarted) return;
    state.mapLoadStarted = true;
    try {
      const key = await resolveKakaoMapKey();
      if (!key) throw new Error('NO_KAKAO_MAP_JS_KEY');
      await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`);
      if (!window.kakao?.maps?.load) throw new Error('카카오맵 SDK 객체를 찾지 못했습니다.');
      await new Promise((resolve) => window.kakao.maps.load(resolve));
      const center = getMapCenter();
      state.map = new window.kakao.maps.Map(elements.map, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level: state.careMode === 'emergency' ? 6 : 5,
      });
      state.kakaoReady = true;
      elements.map.classList.remove('is-fallback');
      renderMap(state.items);
    } catch (error) {
      state.kakaoReady = false;
      state.map = null;
      elements.map?.classList.add('is-fallback');
      setMapFallbackMessage('지도 안내 모드', error?.message === 'NO_KAKAO_MAP_JS_KEY'
        ? 'KAKAO_MAP_JS_KEY를 설정하면 실제 카카오 지도가 표시됩니다.'
        : '카카오맵을 불러오지 못해 기본 지도 안내 모드로 표시합니다.');
      renderMap(state.items);
    }
  };

  const makeKakaoMarkerElement = (item, index) => {
    const button = document.createElement('button');
    const tone = item.statusTone || (Number(item.emergencyBeds) > 0 ? 'good' : 'neutral');
    button.type = 'button';
    button.className = `emergency-kakao-marker ${tone} ${state.selectedId === item.id ? 'selected' : ''}`;
    button.setAttribute('aria-label', item.name || meta().label);
    button.dataset.hospitalId = item.id || '';
    button.innerHTML = `<span>${index + 1}</span><strong>${escapeHtml(markerText(item))}</strong>`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      state.selectedId = item.id;
      render();
    });
    return button;
  };

  const renderKakaoMap = (items) => {
    if (!state.kakaoReady || !state.map || !window.kakao?.maps) return false;
    clearKakaoOverlays();
    const center = getMapCenter(items);
    const validItems = mappableItems(items).slice(0, 40);

    if (typeof state.map.relayout === 'function') {
      state.map.relayout();
    }

    if (!items.length) {
      state.map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      state.map.setLevel(state.careMode === 'emergency' ? 7 : 6);
      return true;
    }

    if (!validItems.length) {
      state.map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      state.map.setLevel(state.careMode === 'emergency' ? 7 : 6);
      setMapFallbackMessage('지도 위치 확인 필요', '좌표가 제공되지 않은 기관은 목록과 상세 정보에서 확인해 주세요.');
      return true;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    validItems.forEach((item, index) => {
      const position = new window.kakao.maps.LatLng(Number(item.lat), Number(item.lng));
      bounds.extend(position);
      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        yAnchor: 1,
        zIndex: state.selectedId === item.id ? 30 : 20,
        content: makeKakaoMarkerElement(item, index),
      });
      overlay.setMap(state.map);
      state.kakaoOverlays.push(overlay);
    });

    if (state.kakaoOverlays.length > 1) {
      state.map.setBounds(bounds, 56, 56, 56, 56);
    } else {
      const target = validItems[0];
      state.map.setCenter(new window.kakao.maps.LatLng(Number(target.lat), Number(target.lng)));
      state.map.setLevel(5);
    }
    setTimeout(() => {
      if (typeof state.map?.relayout === 'function') state.map.relayout();
      window.kakao?.maps?.event?.trigger?.(state.map, 'resize');
    }, 80);
    return true;
  };

  const formatCriticalSummary = (item) => {
    const total = Array.isArray(item.criticalCare) ? item.criticalCare.length : 0;
    const good = Number(item.criticalAvailableCount || countGood(item.criticalCare));
    if (!total) return '전화 확인';
    return `${good}개 참고`;
  };

  const formatFacilitySummary = (item) => {
    const total = Array.isArray(item.facilityStatus) ? item.facilityStatus.length : 0;
    const good = Number(item.facilityAvailableCount || countGood(item.facilityStatus));
    if (!total) return '확인 필요';
    return `${good}/${total} 가능`;
  };

  const sortItems = (items, sort) => [...items].sort((a, b) => {
    if (sort === 'beds') return numberOrNeg(b.emergencyBeds) - numberOrNeg(a.emergencyBeds) || numberOrMax(a.distanceM) - numberOrMax(b.distanceM);
    if (sort === 'phone') return Number(Boolean(b.emergencyTel || b.mainTel)) - Number(Boolean(a.emergencyTel || a.mainTel)) || numberOrMax(a.distanceM) - numberOrMax(b.distanceM);
    if (sort === 'critical') return numberOrNeg(b.criticalAvailableCount) - numberOrNeg(a.criticalAvailableCount) || numberOrNeg(b.emergencyBeds) - numberOrNeg(a.emergencyBeds) || numberOrMax(a.distanceM) - numberOrMax(b.distanceM);
    if (sort === 'night') return Number(Boolean(b.isNightCandidate)) - Number(Boolean(a.isNightCandidate)) || numberOrNeg(b.closeMinutes) - numberOrNeg(a.closeMinutes) || numberOrMax(a.distanceM) - numberOrMax(b.distanceM);
    return numberOrMax(a.distanceM) - numberOrMax(b.distanceM);
  });

  const renderSummary = (items) => {
    const count = items.length;
    const phoneCount = items.filter((item) => item.emergencyTel || item.mainTel).length;
    const nearest = items.find((item) => Number.isFinite(Number(item.distanceM)));
    if (state.careMode === 'emergency') {
      const withBeds = items.filter((item) => Number.isFinite(Number(item.emergencyBeds)) && Number(item.emergencyBeds) > 0).length;
      const criticalCount = items.filter((item) => Number(item.criticalAvailableCount) > 0).length;
      const messageCount = items.filter((item) => Array.isArray(item.messages) && item.messages.length).length;
      elements.summaryCount.innerHTML = `<span>조회 후보</span><strong>${count.toLocaleString('ko-KR')}곳</strong><small>${escapeHtml(getRegionLabel())} · 응급실 상태 확인</small>`;
      elements.summaryBeds.innerHTML = `<span>가용 병상 표시</span><strong>${withBeds.toLocaleString('ko-KR')}곳</strong><small>공공데이터 기준 · 전화 확인 필요</small>`;
      elements.summaryPhone.innerHTML = `<span>전화 가능 후보</span><strong>${phoneCount.toLocaleString('ko-KR')}곳</strong><small>${nearest && hasUsableDistance(nearest.distanceM) ? `가까운 후보 ${formatDistanceSafe(nearest.distanceM)}` : '전화 확인 우선'}</small>`;
      if (elements.summaryStatus) elements.summaryStatus.innerHTML = `<span>중증·상태 정보</span><strong>${criticalCount.toLocaleString('ko-KR')}곳</strong><small>${messageCount ? `상태 메시지 ${messageCount}곳` : '병상 외 상태 정보 참고'}</small>`;
      return;
    }
    const nightCount = items.filter((item) => item.isNightCandidate).length;
    elements.summaryCount.innerHTML = `<span>조회 후보</span><strong>${count.toLocaleString('ko-KR')}곳</strong><small>${escapeHtml(getRegionLabel())} · ${escapeHtml(meta().label)} 확인</small>`;
    elements.summaryBeds.innerHTML = `<span>야간 운영 참고</span><strong>${nightCount.toLocaleString('ko-KR')}곳</strong><small>운영시간 기준 · 접수 마감 전화 확인</small>`;
    elements.summaryPhone.innerHTML = `<span>전화 가능 후보</span><strong>${phoneCount.toLocaleString('ko-KR')}곳</strong><small>${nearest && hasUsableDistance(nearest.distanceM) ? `가까운 후보 ${formatDistanceSafe(nearest.distanceM)}` : '전화 확인 우선'}</small>`;
    if (elements.summaryStatus) elements.summaryStatus.innerHTML = `<span>운영시간 표시</span><strong>${items.filter((item) => item.operationTime).length.toLocaleString('ko-KR')}곳</strong><small>공공데이터 기준 운영시간 참고</small>`;
  };

  const makeMapPosition = (item, index, total) => {
    if (hasMapCoordinates(item) && state.geo) {
      const dx = (Number(item.lng) - state.geo.lng) * 1200;
      const dy = (state.geo.lat - Number(item.lat)) * 1400;
      return { x: Math.min(88, Math.max(12, 50 + dx)), y: Math.min(86, Math.max(14, 50 + dy)) };
    }
    const base = [{ x: 28, y: 35 }, { x: 55, y: 48 }, { x: 72, y: 30 }, { x: 42, y: 66 }, { x: 63, y: 72 }, { x: 18, y: 60 }];
    return base[index % base.length] || { x: 50 + (index % Math.max(total, 1)) * 4, y: 50 };
  };

  const markerText = (item) => {
    if (isEmergencyItem(item)) return formatBeds(item.emergencyBeds);
    return item.operationTime ? item.operationTime.split('~').pop().trim() : '전화 확인';
  };

  const renderMap = (items) => {
    if (elements.mapTitle) elements.mapTitle.textContent = `${state.summary.criteria || getRegionLabel()} ${meta().mapSuffix}`;
    const isIdle = state.dataMode === 'idle';
    if (elements.mapNotice) {
      const noCoordCount = items.length - mappableItems(items).length;
      const notice = noCoordCount > 0
        ? `좌표 없는 ${noCoordCount}곳은 목록에서만 확인해 주세요.`
        : (state.careMode === 'emergency'
          ? '중증·장비 상태도 참고용입니다. 방문 전 전화 확인이 필요합니다.'
          : '운영시간은 참고용입니다. 야간 접수와 조제 가능 여부는 전화 확인이 필요합니다.');
      elements.mapNotice.innerHTML = isIdle
        ? `<strong>조회 전</strong><span>확인 버튼을 누르면 실제 지도와 목록에 공공데이터 기준 후보를 표시합니다.</span>`
        : `<strong>공공데이터 기준</strong><span>${notice}</span>`;
    }

    const renderedKakao = renderKakaoMap(items);
    if (renderedKakao) {
      if (elements.markers) elements.markers.innerHTML = '';
      return;
    }

    clearKakaoOverlays();
    if (elements.map) elements.map.classList.add('is-fallback');
    elements.markers.innerHTML = items.slice(0, 12).map((item, index) => {
      const pos = makeMapPosition(item, index, items.length);
      const tone = item.statusTone || (Number(item.emergencyBeds) > 0 ? 'good' : 'neutral');
      return `<button type="button" class="emergency-map-marker ${escapeHtml(tone)} ${state.selectedId === item.id ? 'selected' : ''}" style="left:${pos.x}%;top:${pos.y}%" data-hospital-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)}"><span>${index + 1}</span><strong>${escapeHtml(markerText(item))}</strong></button>`;
    }).join('');
  };

  const renderStatusChips = (item) => {
    if (!isEmergencyItem(item)) {
      const chips = [
        item.operationTime ? { text: `운영 ${item.operationTime}`, tone: item.isNightCandidate ? 'good' : 'neutral' } : { text: '운영시간 전화 확인', tone: 'caution' },
        item.department ? { text: item.department, tone: 'neutral' } : null,
        item.hospitalType ? { text: item.hospitalType, tone: 'neutral' } : null,
      ].filter(Boolean).slice(0, 4);
      return `<div class="emergency-status-chip-row">${chips.map((chip) => `<span class="emergency-mini-chip ${escapeHtml(chip.tone || 'neutral')}">${escapeHtml(chip.text)}</span>`).join('')}</div>`;
    }
    const critical = (item.criticalCare || []).slice(0, 4).map((entry) => ({ text: `${entry.label} ${entry.tone === 'good' ? '가능' : '확인'}`, tone: entry.tone }));
    const facility = (item.facilityStatus || []).slice(0, 3).map((entry) => ({ text: `${entry.label} ${entry.tone === 'good' ? '가능' : '확인'}`, tone: entry.tone }));
    const combined = [...critical, ...facility].slice(0, 6);
    if (!combined.length) combined.push({ text: '세부 상태 전화 확인', tone: 'neutral' });
    return `<div class="emergency-status-chip-row">${combined.map((chip) => `<span class="emergency-mini-chip ${escapeHtml(chip.tone || 'neutral')}">${escapeHtml(chip.text)}</span>`).join('')}</div>`;
  };

  const renderList = (items) => {
    elements.listSummary.textContent = items.length ? `조회 결과 ${items.length}곳` : '조회 전';
    if (elements.listTitle) elements.listTitle.textContent = meta().listLabel;
    if (!items.length) {
      elements.list.innerHTML = state.dataMode === 'idle'
        ? `<div class="hc-empty-state"><strong>조회 전입니다</strong><p>지도 위 검색창과 조건 버튼을 선택한 뒤 검색을 눌러 주세요.</p></div>`
        : `<div class="hc-empty-state"><strong>${escapeHtml(meta().label)} 정보를 찾지 못했습니다</strong><p>지역을 바꾸거나 긴급 상황이면 119 또는 기관 전화로 확인해 주세요.</p></div>`;
      if (elements.mobileResults) elements.mobileResults.innerHTML = elements.list.innerHTML;
      if (elements.mobileSheetTitle) elements.mobileSheetTitle.textContent = meta().listLabel;
      if (elements.mobileSheetSubtitle) elements.mobileSheetSubtitle.textContent = state.dataMode === 'idle' ? '검색하면 가까운 후보를 표시합니다.' : '조건에 맞는 후보가 없습니다.';
      return;
    }

    const compactCard = (item, index) => {
      const phone = item.emergencyTel || item.mainTel || '';
      const kakaoAction = getKakaoAction(item);
      const isEmergency = isEmergencyItem(item);
      const distanceText = formatDistanceSafe(item.distanceM);
      const primaryParts = isEmergency
        ? [formatBeds(item.emergencyBeds), distanceText]
        : [item.operationTime || '운영시간 전화 확인', distanceText];
      const primaryInfo = primaryParts.filter(Boolean).join(' · ');
      const phoneText = phone ? '전화 있음' : '전화 확인 필요';
      const locationText = hasMapCoordinates(item) ? '지도 표시' : '지도 위치 확인 필요';
      const statusText = isEmergency
        ? (Number(item.criticalAvailableCount) > 0 ? '중증 정보 참고' : '중증 정보 확인')
        : (item.isNightCandidate ? '야간 운영 참고' : '운영 확인 필요');
      const mapTone = hasMapCoordinates(item) ? 'good' : 'caution';
      return `<article class="parking-result-card emergency-hospital-card emergency-hospital-card--ev emergency-hospital-card--compact ${state.selectedId === item.id ? 'selected' : ''}" data-hospital-id="${escapeHtml(item.id)}">
        <div class="emergency-rank"><span>${index + 1}</span></div>
        <div class="emergency-main">
          <div class="parking-card-head emergency-title-row">
            <strong class="emergency-card-name">${escapeHtml(item.name || meta().label)}</strong>
            <span class="emergency-status ${escapeHtml(item.statusTone || 'neutral')}">${escapeHtml(item.statusLabel || '전화 확인 필요')}</span>
          </div>
          <p class="emergency-card-summary">${escapeHtml([primaryInfo, phoneText].filter(Boolean).join(' · '))}</p>
          <div class="emergency-status-chip-row emergency-status-chip-row--compact">
            <span class="emergency-mini-chip ${mapTone}">${escapeHtml(locationText)}</span>
            <span class="emergency-mini-chip neutral">${escapeHtml(statusText)}</span>
          </div>
        </div>
        <div class="parking-card-actions emergency-actions emergency-actions--compact">
          ${phone ? `<a class="primary-mini-link" href="${buildTelLink(phone)}">전화</a>` : '<span class="secondary-mini-link disabled">전화 확인</span>'}
          <a class="secondary-mini-link" href="${kakaoAction.url}" target="_blank" rel="noopener">${escapeHtml(kakaoAction.label)}</a>
          <button type="button" class="secondary-mini-link as-button" data-detail-id="${escapeHtml(item.id)}">상세</button>
        </div>
      </article>`;
    };

    elements.list.innerHTML = items.map(compactCard).join('');
    if (elements.mobileResults) elements.mobileResults.innerHTML = elements.list.innerHTML;
    if (elements.mobileSheetTitle) elements.mobileSheetTitle.textContent = meta().listLabel;
    if (elements.mobileSheetSubtitle) elements.mobileSheetSubtitle.textContent = items.length ? `${items.length.toLocaleString('ko-KR')}곳 · 방문 전 전화 확인` : '검색하면 가까운 후보를 표시합니다.';
  };

  const renderWarnings = () => {
    const warnings = [...state.warnings];
    if (!warnings.length) {
      warnings.push(state.careMode === 'emergency'
        ? '응급실 가용 병상과 중증질환 수용가능정보는 제공 시점 기준입니다. 실제 수용 가능 여부는 반드시 전화로 확인해 주세요.'
        : '야간 병원·약국 운영시간은 공공데이터 기준 참고 정보입니다. 접수 마감과 조제 가능 여부는 반드시 전화로 확인해 주세요.');
    }
    elements.warningList.innerHTML = warnings.map((warning) => `<p>${escapeHtml(typeof warning === 'string' ? warning : warning.message || '확인 안내가 있습니다.')}</p>`).join('');
  };

  const renderStatusGroup = (title, items, emptyText) => {
    if (!Array.isArray(items) || !items.length) return `<div class="emergency-status-group"><h4>${escapeHtml(title)}</h4><p class="fine-print">${escapeHtml(emptyText)}</p></div>`;
    return `<div class="emergency-status-group"><h4>${escapeHtml(title)}</h4><div class="emergency-status-chip-row detail">${items.slice(0, 10).map((entry) => `<span class="emergency-mini-chip ${escapeHtml(entry.tone || 'neutral')}">${escapeHtml(entry.label || '항목')} · ${escapeHtml(entry.value || entry.label || '확인')}</span>`).join('')}</div></div>`;
  };

  const renderMessages = (item) => {
    const messages = Array.isArray(item.messages) ? item.messages : [];
    if (!messages.length) return '<p class="fine-print">응급실·중증질환 메시지가 없거나 제공되지 않았습니다.</p>';
    return `<div class="emergency-message-box">${messages.map((message) => `<p><strong>${escapeHtml(message.type || '상태 메시지')}</strong>${escapeHtml(message.message || '전화 확인이 필요합니다.')}</p>`).join('')}</div>`;
  };

  const renderDetail = (item) => {
    if (!elements.detail) return;
    if (!item) {
      elements.detail.hidden = true;
      elements.detail.innerHTML = '';
      if (elements.mobileDetail) {
        elements.mobileDetail.hidden = true;
        elements.mobileDetail.innerHTML = '';
      }
      return;
    }
    elements.detail.hidden = false;
    if (elements.mobileDetail) elements.mobileDetail.hidden = false;
    const phone = item.emergencyTel || item.mainTel || '';
    const kakaoAction = getKakaoAction(item);
    const kakaoUrl = kakaoAction.url;
    const kakaoLabel = kakaoAction.label;
    const distanceText = formatDistanceSafe(item.distanceM) || '거리 정보 없음';
    const mapText = hasMapCoordinates(item) ? '지도 표시 가능' : '지도 위치 확인 필요';
    if (!isEmergencyItem(item)) {
      elements.detail.innerHTML = `<h3>${escapeHtml(item.name || meta().label)}</h3>
        <p class="emergency-detail-address">${escapeHtml(item.address || '주소 정보 없음')}</p>
        <div class="emergency-detail-grid">
          <div><span>운영시간</span><strong>${escapeHtml(item.operationTime || '전화 확인')}</strong></div>
          <div><span>기관 유형</span><strong>${escapeHtml(item.hospitalType || meta().label)}</strong></div>
          <div><span>전화</span><strong>${escapeHtml(phone || '전화 확인')}</strong></div>
          <div><span>거리</span><strong>${escapeHtml(distanceText)}</strong></div>
          <div><span>지도</span><strong>${escapeHtml(mapText)}</strong></div>
        </div>
        <div class="emergency-status-group"><h4>야간 방문 전 확인</h4><p class="fine-print">운영시간은 공공데이터 기준 참고 정보입니다. 접수 마감, 처방·조제 가능 여부, 휴게시간은 기관 전화로 다시 확인해 주세요.</p></div>
        <p class="fine-print">${escapeHtml(item.updatedAt ? `갱신 정보: ${item.updatedAt}` : '갱신 시점 정보가 없으면 기관에 직접 확인해 주세요.')}</p>
        <div class="emergency-detail-actions">
          ${phone ? `<a class="primary-link" href="${buildTelLink(phone)}">전화하기</a>` : ''}
          <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">${escapeHtml(kakaoLabel)}</a>
        </div>`;
      if (elements.mobileDetail) elements.mobileDetail.innerHTML = elements.detail.innerHTML;
      return;
    }
    elements.detail.innerHTML = `<h3>${escapeHtml(item.name || '응급의료기관')}</h3>
      <p class="emergency-detail-address">${escapeHtml(item.address || '주소 정보 없음')}</p>
      <div class="emergency-detail-grid">
        <div><span>가용 병상</span><strong>${formatBeds(item.emergencyBeds)}</strong></div>
        <div><span>중증질환 참고</span><strong>${escapeHtml(formatCriticalSummary(item))}</strong></div>
        <div><span>전화</span><strong>${escapeHtml(phone || '전화 확인')}</strong></div>
        <div><span>거리</span><strong>${escapeHtml(distanceText)}</strong></div>
        <div><span>지도</span><strong>${escapeHtml(mapText)}</strong></div>
      </div>
      ${renderStatusGroup('중증질환 수용가능정보', item.criticalCare, '중증질환 수용가능정보가 없으면 119 또는 병원 전화로 확인해 주세요.')}
      ${renderStatusGroup('장비·시설 상태', item.facilityStatus, '장비·시설 상태 정보가 없으면 전화 확인이 필요합니다.')}
      <div class="emergency-status-group"><h4>응급실 메시지</h4>${renderMessages(item)}</div>
      <p class="fine-print">${escapeHtml(item.statusUpdatedAt || item.updatedAt ? `갱신 정보: ${item.statusUpdatedAt || item.updatedAt}` : '갱신 시점 정보가 없으면 병원에 직접 확인해 주세요.')}</p>
      <div class="emergency-detail-actions">
        ${phone ? `<a class="primary-link" href="${buildTelLink(phone)}">전화하기</a>` : ''}
        <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">${escapeHtml(kakaoLabel)}</a>
      </div>`;
    if (elements.mobileDetail) elements.mobileDetail.innerHTML = elements.detail.innerHTML;
  };

  const render = () => {
    const items = state.items;
    renderSummary(items);
    renderMap(items);
    renderList(items);
    renderWarnings();
    renderDetail(items.find((item) => item.id === state.selectedId) || items[0] || null);
  };

  const syncModeUi = () => {
    elements.modeTabs.forEach((button) => button.classList.toggle('active', button.dataset.careMode === state.careMode));
    if (elements.submit) elements.submit.textContent = meta().searchLabel;
    if (elements.department) {
      elements.department.closest('.form-row')?.classList.toggle('is-hidden', state.careMode === 'pharmacy' || state.careMode === 'emergency');
    }
    elements.quickButtons.forEach((button) => {
      const sort = button.dataset.emergencySort || button.dataset.emergencyMapSort || button.dataset.emergencyMobileSort;
      button.classList.toggle('is-hidden', (state.careMode === 'emergency' && sort === 'night') || (state.careMode !== 'emergency' && sort === 'critical') || (state.careMode !== 'emergency' && sort === 'beds'));
      button.classList.toggle('active', sort === (elements.sort?.value || 'distance'));
    });
    syncToolbarInputs();
  };

  const resetToIdle = () => {
    state.dataMode = 'idle';
    state.items = [];
    state.summary = { criteria: getRegionLabel() };
    state.warnings = [];
    state.selectedId = '';
    syncModeUi();
    setStatus(`조건을 선택한 뒤 ${meta().searchLabel}를 눌러 주세요.`, 'info');
    render();
    elements.mobileSheet?.classList.remove('is-open', 'is-expanded');
    elements.mobileSheet?.classList.add('is-collapsed');
    if (elements.mobileListToggle) {
      elements.mobileListToggle.setAttribute('aria-expanded', 'false');
      elements.mobileListToggle.textContent = '목록 보기';
    }
  };

  const buildApiUrl = () => {
    const params = new URLSearchParams({
      region: elements.region?.value || '서울',
      district: elements.district?.value || '',
      keyword: elements.keyword?.value || '',
      department: elements.department?.value || '',
      sort: elements.sort?.value || (state.careMode === 'emergency' ? 'distance' : 'night'),
      mode: state.careMode,
      _v: 'v94',
    });
    if (state.geo) {
      params.set('lat', String(state.geo.lat));
      params.set('lng', String(state.geo.lng));
    }
    return `/api/emergency-hospitals?${params.toString()}`;
  };

  const searchHospitals = async () => {
    if (state.loading) return;
    state.loading = true;
    setStatus(`${meta().label} 정보를 불러오는 중입니다. 응급 상황이면 119에 먼저 연락하세요.`, 'info');
    const localFallback = filterEmergencyCache();
    if (localFallback.length) {
      state.dataMode = 'cache';
      state.items = localFallback;
      state.summary = { criteria: `${getRegionLabel()} 응급실 기본정보 캐시`, count: localFallback.length, sourceMode: 'local_emergency_cache' };
      state.warnings = ['응급실 기본정보와 지도 위치는 로컬 캐시 기준입니다. 실시간 병상·중증 정보는 공공데이터 응답으로 보강합니다.'];
      state.selectedId = state.items[0]?.id || '';
      render();
    }
    try {
      const data = await fetchJson(buildApiUrl(), { cache: 'no-store' });
      if (data?.ok === false) throw Object.assign(new Error(data.message || `${meta().label} 정보를 불러오지 못했습니다.`), { data });
      state.dataMode = 'api';
      const apiItems = mergeEmergencyCacheBasics(Array.isArray(data.items) ? data.items : []);
      state.items = apiItems.length ? apiItems : localFallback;
      state.summary = data.summary || (localFallback.length ? { criteria: `${getRegionLabel()} 응급실 기본정보 캐시`, count: localFallback.length, sourceMode: 'local_emergency_cache' } : {});
      state.warnings = Array.isArray(data.warnings) ? data.warnings : [];
      if (!apiItems.length && localFallback.length) {
        state.dataMode = 'cache';
        state.warnings.push('실시간 응급실 상태 정보는 확인하지 못해 로컬 기본정보 캐시를 표시합니다. 방문 전 전화 확인이 필요합니다.');
      }
      state.selectedId = state.items[0]?.id || '';
      const suffix = state.careMode === 'emergency' ? '중증·상태 정보도 방문 전 전화 확인이 필요합니다.' : '운영시간과 접수 마감은 방문 전 전화 확인이 필요합니다.';
      setStatus(`${state.items.length.toLocaleString('ko-KR')}곳의 ${meta().label} 정보를 확인했습니다. ${suffix}`, 'success');
      render();
    } catch (error) {
      const message = error?.data?.message || error?.message || `${meta().label} 정보를 불러오지 못했습니다.`;
      if (localFallback.length) {
        state.dataMode = 'cache';
        state.items = localFallback;
        state.summary = { criteria: `${getRegionLabel()} 응급실 기본정보 캐시`, count: localFallback.length, sourceMode: 'local_emergency_cache' };
        state.warnings = [message, '실시간 병상·중증 정보는 확인하지 못해 로컬 기본정보 캐시를 표시합니다. 실제 방문 전 전화 확인이 필요합니다.'];
        state.selectedId = state.items[0]?.id || '';
        setStatus(`실시간 상태 정보는 확인하지 못했지만 ${localFallback.length.toLocaleString('ko-KR')}곳의 기본정보 캐시를 표시합니다.`, 'warning');
        render();
      } else {
        setStatus(`${message} 응급 상황이면 119에 먼저 연락해 주세요.`, 'error');
        state.warnings = [message, '실제 방문 전 전화 확인이 필요합니다.'];
        renderWarnings();
      }
    } finally {
      state.loading = false;
    }
  };


  elements.mapModeToggle?.addEventListener('click', () => toggleToolbarPanel(elements.mapModeToggle, elements.mapModePanel));
  elements.mapRegionToggle?.addEventListener('click', () => toggleToolbarPanel(elements.mapRegionToggle, elements.mapRegionPanel));
  elements.mapSortToggle?.addEventListener('click', () => toggleToolbarPanel(elements.mapSortToggle, elements.mapSortPanel));
  elements.mobileSortButton?.addEventListener('click', () => toggleToolbarPanel(elements.mobileSortButton, elements.mobileSheetSort));

  elements.mapToolbarSearch?.addEventListener('submit', (event) => {
    event.preventDefault();
    syncFromToolbar();
    searchHospitals();
  });

  elements.mapRegionApply?.addEventListener('click', () => {
    syncFromToolbar();
    closeToolbarPopovers();
    resetToIdle();
  });

  elements.mapRegion?.addEventListener('change', () => { syncFromToolbar(); });
  elements.mapDistrict?.addEventListener('input', () => { if (elements.district) elements.district.value = elements.mapDistrict.value || ''; syncToolbarInputs(); });
  elements.mapKeyword?.addEventListener('input', () => { if (elements.keyword) elements.keyword.value = elements.mapKeyword.value || ''; });

  elements.mapModeButtons?.forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.emergencyMapMode;
      if (!MODE_META[next]) return;
      state.careMode = next;
      if (state.careMode !== 'emergency' && ['beds', 'critical'].includes(elements.sort?.value)) elements.sort.value = 'night';
      if (state.careMode === 'emergency' && elements.sort?.value === 'night') elements.sort.value = 'distance';
      closeToolbarPopovers();
      resetToIdle();
    });
  });

  elements.mapSortButtons?.forEach((button) => {
    button.addEventListener('click', () => {
      const sort = button.dataset.emergencyMapSort;
      if (sort && elements.sort) elements.sort.value = sort;
      closeToolbarPopovers();
      syncModeUi();
      if (state.items.length) {
        state.items = sortItems(state.items, elements.sort.value || 'distance');
        state.selectedId = state.items[0]?.id || state.selectedId;
        render();
      }
    });
  });

  document.querySelectorAll('[data-emergency-mobile-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const sort = button.dataset.emergencyMobileSort;
      if (sort && elements.sort) elements.sort.value = sort;
      closeToolbarPopovers();
      syncModeUi();
      if (state.items.length) {
        state.items = sortItems(state.items, elements.sort.value || 'distance');
        state.selectedId = state.items[0]?.id || state.selectedId;
        render();
      }
    });
  });

  elements.mapLocation?.addEventListener('click', () => elements.location?.click());

  elements.mobileListToggle?.addEventListener('click', () => {
    const open = !elements.mobileSheet?.classList.contains('is-open');
    elements.mobileSheet?.classList.toggle('is-open', open);
    elements.mobileSheet?.classList.toggle('is-expanded', open);
    elements.mobileSheet?.classList.toggle('is-collapsed', !open);
    elements.mobileListToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    elements.mobileListToggle.textContent = open ? '목록 접기' : '목록 보기';
  });

  elements.mobileSheetMapButton?.addEventListener('click', () => {
    elements.mobileSheet?.classList.remove('is-open', 'is-expanded');
    elements.mobileSheet?.classList.add('is-collapsed');
    if (elements.mobileListToggle) {
      elements.mobileListToggle.setAttribute('aria-expanded', 'false');
      elements.mobileListToggle.textContent = '목록 보기';
    }
  });

  [elements.list, elements.mobileResults].forEach((listEl) => listEl?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest('[data-hospital-id]');
    const id = target?.getAttribute('data-detail-id') || card?.getAttribute('data-hospital-id');
    if (!id) return;
    state.selectedId = id;
    render();
  }));

  elements.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    searchHospitals();
  });

  elements.modeTabs.forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.careMode;
      if (!MODE_META[next]) return;
      state.careMode = next;
      if (state.careMode !== 'emergency' && ['beds', 'critical'].includes(elements.sort?.value)) elements.sort.value = 'night';
      if (state.careMode === 'emergency' && elements.sort?.value === 'night') elements.sort.value = 'distance';
      resetToIdle();
    });
  });

  elements.location?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('이 브라우저에서는 현재 위치를 사용할 수 없습니다.', 'error');
      return;
    }
    setStatus('현재 위치 권한을 확인하는 중입니다.', 'info');
    navigator.geolocation.getCurrentPosition((position) => {
      state.geo = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
      setStatus(`현재 위치가 적용되었습니다. ${meta().searchLabel}를 누르면 위치 기준으로 조회합니다.`, 'success');
    }, () => {
      setStatus('현재 위치를 가져오지 못했습니다. 지역 기준으로 조회해 주세요.', 'error');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 180000 });
  });

  elements.quickButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sort = button.dataset.emergencySort || button.dataset.emergencyMapSort || button.dataset.emergencyMobileSort;
      if (sort && elements.sort) elements.sort.value = sort;
      syncModeUi();
      
    });
  });

  elements.markers?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-hospital-id]') : null;
    const id = target?.getAttribute('data-hospital-id');
    if (!id) return;
    state.selectedId = id;
    render();
  });

  ['change', 'input'].forEach((eventName) => {
    elements.region?.addEventListener(eventName, () => { syncToolbarInputs(); });
    elements.district?.addEventListener(eventName, () => { syncToolbarInputs(); });
    elements.keyword?.addEventListener(eventName, () => { syncToolbarInputs(); });
    elements.sort?.addEventListener(eventName, () => { syncModeUi();  });
  });

  resetToIdle();
  initKakaoMap();
  loadKakaoPlaceCache();
  loadEmergencyNationalCache();
})();
