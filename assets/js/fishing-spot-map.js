(() => {
  'use strict';

  const root = document.querySelector('[data-fishing-map-tool]');
  if (!root) return;

  const CACHE_BASE = '/assets/data/life/fishing-spots';
  const MAX_LIST = 80;
  const MAX_MARKERS = 220;
  const VERSION = 'v126-life-maps-ui-polish-final';
  const REGION_CENTERS = {
    seoul: { lat: 37.5665, lng: 126.9780, label: '서울' },
    busan: { lat: 35.1796, lng: 129.0756, label: '부산' },
    daegu: { lat: 35.8714, lng: 128.6014, label: '대구' },
    incheon: { lat: 37.4563, lng: 126.7052, label: '인천' },
    gwangju: { lat: 35.1595, lng: 126.8526, label: '광주' },
    daejeon: { lat: 36.3504, lng: 127.3845, label: '대전' },
    ulsan: { lat: 35.5384, lng: 129.3114, label: '울산' },
    sejong: { lat: 36.4800, lng: 127.2890, label: '세종' },
    gyeonggi: { lat: 37.4138, lng: 127.5183, label: '경기' },
    gangwon: { lat: 37.8228, lng: 128.1555, label: '강원' },
    chungbuk: { lat: 36.6357, lng: 127.4913, label: '충북' },
    chungnam: { lat: 36.5184, lng: 126.8000, label: '충남' },
    jeonbuk: { lat: 35.7167, lng: 127.1442, label: '전북' },
    jeonnam: { lat: 34.8161, lng: 126.4629, label: '전남' },
    gyeongbuk: { lat: 36.4919, lng: 128.8889, label: '경북' },
    gyeongnam: { lat: 35.4606, lng: 128.2132, label: '경남' },
    jeju: { lat: 33.4996, lng: 126.5312, label: '제주' },
  };

  const elements = {
    form: root.querySelector('#fishing-form'),
    region: root.querySelector('#fishing-region'),
    district: root.querySelector('#fishing-district'),
    keyword: root.querySelector('#fishing-keyword'),
    type: root.querySelector('#fishing-type'),
    fish: root.querySelector('#fishing-fish'),
    sort: root.querySelector('#fishing-sort'),
    hasFee: root.querySelector('#fishing-has-fee'),
    hasPhone: root.querySelector('#fishing-has-phone'),
    hasSafety: root.querySelector('#fishing-has-safety'),
    hasConvenience: root.querySelector('#fishing-has-convenience'),
    useLocation: root.querySelector('#fishing-use-location'),
    mapLocation: root.querySelector('#fishing-map-location'),
    filterToggle: root.querySelector('[data-life-filter-toggle]'),
    status: root.querySelector('#fishing-status'),
    formStatus: root.querySelector('#fishing-form-status'),
    listTitle: root.querySelector('#fishing-list-title'),
    listSummary: root.querySelector('#fishing-list-summary'),
    listSubtitle: root.querySelector('#fishing-list-subtitle'),
    resultList: root.querySelector('#fishing-result-list'),
    mobileResults: root.querySelector('#fishing-mobile-results'),
    mobileTitle: root.querySelector('#fishing-mobile-sheet-title'),
    mobileSubtitle: root.querySelector('#fishing-mobile-sheet-subtitle'),
    mobileToggle: root.querySelector('#fishing-mobile-list-toggle'),
    mobileSheet: root.querySelector('#fishing-mobile-bottom-sheet'),
    mobileMapButton: root.querySelector('#fishing-mobile-sheet-map-button'),
    countCard: root.querySelector('#fishing-count-card'),
    phoneCard: root.querySelector('#fishing-phone-card'),
    feeCard: root.querySelector('#fishing-fee-card'),
    sortButtons: Array.from(root.querySelectorAll('[data-fishing-sort]')),
    map: root.querySelector('#fishing-map'),
    markers: root.querySelector('#fishing-map-markers'),
    mapNotice: root.querySelector('#fishing-map-notice'),
    mapTitle: root.querySelector('#fishing-map-title'),
    selectedCard: root.querySelector('#fishing-selected-card'),
    mapToolbarSearch: root.querySelector('#fishing-map-toolbar-search'),
    mapKeyword: root.querySelector('#fishing-map-keyword'),
    mapRegion: root.querySelector('#fishing-map-region'),
  };

  const state = {
    index: null,
    regionCache: new Map(),
    currentRegion: 'seoul',
    rawItems: [],
    items: [],
    selectedId: '',
    geo: null,
    referencePoint: null,
    map: null,
    kakaoReady: false,
    mapLoadStarted: false,
    overlays: [],
    fallbackMarkers: [],
    lastRenderSignature: '',
    loading: false,
    mobileOpen: false,
    requestId: 0,
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const normalize = (value) => String(value ?? '').trim();
  const normalizeSearch = (value) => normalize(value).toLowerCase().replace(/\s+/g, ' ');
  const hasText = (value) => normalize(value).length > 0;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const isValidPoint = (item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng));
  const regionLabel = (key = state.currentRegion) => state.index?.regions?.find((region) => region.key === key)?.label || REGION_CENTERS[key]?.label || '서울';
  const currentRegionCenter = () => REGION_CENTERS[state.currentRegion] || REGION_CENTERS.seoul;
  const buildTelLink = (phone) => phone ? `tel:${String(phone).replace(/[^0-9+]/g, '')}` : '';

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, { cache: options.cache || 'default' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  };

  const setStatus = (message, tone = 'info') => {
    if (elements.status) {
      elements.status.textContent = message;
      elements.status.dataset.tone = tone;
    }
    if (elements.formStatus) elements.formStatus.textContent = message;
  };

  const setMapNotice = (title, message) => {
    if (elements.mapNotice) elements.mapNotice.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  };

  const getKakaoMapUrl = (item) => {
    if (isValidPoint(item)) {
      return `https://map.kakao.com/link/map/${encodeURIComponent(item.name || '낚시터')},${Number(item.lat)},${Number(item.lng)}`;
    }
    const query = item?.address || item?.name || '낚시터';
    return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  };


  const getKakaoSearchUrl = (item) => {
    const query = [item?.name, item?.address].filter(hasText).join(' ') || '낚시터';
    return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  };

  const formatDistance = (distanceM) => {
    const value = number(distanceM);
    if (!value || value < 1) return '';
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}km` : `${Math.round(value)}m`;
  };

  const distanceSourceLabel = () => {
    if (state.referencePoint) return '검색 위치 기준';
    if (state.geo) return '현재 위치 기준';
    return `${regionLabel()} 중심 기준`;
  };

  const renderDistanceBadge = (distanceM) => {
    const distance = formatDistance(distanceM);
    if (!distance) return '';
    const source = distanceSourceLabel();
    return `<span class="ev-status-pill good life-distance-pill" title="${escapeHtml(source)}">${escapeHtml(distance)}<small>${escapeHtml(source.replace(' 기준', ''))}</small></span>`;
  };

  const distanceM = (a, b) => {
    if (!a || !b) return null;
    const lat1 = number(a.lat);
    const lng1 = number(a.lng);
    const lat2 = number(b.lat);
    const lng2 = number(b.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - s1 - s2));
  };

  const referenceForDistance = () => state.referencePoint || state.geo || currentRegionCenter();

  const withDistance = (items) => {
    const ref = referenceForDistance();
    return items.map((item) => ({ ...item, distanceM: distanceM(ref, item) }));
  };

  const matchesFilters = (item) => {
    const keyword = normalizeSearch(elements.keyword?.value || '');
    const district = normalizeSearch(elements.district?.value || '');
    const type = normalize(elements.type?.value || '');
    const fish = normalize(elements.fish?.value || '');
    const details = item.details || {};
    if (district && !normalizeSearch(item.district || item.address).includes(district)) return false;
    if (keyword && !normalizeSearch(item.searchText || [item.name, item.address, details.fee, details.fishTypes?.join(' '), details.type, details.waterFacilityType].join(' ')).includes(keyword)) return false;
    if (type && details.type !== type && details.waterFacilityType !== type) return false;
    if (fish && !(details.fishTypes || []).some((name) => normalize(name) === fish)) return false;
    if (elements.hasFee?.checked && !hasText(details.fee)) return false;
    if (elements.hasPhone?.checked && !hasText(item.phone)) return false;
    if (elements.hasSafety?.checked && !hasText(details.safetyFacilities)) return false;
    if (elements.hasConvenience?.checked && !hasText(details.convenienceFacilities)) return false;
    return true;
  };

  const distanceScore = (distance) => {
    if (!Number.isFinite(distance)) return 0;
    if (distance <= 5000) return 30;
    if (distance <= 10000) return 22;
    if (distance <= 20000) return 14;
    if (distance <= 50000) return 6;
    return 2;
  };

  const fishingRecommendScore = (item) => {
    const details = item.details || {};
    return distanceScore(item.distanceM)
      + (hasText(item.phone) ? 20 : 0)
      + (hasText(details.fee) ? 16 : 0)
      + ((details.fishTypes || []).length ? 14 : 0)
      + (hasText(details.safetyFacilities) ? 10 : 0)
      + (hasText(details.convenienceFacilities) ? 10 : 0)
      + (String(details.type || details.waterFacilityType || '').includes('실내') ? 4 : 0)
      + (item.coordinateFixed ? 4 : 0);
  };

  const sortItems = (items) => {
    const sort = elements.sort?.value || 'recommend';
    const byName = (a, b) => normalize(a.name).localeCompare(normalize(b.name), 'ko-KR');
    const byDistance = (a, b) => (Number.isFinite(a.distanceM) ? a.distanceM : 999999999) - (Number.isFinite(b.distanceM) ? b.distanceM : 999999999);
    const hasFee = (item) => hasText(item.details?.fee) ? 1 : 0;
    const hasPhone = (item) => hasText(item.phone) ? 1 : 0;
    const hasFacility = (item) => (hasText(item.details?.safetyFacilities) || hasText(item.details?.convenienceFacilities)) ? 1 : 0;
    return [...items].sort((a, b) => {
      if (sort === 'name') return byName(a, b);
      if (sort === 'fee') return hasFee(b) - hasFee(a) || byDistance(a, b) || byName(a, b);
      if (sort === 'phone') return hasPhone(b) - hasPhone(a) || byDistance(a, b) || byName(a, b);
      if (sort === 'facility') return hasFacility(b) - hasFacility(a) || byDistance(a, b) || byName(a, b);
      if (sort === 'distance') return byDistance(a, b) || fishingRecommendScore(b) - fishingRecommendScore(a) || byName(a, b);
      return fishingRecommendScore(b) - fishingRecommendScore(a) || byDistance(a, b) || byName(a, b);
    });
  };

  const applyFilters = () => {
    const filtered = withDistance(state.rawItems).filter(matchesFilters);
    state.items = sortItems(filtered);
    state.selectedId = state.items.some((item) => item.id === state.selectedId) ? state.selectedId : '';
    render();
  };

  const loadIndex = async () => {
    if (state.index) return state.index;
    state.index = await fetchJson(`${CACHE_BASE}/index.json?v=${encodeURIComponent(VERSION)}`);
    populateRegionOptions();
    return state.index;
  };

  const loadRegion = async (regionKey) => {
    const requestedRegion = regionKey || 'seoul';
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    state.currentRegion = requestedRegion;
    state.selectedId = '';
    state.referencePoint = null;
    state.lastRenderSignature = '';
    state.loading = true;
    setStatus(`${regionLabel(requestedRegion)} 낚시터 데이터를 불러오는 중입니다.`);
    try {
      await loadIndex();
      if (requestId !== state.requestId) return;
      const region = state.index.regions?.find((entry) => entry.key === requestedRegion);
      if (!region) {
        state.rawItems = [];
        setStatus(`${regionLabel(requestedRegion)} 지역의 낚시터 캐시가 없습니다.`, 'warning');
      } else if (state.regionCache.has(requestedRegion)) {
        state.rawItems = state.regionCache.get(requestedRegion);
      } else {
        const payload = await fetchJson(`${CACHE_BASE}/${encodeURIComponent(region.file || `${requestedRegion}.json`)}?v=${encodeURIComponent(VERSION)}`);
        if (requestId !== state.requestId) return;
        state.rawItems = Array.isArray(payload.items) ? payload.items : [];
        state.regionCache.set(requestedRegion, state.rawItems);
      }
      if (requestId !== state.requestId) return;
      syncRegionControls(requestedRegion);
      populateDynamicFilters(state.rawItems);
      setStatus(`${regionLabel(requestedRegion)} 낚시터 ${state.rawItems.length.toLocaleString('ko-KR')}곳을 표시합니다.`);
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.rawItems = [];
      setStatus('낚시터 로컬 캐시를 불러오지 못했습니다. 캐시 생성 후 다시 확인해 주세요.', 'error');
      setMapNotice('캐시 확인 필요', 'assets/data/life/fishing-spots/index.json 파일을 확인해 주세요.');
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        applyFilters();
        initKakaoMap();
      }
    }
  };

  const populateRegionOptions = () => {
    const availableKeys = new Set((state.index?.regions || []).map((region) => region.key));
    [elements.region, elements.mapRegion].forEach((select) => {
      if (!select) return;
      Array.from(select.options).forEach((option) => {
        const count = state.index?.regions?.find((region) => region.key === option.value)?.count;
        option.disabled = availableKeys.size > 0 && !availableKeys.has(option.value);
        option.textContent = count ? `${REGION_CENTERS[option.value]?.label || option.textContent.replace(/\s*\(.*\)/, '')} (${count})` : (REGION_CENTERS[option.value]?.label || option.textContent.replace(/\s*\(.*\)/, ''));
      });
    });
  };

  const populateDynamicFilters = (items) => {
    fillSelect(elements.type, collectValues(items.flatMap((item) => [item.details?.type, item.details?.waterFacilityType])), '전체');
    fillSelect(elements.fish, collectValues(items.flatMap((item) => item.details?.fishTypes || [])), '전체');
  };

  const collectValues = (values) => [...new Set(values.map((value) => normalize(value)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko-KR'))
    .slice(0, 120);

  const fillSelect = (select, values, firstLabel) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    if (values.includes(current)) select.value = current;
  };

  const syncRegionControls = (key) => {
    if (elements.region) elements.region.value = key;
    if (elements.mapRegion) elements.mapRegion.value = key;
    if (elements.mapTitle) elements.mapTitle.textContent = `${regionLabel(key)} 낚시터`;
  };

  const syncSortButtons = () => {
    const sort = elements.sort?.value || 'recommend';
    elements.sortButtons.forEach((button) => button.classList.toggle('active', button.dataset.fishingSort === sort));
  };

  const render = () => {
    syncSortButtons();
    renderSummary();
    renderList(elements.resultList, state.items.slice(0, MAX_LIST));
    renderList(elements.mobileResults, state.items.slice(0, MAX_LIST), { mobile: true });
    renderSelectedCard();
    syncMobileSheet();
    renderMap(state.items);
  };

  const renderSummary = () => {
    const total = state.items.length;
    const phoneCount = state.items.filter((item) => hasText(item.phone)).length;
    const feeCount = state.items.filter((item) => hasText(item.details?.fee)).length;
    const region = regionLabel();
    if (elements.listTitle) elements.listTitle.textContent = `${region} 낚시터 목록`;
    if (elements.listSummary) elements.listSummary.textContent = `${total.toLocaleString('ko-KR')}곳`;
    if (elements.listSubtitle) elements.listSubtitle.textContent = total ? `지도에는 최대 ${Math.min(total, MAX_MARKERS)}개 마커를 표시합니다.` : '조건에 맞는 낚시터가 없습니다.';
    if (elements.mobileTitle) elements.mobileTitle.textContent = `${region} 낚시터 목록`;
    if (elements.mobileSubtitle) elements.mobileSubtitle.textContent = total ? `${total.toLocaleString('ko-KR')}곳 중 ${Math.min(total, MAX_LIST)}곳 표시` : '조건에 맞는 결과가 없습니다.';
    updateSummaryCard(elements.countCard, '조회 후보', `${total.toLocaleString('ko-KR')}곳`, '조건 적용 결과');
    updateSummaryCard(elements.phoneCard, '전화 가능', `${phoneCount.toLocaleString('ko-KR')}곳`, '방문 전 확인');
    updateSummaryCard(elements.feeCard, '요금 정보', `${feeCount.toLocaleString('ko-KR')}곳`, '참고용');
    if (!state.loading) {
      const suffix = `${distanceSourceLabel()} 직선거리를 함께 표시합니다.`;
      setStatus(total ? `${region} 낚시터 ${total.toLocaleString('ko-KR')}곳을 표시합니다. ${suffix}` : '조건에 맞는 낚시터가 없습니다.', total ? 'info' : 'warning');
    }
  };

  const updateSummaryCard = (card, label, value, note) => {
    if (!card) return;
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small>`;
  };

  const renderList = (target, items, options = {}) => {
    if (!target) return;
    if (!items.length) {
      target.innerHTML = '<div class="empty-state"><strong>조건에 맞는 낚시터가 없습니다.</strong><p>지역이나 필터를 조정해 다시 확인해 주세요.</p></div>';
      return;
    }
    target.innerHTML = items.map((item, index) => renderCard(item, index, options)).join('');
    target.querySelectorAll('[data-fishing-select]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        selectItem(button.dataset.fishingSelect, { move: true, mobile: options.mobile });
      });
    });
    target.querySelectorAll('[data-life-card-select]').forEach((card) => {
      const selectFromCard = () => selectItem(card.dataset.lifeCardSelect, { move: true, mobile: options.mobile });
      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, input, select, label')) return;
        selectFromCard();
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectFromCard();
      });
    });
  };

  const renderCard = (item, index, options = {}) => {
    const details = item.details || {};
    const distanceBadge = renderDistanceBadge(item.distanceM);
    const selected = state.selectedId === item.id;
    const tel = buildTelLink(item.phone);
    const mapUrl = getKakaoMapUrl(item);
    const fish = (details.fishTypes || []).slice(0, 2).join(', ') || '어종 확인 필요';
    const fee = details.fee || '요금 확인 필요';
    const type = details.type || details.waterFacilityType || '유형 확인 필요';
    const summary = [type, fish, fee, hasText(item.phone) ? '전화 가능' : '전화 확인 필요'].filter(Boolean).join(' · ');
    return `<article class="parking-result-card life-list-card ${selected ? 'selected' : ''}" data-life-card-select="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)} 지도에서 선택">
      <div class="parking-result-main life-list-main">
        <div class="parking-result-title"><h3>${escapeHtml(item.name)}</h3>${distanceBadge}</div>
        <p class="parking-result-address">${escapeHtml(item.address || '주소 확인 필요')}</p>
        <p class="life-list-summary">${escapeHtml(summary)}</p>
        <div class="parking-card-badges">${(item.badges || []).slice(0, 4).map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div>
        ${options.mobile ? '' : `<div class="life-card-actions-inline"><a class="primary" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">카카오맵 바로가기</a>${tel ? `<a href="${escapeHtml(tel)}">전화하기</a>` : ''}</div>`}
        ${options.mobile ? `<div class="life-card-actions-inline"><a class="primary" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">카카오맵 바로가기</a>${tel ? `<a href="${escapeHtml(tel)}">전화하기</a>` : ''}</div>` : ''}
      </div>
    </article>`;
  };

  const syncMobileSheet = () => {
    if (elements.mobileSheet) {
      elements.mobileSheet.classList.toggle('is-open', state.mobileOpen);
      elements.mobileSheet.classList.toggle('is-collapsed', !state.mobileOpen);
      if (!state.mobileOpen) {
        elements.mobileSheet.classList.remove('is-expanded');
        elements.mobileSheet.style.removeProperty('--life-sheet-y');
      }
    }
    if (elements.mobileToggle) {
      elements.mobileToggle.setAttribute('aria-expanded', state.mobileOpen ? 'true' : 'false');
      elements.mobileToggle.textContent = state.mobileOpen ? '목록 닫기' : '목록 보기';
    }
  };

  const renderSelectedCard = () => {
    const card = elements.selectedCard;
    if (!card) return;
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    const details = item.details || {};
    const tel = buildTelLink(item.phone);
    const mapUrl = getKakaoMapUrl(item);
    card.hidden = false;
    card.innerHTML = `<div class="life-selected-card-head"><div><h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.address || '주소 확인 필요')}</p></div><button class="life-selected-close" type="button" data-fishing-close aria-label="선택 카드 닫기">×</button></div>
      <div class="life-chip-row">${(item.badges || []).slice(0, 4).map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div>
      <div class="life-detail-grid life-detail-grid--compact">
        <span><small>유형</small><strong>${escapeHtml(details.type || details.waterFacilityType || '유형 확인 필요')}</strong></span>
        <span><small>주요어종</small><strong>${escapeHtml((details.fishTypes || []).join(', ') || '어종 확인 필요')}</strong></span>
        <span><small>이용요금</small><strong>${escapeHtml(details.fee || '요금 확인 필요')}</strong></span>
        <span><small>전화번호</small><strong>${escapeHtml(item.phone || '전화 확인 필요')}</strong></span>
      </div>
      <div class="life-card-actions"><a class="primary" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">카카오맵 바로가기</a>${tel ? `<a href="${escapeHtml(tel)}">전화하기</a>` : ''}<button type="button" data-fishing-close>닫기</button></div>
      <p class="fine-print">운영 여부, 예약, 요금, 어종은 방문 전 전화 확인을 권장합니다.</p>`;
    card.querySelectorAll('[data-fishing-close]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedId = '';
        render();
      });
    });
  };

  const selectItem = (id, options = {}) => {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    state.selectedId = id;
    if (options.mobile) state.mobileOpen = true;
    render();
    if (options.move) moveMapToItem(item);
  };

  const moveMapToItem = (item) => {
    if (!isValidPoint(item)) return;
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      const point = new window.kakao.maps.LatLng(Number(item.lat), Number(item.lng));
      if (typeof state.map.panTo === 'function') state.map.panTo(point);
      else state.map.setCenter(point);
      if (typeof state.map.getLevel === 'function' && state.map.getLevel() > 7) state.map.setLevel(7);
    }
  };

  const renderMap = (items) => {
    const signature = `${state.currentRegion}:${items.map((item) => item.id).slice(0, MAX_MARKERS).join(',')}:${state.selectedId}:${state.kakaoReady ? 'kakao' : 'fallback'}`;
    if (signature === state.lastRenderSignature && state.kakaoReady) return;
    state.lastRenderSignature = signature;
    if (state.kakaoReady && state.map && window.kakao?.maps) renderKakaoMap(items);
    else renderFallbackMap(items);
  };

  const clearOverlays = () => {
    state.overlays.forEach((overlay) => overlay?.setMap?.(null));
    state.overlays = [];
  };

  const renderKakaoMap = (items) => {
    clearOverlays();
    if (elements.markers) elements.markers.innerHTML = '';
    const validItems = items.filter(isValidPoint).slice(0, MAX_MARKERS);
    const center = getMapCenter(validItems);
    if (!validItems.length) {
      state.map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      state.map.setLevel(8);
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    validItems.forEach((item, index) => {
      const position = new window.kakao.maps.LatLng(Number(item.lat), Number(item.lng));
      bounds.extend(position);
      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        yAnchor: 1,
        zIndex: state.selectedId === item.id ? 30 : 20,
        content: makeMarkerElement(item, index),
      });
      overlay.setMap(state.map);
      state.overlays.push(overlay);
    });
    if (validItems.length === 1) {
      state.map.setCenter(new window.kakao.maps.LatLng(Number(validItems[0].lat), Number(validItems[0].lng)));
      state.map.setLevel(6);
    } else if (!state.selectedId) {
      state.map.setBounds(bounds);
    }
  };

  const makeMarkerElement = (item, index) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `life-marker ${state.selectedId === item.id ? 'selected' : ''}`;
    marker.textContent = String(index + 1);
    marker.setAttribute('aria-label', `${item.name} 선택`);
    marker.addEventListener('click', (event) => {
      event.preventDefault();
      selectItem(item.id, { move: true });
    });
    return marker;
  };

  const renderFallbackMap = (items) => {
    if (!elements.markers) return;
    elements.markers.innerHTML = '';
    const validItems = items.filter(isValidPoint).slice(0, MAX_MARKERS);
    if (!validItems.length) {
      setMapNotice('표시할 좌표 없음', '조건에 맞는 낚시터 좌표가 없습니다.');
      return;
    }
    setMapNotice('지도 안내 모드', '카카오맵 키가 없으면 위치를 간단 마커로 표시합니다.');
    const bounds = computeBounds(validItems);
    validItems.forEach((item, index) => {
      const pos = projectPoint(item, bounds);
      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = `life-marker life-fallback-marker ${state.selectedId === item.id ? 'selected' : ''}`;
      wrapper.style.left = `${pos.x}%`;
      wrapper.style.top = `${pos.y}%`;
      wrapper.textContent = String(index + 1);
      wrapper.setAttribute('aria-label', `${item.name} 선택`);
      wrapper.addEventListener('click', () => selectItem(item.id));
      elements.markers.appendChild(wrapper);
    });
  };

  const computeBounds = (items) => {
    const lats = items.map((item) => Number(item.lat)).filter(Number.isFinite);
    const lngs = items.map((item) => Number(item.lng)).filter(Number.isFinite);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat: minLat === maxLat ? minLat - 0.01 : minLat,
      maxLat: minLat === maxLat ? maxLat + 0.01 : maxLat,
      minLng: minLng === maxLng ? minLng - 0.01 : minLng,
      maxLng: minLng === maxLng ? maxLng + 0.01 : maxLng,
    };
  };

  const projectPoint = (item, bounds) => {
    const x = 8 + ((Number(item.lng) - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 84;
    const y = 12 + ((bounds.maxLat - Number(item.lat)) / (bounds.maxLat - bounds.minLat)) * 76;
    return { x: Math.max(8, Math.min(92, x)), y: Math.max(16, Math.min(88, y)) };
  };

  const getMapCenter = (items = state.items) => {
    const selected = items.find((item) => item.id === state.selectedId);
    if (selected && isValidPoint(selected)) return { lat: Number(selected.lat), lng: Number(selected.lng) };
    if (state.referencePoint && isValidPoint(state.referencePoint)) return state.referencePoint;
    if (state.geo && isValidPoint(state.geo)) return state.geo;
    return currentRegionCenter();
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-kakao-map-sdk]');
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
        level: 8,
      });
      state.kakaoReady = true;
      elements.map.classList.remove('is-fallback');
      setMapNotice('카카오 지도', '낚시터 위치를 지도에 표시합니다.');
      renderMap(state.items);
    } catch (error) {
      state.kakaoReady = false;
      state.map = null;
      elements.map?.classList.add('is-fallback');
      setMapNotice('지도 안내 모드', error?.message === 'NO_KAKAO_MAP_JS_KEY' ? 'KAKAO_MAP_JS_KEY를 설정하면 실제 카카오 지도가 표시됩니다.' : '카카오맵을 불러오지 못해 기본 지도 안내 모드로 표시합니다.');
      renderMap(state.items);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('이 브라우저에서는 현재 위치를 사용할 수 없습니다.', 'warning');
      return;
    }
    setStatus('현재 위치를 확인하는 중입니다.');
    navigator.geolocation.getCurrentPosition((position) => {
      state.geo = { lat: position.coords.latitude, lng: position.coords.longitude, label: '현재 위치' };
      state.referencePoint = state.geo;
      setStatus('현재 위치 기준으로 가까운 순을 다시 계산했습니다.');
      applyFilters();
    }, () => {
      setStatus('위치 권한이 거부되었거나 현재 위치를 확인하지 못했습니다.', 'warning');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
  };


  const resetAdvancedFilters = () => {
    if (elements.type) elements.type.value = '';
    if (elements.fish) elements.fish.value = '';
    if (elements.sort) elements.sort.value = 'recommend';
    [elements.hasFee, elements.hasPhone, elements.hasSafety, elements.hasConvenience].forEach((element) => {
      if (element) element.checked = false;
    });
    state.selectedId = '';
    applyFilters();
  };

  const closeMobileFilterSheet = () => {
    root.classList.remove('is-filter-open');
    document.body.classList.remove('life-filter-open');
    elements.filterToggle?.setAttribute('aria-expanded', 'false');
  };

  const openMobileFilterSheet = () => {
    ensureMobileFilterHeader();
    root.classList.add('is-filter-open');
    document.body.classList.add('life-filter-open');
    elements.filterToggle?.setAttribute('aria-expanded', 'true');
  };

  const ensureMobileFilterHeader = () => {
    const panel = root.querySelector('.parking-dashboard__controls');
    if (!panel || panel.querySelector('[data-life-filter-head]')) return;
    const header = document.createElement('div');
    header.className = 'life-mobile-filter-head';
    header.dataset.lifeFilterHead = 'true';
    header.innerHTML = '<div><strong>상세 필터</strong><span>조건을 고른 뒤 적용하세요.</span></div><div class="parking-sheet-handle" aria-hidden="true"></div><button type="button" data-life-filter-reset>초기화</button><button type="button" data-life-filter-close aria-label="필터 닫기">닫기</button>';
    panel.prepend(header);
    header.querySelector('[data-life-filter-close]')?.addEventListener('click', closeMobileFilterSheet);
    header.querySelector('[data-life-filter-reset]')?.addEventListener('click', resetAdvancedFilters);
    attachDragToSheet(panel, closeMobileFilterSheet, 'is-filter-expanded');
  };

  const attachDragToSheet = (sheet, onClose, expandedClass) => {
    if (!sheet || sheet.dataset.lifeDragBound === 'true') return;
    sheet.dataset.lifeDragBound = 'true';
    let startY = 0;
    let lastY = 0;
    let active = false;
    const getY = (event) => event.clientY || event.touches?.[0]?.clientY || event.changedTouches?.[0]?.clientY || 0;
    const start = (event) => {
      if (!event.target.closest('.parking-sheet-handle')) return;
      active = true;
      startY = getY(event);
      lastY = startY;
      sheet.classList.add('is-dragging');
      if (event.pointerId != null && typeof sheet.setPointerCapture === 'function') {
        try { sheet.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
      }
    };
    const move = (event) => {
      if (!active) return;
      lastY = getY(event);
      const delta = lastY - startY;
      const baseY = expandedClass && sheet.classList.contains(expandedClass) ? 7 : 42;
      const nextY = Math.min(96, Math.max(7, baseY + (delta / Math.max(window.innerHeight, 1)) * 100));
      sheet.style.setProperty('--life-sheet-y', `${nextY}%`);
      event.preventDefault?.();
    };
    const end = () => {
      if (!active) return;
      const delta = lastY - startY;
      sheet.classList.remove('is-dragging');
      sheet.style.removeProperty('--life-sheet-y');
      if (delta > 90) {
        if (expandedClass) sheet.classList.remove(expandedClass);
        onClose?.();
      } else if (delta < -80 && expandedClass) {
        if (sheet.classList.contains('life-mobile-bottom-sheet')) {
          state.mobileOpen = true;
          sheet.classList.add('is-open');
          sheet.classList.remove('is-collapsed');
        }
        sheet.classList.add(expandedClass);
      } else if (delta < -28 && sheet.classList.contains('life-mobile-bottom-sheet')) {
        state.mobileOpen = true;
        syncMobileSheet();
      } else if (delta > 36 && expandedClass) {
        sheet.classList.remove(expandedClass);
      }
      active = false;
    };
    sheet.addEventListener('pointerdown', start);
    sheet.addEventListener('pointermove', move);
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
    sheet.addEventListener('touchstart', start, { passive: true });
    sheet.addEventListener('touchmove', move, { passive: false });
    sheet.addEventListener('touchend', end, { passive: true });
    sheet.addEventListener('touchcancel', end, { passive: true });
  };

  const initMobileInteractions = () => {
    elements.filterToggle?.setAttribute('aria-expanded', 'false');
    elements.filterToggle?.addEventListener('click', () => {
      if (root.classList.contains('is-filter-open')) closeMobileFilterSheet();
      else openMobileFilterSheet();
    });
    attachDragToSheet(elements.mobileSheet, () => {
      state.mobileOpen = false;
      syncMobileSheet();
    }, 'is-expanded');
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobileFilterSheet();
    });
  };

  const bindEvents = () => {
    elements.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      applyFilters();
      closeMobileFilterSheet();
    });
    elements.region?.addEventListener('change', () => {
      if (elements.district) elements.district.value = '';
      loadRegion(elements.region.value);
    });
    elements.mapRegion?.addEventListener('change', () => {
      if (elements.district) elements.district.value = '';
      loadRegion(elements.mapRegion.value);
    });
    elements.sort?.addEventListener('change', applyFilters);
    elements.type?.addEventListener('change', applyFilters);
    elements.fish?.addEventListener('change', applyFilters);
    [elements.hasFee, elements.hasPhone, elements.hasSafety, elements.hasConvenience].forEach((element) => element?.addEventListener('change', applyFilters));
    [elements.district, elements.keyword].forEach((element) => element?.addEventListener('input', debounce(() => {
      if (elements.mapKeyword && element === elements.keyword && elements.mapKeyword.value !== elements.keyword.value) elements.mapKeyword.value = elements.keyword.value;
      applyFilters();
    }, 180)));
    elements.mapToolbarSearch?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (elements.keyword && elements.mapKeyword) elements.keyword.value = elements.mapKeyword.value || '';
      applyFilters();
    });
    elements.mapKeyword?.addEventListener('input', debounce(() => {
      if (elements.keyword) elements.keyword.value = elements.mapKeyword.value || '';
      applyFilters();
    }, 220));
    elements.sortButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (elements.sort) elements.sort.value = button.dataset.fishingSort || 'recommend';
        applyFilters();
      });
    });
    elements.useLocation?.addEventListener('click', useCurrentLocation);
    elements.mapLocation?.addEventListener('click', useCurrentLocation);
    elements.mobileToggle?.addEventListener('click', () => {
      state.mobileOpen = !state.mobileOpen;
      syncMobileSheet();
    });
    elements.mobileMapButton?.addEventListener('click', () => {
      state.mobileOpen = false;
      syncMobileSheet();
    });
    initMobileInteractions();
  };

  const debounce = (fn, delay) => {
    let timer = 0;
    return (...params) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...params), delay);
    };
  };

  bindEvents();
  loadRegion('seoul');
})();
