(() => {
  const root = document.querySelector('[data-ev-charger-map]');
  if (!root) return;

  const $ = (selector) => root.querySelector(selector) || document.querySelector(selector);
  const $$ = (selector) => Array.from(root.querySelectorAll(selector));

  const els = {
    form: $('#ev-search-form'),
    destination: $('#ev-destination'),
    placeResults: $('#ev-place-results'),
    searchStatus: $('#ev-search-status'),
    radius: $('#ev-radius'),
    speed: $('#ev-speed'),
    type: $('#ev-type'),
    availabilityType: $('#ev-availability-type'),
    sort: $('#ev-sort'),
    filters: {
      availableOnly: $('#ev-filter-available'),
      freeParking: $('#ev-filter-free-parking'),
      noLimit: $('#ev-filter-no-limit'),
      rapidOnly: $('#ev-filter-rapid'),
      updatedOnly: $('#ev-filter-updated'),
      lowRiskOnly: $('#ev-filter-lowrisk')
    },
    recommend: $('#ev-recommend-button'),
    quickButtons: $$('[data-ev-radius], [data-ev-speed], [data-ev-type], [data-ev-reset]'),
    preferenceCards: $$('[data-ev-sort-mode]'),
    summaryTitle: $('#ev-summary-title'),
    summarySubtitle: $('#ev-summary-subtitle'),
    status: $('#ev-status'),
    dataBadges: $('#ev-data-badges'),
    resultList: $('#ev-result-list'),
    map: $('#ev-map'),
    mapMarkers: $('#ev-map-markers'),
    mapRefresh: $('#ev-map-research-button'),
    mapToolbar: $('#ev-map-toolbar'),
    mapToolbarSearch: $('#ev-map-toolbar-search'),
    mapDestination: $('#ev-map-destination'),
    mapRadiusToggle: $('#ev-map-radius-toggle'),
    mapRadiusPanel: $('#ev-map-radius-panel'),
    mapOptionsToggle: $('#ev-map-options-toggle'),
    mapOptionsPanel: $('#ev-map-options-panel'),
    mapSortToggle: $('#ev-map-sort-toggle'),
    mapSortPanel: $('#ev-map-sort-panel'),
    mapRadiusButtons: $$('[data-ev-map-radius], [data-ev-map-speed]'),
    mapType: $('#ev-map-type'),
    mapFilterInputs: $$('[data-ev-map-filter]'),
    mapSortButtons: $$('[data-ev-map-sort]'),
    mobileMapJump: $('#ev-mobile-map-jump'),
    mobileListToggle: $('#ev-mobile-list-toggle'),
    mobileSheet: $('#ev-mobile-bottom-sheet'),
    mobileSheetTitle: $('#ev-mobile-sheet-title'),
    mobileSheetSubtitle: $('#ev-mobile-sheet-subtitle'),
    mobileSheetMapButton: $('#ev-mobile-sheet-map-button'),
    mobileTimeButton: $('#ev-mobile-time-button'),
    mobileConditionButton: $('#ev-mobile-condition-button'),
    mobileSortButton: $('#ev-mobile-sort-button'),
    mobileSheetSort: $('#ev-mobile-sheet-sort'),
    mobileSortButtons: $$('[data-ev-mobile-sort]'),
    mobileResults: $('#ev-mobile-results')
  };

  const state = {
    center: { lat: 37.4979, lng: 127.0276, name: '강남역', address: '서울 강남구 강남대로', sido: '서울' },
    places: [],
    stations: [],
    sortedStations: [],
    selectedId: null,
    kakaoReady: false,
    map: null,
    mapMarkers: [],
    mapOverlays: [],
    lastSearchCenter: null,
    lastSearchZoom: null,
    hasMapMoveEvents: false
  };

  init();

  function init() {
    bindEvents();
    loadKakaoMap().finally(() => {
      updateMapCenter();
      renderFallbackMarkers([]);
      setStatus('목적지를 검색하거나 충전소 찾기를 눌러 주변 충전소를 확인하세요.', 'neutral');
    });
  }

  function bindEvents() {
    els.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      searchDestination(els.destination.value, { openPopup: true });
    });
    els.mapToolbarSearch?.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = els.mapDestination.value || els.destination.value;
      if (els.destination) els.destination.value = query;
      searchDestination(query, { openPopup: true });
    });
    els.recommend?.addEventListener('click', () => fetchChargers());
    els.quickButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.evReset) {
          els.radius.value = '3000';
          els.speed.value = 'all';
          els.type.value = '';
        }
        if (button.dataset.evRadius) els.radius.value = button.dataset.evRadius;
        if (button.dataset.evSpeed) els.speed.value = button.dataset.evSpeed;
        if (button.dataset.evType) els.type.value = button.dataset.evType;
        syncQuickButtons();
        if (state.stations.length) fetchChargers();
      });
    });
    [els.radius, els.speed, els.type, els.availabilityType, els.sort].filter(Boolean).forEach((input) => input.addEventListener('change', () => {
      syncQuickButtons();
      syncSortButtons(els.sort.value || 'recommended');
      if (state.stations.length) fetchChargers();
    }));
    Object.values(els.filters).filter(Boolean).forEach((input) => input.addEventListener('change', () => renderResults()));
    els.preferenceCards.forEach((button) => button.addEventListener('click', () => setSort(button.dataset.evSortMode || 'recommended')));
    els.mapSortButtons.forEach((button) => button.addEventListener('click', () => {
      closeMapToolbarPopovers();
      setSort(button.dataset.evMapSort || 'recommended');
    }));
    els.mobileSortButtons.forEach((button) => button.addEventListener('click', () => {
      if (els.mobileSheetSort) els.mobileSheetSort.hidden = true;
      setSort(button.dataset.evMobileSort || 'recommended');
      openMobileSheet('expanded');
    }));
    els.mapRadiusToggle?.addEventListener('click', () => toggleMapPopover(els.mapRadiusPanel, els.mapRadiusToggle));
    els.mapOptionsToggle?.addEventListener('click', () => toggleMapPopover(els.mapOptionsPanel, els.mapOptionsToggle));
    els.mapSortToggle?.addEventListener('click', () => toggleMapPopover(els.mapSortPanel, els.mapSortToggle));
    els.mapRadiusButtons.forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.evMapRadius) els.radius.value = button.dataset.evMapRadius;
      if (button.dataset.evMapSpeed) els.speed.value = button.dataset.evMapSpeed;
      closeMapToolbarPopovers();
      syncMapToolbar();
      fetchChargers();
    }));
    els.mapType?.addEventListener('change', () => {
      els.type.value = els.mapType.value;
      syncMapToolbar();
      fetchChargers();
    });
    els.mapFilterInputs.forEach((input) => input.addEventListener('change', () => {
      const target = els.filters[input.dataset.evMapFilter];
      if (target) target.checked = input.checked;
      renderResults();
    }));
    document.addEventListener('click', (event) => {
      if (!els.mapToolbar || els.mapToolbar.contains(event.target)) return;
      closeMapToolbarPopovers();
    });
    els.mapRefresh?.addEventListener('click', researchCurrentMapArea);
    els.mobileMapJump?.addEventListener('click', () => scrollToMap());
    els.mobileListToggle?.addEventListener('click', () => toggleMobileSheet());
    els.mobileSheetMapButton?.addEventListener('click', () => {
      closeMobileSheet();
      scrollToMap();
    });
    els.mobileTimeButton?.addEventListener('click', () => scrollToControls());
    els.mobileConditionButton?.addEventListener('click', () => scrollToControls());
    els.mobileSortButton?.addEventListener('click', () => {
      if (els.mobileSheetSort) els.mobileSheetSort.hidden = !els.mobileSheetSort.hidden;
      openMobileSheet('open');
    });
    els.mobileSheet?.querySelector('.parking-sheet-handle')?.addEventListener('click', () => toggleMobileSheet());
  }

  async function loadKakaoMap() {
    try {
      const config = await fetchJson('/api/config');
      const key = config?.kakaoMapJsKey;
      if (!key) {
        els.map?.classList.add('is-fallback');
        const span = els.map?.querySelector('.parking-map-fallback span');
        if (span) span.textContent = 'KAKAO_MAP_JS_KEY 환경변수를 설정하면 실제 카카오 지도가 표시됩니다.';
        return;
      }
      await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`);
      await new Promise((resolve) => window.kakao.maps.load(resolve));
      state.kakaoReady = true;
      const center = new window.kakao.maps.LatLng(state.center.lat, state.center.lng);
      state.map = new window.kakao.maps.Map(els.map, { center, level: 5 });
      els.map.classList.remove('is-fallback');
      if (els.mapRefresh) els.mapRefresh.hidden = false;
      bindKakaoMapMoveEvents();
    } catch (_) {
      els.map?.classList.add('is-fallback');
      const span = els.map?.querySelector('.parking-map-fallback span');
      if (span) span.textContent = '카카오맵을 불러오지 못해 샘플 지도에서 표시합니다.';
    }
  }

  async function searchDestination(query, options = {}) {
    const q = String(query || '').trim();
    if (!q) {
      setSearchStatus('목적지를 입력해 주세요.');
      setStatus('목적지를 입력한 뒤 충전소 찾기를 눌러 주세요.', 'warning');
      els.destination?.focus();
      return;
    }
    setSearchStatus('목적지를 검색하고 있습니다.');
    try {
      const data = await fetchJson(`/api/kakao-local?query=${encodeURIComponent(q)}`);
      state.places = Array.isArray(data.documents) ? data.documents.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)) : [];
      if (!state.places.length) {
        setSearchStatus('검색 결과를 찾지 못했습니다. 다른 장소명을 입력해 주세요.');
        openPlacePopup('검색 결과를 찾지 못했습니다.');
        return;
      }
      setSearchStatus(`${state.places.length}개 후보를 찾았습니다. 목적지를 선택해 주세요.`);
      if (options.openPopup) openPlacePopup();
    } catch (error) {
      setSearchStatus(error?.message || '목적지 검색 중 오류가 발생했습니다.');
      openPlacePopup('목적지 검색 중 오류가 발생했습니다.');
    }
  }

  function ensurePlacePopup() {
    let popup = document.querySelector('#ev-place-popup');
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'ev-place-popup';
    popup.className = 'parking-place-popup';
    popup.hidden = true;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-labelledby', 'ev-place-popup-title');
    popup.innerHTML = `
      <div class="parking-place-popup__panel" role="document">
        <div class="parking-place-popup__head"><div><strong id="ev-place-popup-title">목적지 선택</strong><span>검색 결과 중 충전소를 찾을 기준 위치를 선택하세요.</span></div><button type="button" class="subtle-button tiny" data-ev-place-close>닫기</button></div>
        <div class="parking-place-popup__list" data-ev-place-list></div>
      </div>`;
    document.body.appendChild(popup);
    popup.addEventListener('click', (event) => {
      if (event.target === popup || event.target.closest('[data-ev-place-close]')) closePlacePopup();
      const button = event.target.closest('[data-ev-place-index]');
      if (button) {
        const place = state.places[Number(button.dataset.evPlaceIndex)];
        if (place) selectPlace(place, true);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popup.hidden) closePlacePopup();
    });
    return popup;
  }

  function openPlacePopup(emptyMessage = '') {
    const popup = ensurePlacePopup();
    const list = popup.querySelector('[data-ev-place-list]');
    if (!state.places.length) {
      list.innerHTML = `<div class="parking-place-popup__empty">${escapeHtml(emptyMessage || '검색 결과가 없습니다.')}</div>`;
    } else {
      list.innerHTML = state.places.slice(0, 8).map((place, index) => `
        <button type="button" class="parking-place-popup__item" data-ev-place-index="${index}">
          <strong>${escapeHtml(place.name || '검색 결과')}</strong>
          <span>${escapeHtml(place.address || place.roadAddress || '')}</span>
        </button>`).join('');
    }
    popup.hidden = false;
    document.body.classList.add('parking-place-popup-open');
  }

  function closePlacePopup() {
    const popup = document.querySelector('#ev-place-popup');
    if (popup) popup.hidden = true;
    document.body.classList.remove('parking-place-popup-open');
  }

  function selectPlace(place, runSearch) {
    state.center = {
      lat: Number(place.lat),
      lng: Number(place.lng),
      name: place.name || '선택한 위치',
      address: place.address || place.roadAddress || '',
      sido: place.region1 || inferSido(place.address || place.roadAddress)
    };
    if (els.destination) els.destination.value = state.center.name;
    if (els.mapDestination) els.mapDestination.value = state.center.name;
    setSearchStatus(`${state.center.name} 주변으로 기준 위치를 설정했습니다.`);
    closePlacePopup();
    updateMapCenter();
    if (runSearch) fetchChargers();
  }

  async function fetchChargers() {
    const radius = els.radius?.value || '3000';
    const speed = els.speed?.value || 'all';
    const chargerType = els.type?.value || '';
    const freeParking = els.filters.freeParking?.checked ? 'true' : 'false';
    const noLimit = els.filters.noLimit?.checked ? 'true' : 'false';
    setStatus('전기차 충전소 정보를 불러오는 중입니다.', 'neutral');
    if (els.recommend) {
      els.recommend.disabled = true;
      els.recommend.textContent = '충전소 찾는 중...';
    }
    setListLoading();
    try {
      const query = new URLSearchParams({
        lat: state.center.lat,
        lng: state.center.lng,
        radius,
        sido: state.center.sido || '서울',
        speed,
        chargerType,
        freeParking,
        noLimit
      });
      const data = await fetchJson(`/api/ev-charger?${query.toString()}`);
      if (!data.ok) throw new Error(data.message || '충전소 조회에 실패했습니다.');
      state.stations = Array.isArray(data.chargers) ? data.chargers : [];
      state.lastSearchCenter = { lat: state.center.lat, lng: state.center.lng };
      state.lastSearchZoom = state.map?.getLevel?.() ?? state.lastSearchZoom;
      renderDataBadges(data);
      renderResults();
      setStatus('조회가 완료되었습니다. 충전기 상태는 현장 상황을 보장하지 않는 참고 정보입니다.', 'success');
    } catch (error) {
      setStatus(error?.message || '충전소 정보를 불러오지 못했습니다. API 키와 활용신청 상태를 확인해 주세요.', 'warning');
      renderEmpty('충전소 정보를 불러오지 못했습니다. API 키와 활용신청 상태를 확인해 주세요.');
      renderMapMarkers([]);
    } finally {
      if (els.recommend) {
        els.recommend.disabled = false;
        els.recommend.textContent = '충전소 찾기';
      }
    }
  }

  function renderResults() {
    let list = [...state.stations];
    list = applyFilters(list);
    list.sort(sorter(els.sort?.value || 'recommended'));
    state.sortedStations = list;
    const radiusText = formatRadius(els.radius?.value || '3000');
    const typeText = selectedText(els.type) || '전체';
    if (els.summaryTitle) els.summaryTitle.textContent = `${state.center.name || '선택 위치'} · ${radiusText} · ${typeText}`;
    if (els.summarySubtitle) els.summarySubtitle.textContent = `${state.center.sido || '선택 지역'} 기준 ${list.length}개 충전소 후보를 확인했습니다.`;
    if (els.mobileSheetTitle) els.mobileSheetTitle.textContent = list.length ? `추천 충전소 ${list.length}곳` : '추천 결과';
    if (els.mobileSheetSubtitle) els.mobileSheetSubtitle.textContent = `${state.center.name || '선택 위치'} 주변 충전소 상태를 비교합니다.`;
    if (!list.length) {
      renderEmpty('조건에 맞는 충전소가 없습니다. 반경이나 필터를 조정해 주세요.');
      renderMapMarkers([]);
      return;
    }
    const html = list.slice(0, 40).map((item, index) => renderStationCard(item, index)).join('');
    if (els.resultList) els.resultList.innerHTML = html;
    if (els.mobileResults) els.mobileResults.innerHTML = list.slice(0, 20).map((item, index) => renderStationCard(item, index, true)).join('');
    bindResultCardEvents();
    renderMapMarkers(list.slice(0, 40));
    syncMapToolbar();
    syncSortButtons(els.sort?.value || 'recommended');
    openMobileSheet('collapsed');
  }

  function applyFilters(list) {
    return list.filter((item) => {
      const availableOnly = els.filters.availableOnly?.checked;
      if (availableOnly && item.availableCount <= 0) return false;
      if (els.filters.freeParking?.checked && item.parkingFree !== true) return false;
      if (els.filters.noLimit?.checked && item.limitYn !== false) return false;
      if (els.filters.rapidOnly?.checked && item.rapidCount <= 0) return false;
      if (els.filters.updatedOnly?.checked && !item.updatedAt) return false;
      if (els.filters.lowRiskOnly?.checked && item.statusTone !== 'good') return false;
      return true;
    });
  }

  function renderStationCard(item, index, mobile = false) {
    const top = item.chargers?.[0] || {};
    const rank = index + 1;
    const selected = state.selectedId === item.id;
    const statusClass = item.statusTone === 'good' ? 'metric-confidence-high' : item.statusTone === 'busy' ? 'metric-risk-medium' : item.statusTone === 'bad' ? 'metric-risk-high' : 'metric-confidence-low';
    const priceText = item.availableCount > 0 ? `사용 가능 ${item.availableCount}기` : item.chargingCount > 0 ? '충전 중 확인' : '상태 확인 필요';
    const distanceText = `목적지에서 약 ${formatDistance(item.distanceM)}`;
    const reason = buildReason(item);
    const detailId = `${mobile ? 'mobile-' : ''}ev-detail-${rank}`;
    return `<article class="parking-result-card ${item.statusTone || ''} ${rank === 1 ? 'is-best' : ''} ${selected ? 'is-pinned' : ''}" data-ev-station-index="${index}" data-ev-station-id="${escapeHtml(item.id)}">
      <div class="parking-card-head"><div><strong>${escapeHtml(item.name)}</strong><span>${rank === 1 ? '추천 1위' : `${rank}순위`} · ${escapeHtml(item.availabilityLabel || '상태 확인')}</span></div>${selected ? `<button type="button" class="subtle-button tiny" data-ev-pin-clear>선택 해제</button>` : ''}</div>
      <div class="parking-list-summary" aria-hidden="true"><strong>${escapeHtml(priceText)}</strong><span>${distanceText}</span><span>${escapeHtml(item.availabilityLabel || '확인 필요')}</span></div>
      <div class="parking-price-row"><strong>${escapeHtml(priceText)}</strong><span>${escapeHtml(top.typeLabel || '충전 타입 확인')}</span></div>
      <p class="parking-reason">${escapeHtml(reason)}</p>
      <div class="parking-card-metrics"><span class="parking-metric-chip metric-distance">${distanceText}</span><span class="parking-metric-chip metric-availability">급속 ${item.rapidCount || 0}기 · 완속 ${item.slowCount || 0}기</span><span class="parking-metric-chip ${statusClass}">${escapeHtml(item.availabilityLabel || '확인 필요')}</span><span class="parking-metric-chip metric-confidence-high">${item.parkingFree === true ? '주차료 무료' : item.parkingFree === false ? '주차료 유료' : '주차료 확인'}</span></div>
      ${selected ? `<p class="parking-pinned-badge">지도에서 선택한 충전소입니다.</p>` : ''}
      <div class="parking-card-actions"><button type="button" class="parking-detail-toggle" data-ev-detail-toggle aria-expanded="false" aria-controls="${detailId}">상세 보기 ▼</button>${renderKakaoLink(item)}</div>
      <div class="parking-card-detail" data-ev-card-detail id="${detailId}" hidden>
        <p><strong>충전 타입</strong> ${escapeHtml(typesSummary(item))}</p>
        <p><strong>상태</strong> 사용 가능 ${item.availableCount || 0}기, 충전 중 ${item.chargingCount || 0}기, 고장·점검 ${item.troubleCount || 0}기, 확인 필요 ${item.unknownCount || 0}기</p>
        <p><strong>이용 시간</strong> ${escapeHtml(item.useTime || '확인 필요')}</p>
        <p><strong>운영기관</strong> ${escapeHtml(item.business || '확인 필요')}</p>
        <p><strong>주소</strong> ${escapeHtml(item.address || '주소 정보 없음')}</p>
        <p><strong>이용 조건</strong> ${item.limitYn === false ? '이용 제한 없음' : item.limitYn === true ? '이용 제한 있음' : '이용 제한 확인 필요'} · ${item.parkingFree === true ? '주차료 무료' : item.parkingFree === false ? '주차료 유료' : '주차료 확인 필요'}</p>
        <p><strong>상태 갱신</strong> ${escapeHtml(item.updatedAt || '확인 필요')}</p>
        <p class="fine-print">충전기 상태는 제공기관 데이터 기준이며 실제 현장 상황과 도착 시점에 따라 달라질 수 있습니다.</p>
      </div>
    </article>`;
  }

  function bindResultCardEvents() {
    root.querySelectorAll('[data-ev-station-index]').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-ev-detail-toggle], [data-ev-pin-clear], a, button')) return;
        const item = state.sortedStations[Number(card.dataset.evStationIndex)];
        focusStation(item);
      });
    });
    root.querySelectorAll('[data-ev-detail-toggle]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const card = button.closest('.parking-result-card');
        const detail = card?.querySelector('[data-ev-card-detail]');
        const open = detail?.hidden;
        if (detail) detail.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        button.textContent = open ? '상세 닫기 ▲' : '상세 보기 ▼';
      });
    });
    root.querySelectorAll('[data-ev-pin-clear]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        state.selectedId = null;
        renderResults();
      });
    });
  }

  function renderMapMarkers(list) {
    clearKakaoMarkers();
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      const bounds = new window.kakao.maps.LatLngBounds();
      const centerPosition = new window.kakao.maps.LatLng(state.center.lat, state.center.lng);
      bounds.extend(centerPosition);
      const destOverlay = new window.kakao.maps.CustomOverlay({
        position: centerPosition,
        yAnchor: 1.25,
        content: `<div class="parking-destination-marker">목적지</div>`
      });
      destOverlay.setMap(state.map);
      state.mapOverlays.push(destOverlay);
      list.forEach((item, index) => {
        const position = new window.kakao.maps.LatLng(item.lat, item.lng);
        bounds.extend(position);
        const marker = new window.kakao.maps.Marker({ position, title: item.name });
        marker.setMap(state.map);
        state.mapMarkers.push(marker);
        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          yAnchor: 1.65,
          content: `<button type="button" class="parking-map-label ev-map-label is-status-${item.statusTone || 'unknown'} ${index === 0 ? 'is-best' : ''} ${state.selectedId === item.id ? 'is-selected' : ''}" data-ev-map-id="${escapeHtml(item.id)}"><span class="parking-marker-rank">${index + 1}</span><span>${item.availableCount > 0 ? `가능 ${item.availableCount}` : '확인'}</span></button>`
        });
        overlay.setMap(state.map);
        state.mapOverlays.push(overlay);
      });
      if (list.length) state.map.setBounds(bounds);
    }
    renderFallbackMarkers(list);
  }

  function renderFallbackMarkers(list) {
    if (!els.mapMarkers) return;
    els.mapMarkers.innerHTML = `<div class="parking-destination-marker" style="left:50%; top:50%">목적지</div>` + list.slice(0, 18).map((item, index) => {
      const left = 18 + ((index * 17) % 68);
      const top = 18 + ((index * 29) % 62);
      return `<button type="button" class="parking-map-label ev-map-label is-status-${item.statusTone || 'unknown'} ${index === 0 ? 'is-best' : ''} ${state.selectedId === item.id ? 'is-selected' : ''}" style="left:${left}%; top:${top}%" data-ev-map-id="${escapeHtml(item.id)}"><span class="parking-marker-rank">${index + 1}</span><span>${item.availableCount > 0 ? `가능 ${item.availableCount}` : '확인'}</span></button>`;
    }).join('');
    els.mapMarkers.querySelectorAll('[data-ev-map-id]').forEach((button) => button.addEventListener('click', () => {
      const item = state.sortedStations.find((station) => station.id === button.dataset.evMapId);
      focusStation(item);
    }));
  }

  function clearKakaoMarkers() {
    state.mapMarkers.forEach((marker) => marker.setMap(null));
    state.mapOverlays.forEach((overlay) => overlay.setMap(null));
    state.mapMarkers = [];
    state.mapOverlays = [];
  }

  function focusStation(item) {
    if (!item) return;
    state.selectedId = item.id;
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      state.map.setCenter(new window.kakao.maps.LatLng(item.lat, item.lng));
      state.map.setLevel(4);
    }
    setStatus(`${item.name} 위치를 지도 중심으로 이동했습니다. 실제 충전 가능 여부는 현장에서 다시 확인해 주세요.`, 'neutral');
    renderResults();
  }

  function updateMapCenter() {
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      state.map.setCenter(new window.kakao.maps.LatLng(state.center.lat, state.center.lng));
    }
  }

  function bindKakaoMapMoveEvents() {
    if (!state.map || !window.kakao?.maps || state.hasMapMoveEvents) return;
    state.hasMapMoveEvents = true;
    window.kakao.maps.event.addListener(state.map, 'idle', () => {
      if (!els.mapRefresh) return;
      const center = state.map.getCenter();
      const moved = distanceMeters(state.lastSearchCenter?.lat || state.center.lat, state.lastSearchCenter?.lng || state.center.lng, center.getLat(), center.getLng());
      els.mapRefresh.hidden = !(moved >= 500);
    });
  }

  async function researchCurrentMapArea() {
    if (state.map && window.kakao?.maps) {
      const center = state.map.getCenter();
      state.center = { lat: center.getLat(), lng: center.getLng(), name: '현재 지도 중심', address: '지도에서 다시 검색한 위치', sido: state.center.sido || '서울' };
      if (els.destination) els.destination.value = state.center.name;
      if (els.mapDestination) els.mapDestination.value = state.center.name;
    }
    if (els.mapRefresh) els.mapRefresh.hidden = true;
    await fetchChargers();
  }

  function setSort(mode) {
    if (els.sort) els.sort.value = mode;
    syncSortButtons(mode);
    renderResults();
  }

  function syncSortButtons(mode) {
    root.querySelectorAll('[data-ev-sort-mode]').forEach((button) => button.classList.toggle('active', button.dataset.evSortMode === mode));
    root.querySelectorAll('[data-ev-map-sort]').forEach((button) => button.classList.toggle('active', button.dataset.evMapSort === mode));
    root.querySelectorAll('[data-ev-mobile-sort]').forEach((button) => button.classList.toggle('active', button.dataset.evMobileSort === mode));
    if (els.mapSortToggle) els.mapSortToggle.textContent = sortLabel(mode);
  }

  function syncQuickButtons() {
    els.quickButtons.forEach((button) => {
      const active = (button.dataset.evRadius && els.radius.value === button.dataset.evRadius) || (button.dataset.evSpeed && els.speed.value === button.dataset.evSpeed) || (button.dataset.evType && els.type.value === button.dataset.evType);
      button.classList.toggle('active', Boolean(active));
    });
  }

  function syncMapToolbar() {
    if (els.mapRadiusToggle) els.mapRadiusToggle.textContent = formatRadius(els.radius?.value || '3000');
    if (els.mapType && els.mapType.value !== els.type.value) els.mapType.value = els.type.value;
    els.mapFilterInputs.forEach((input) => {
      const source = els.filters[input.dataset.evMapFilter];
      if (source) input.checked = source.checked;
    });
  }

  function toggleMapPopover(panel, toggle) {
    if (!panel || !toggle) return;
    const willOpen = panel.hidden;
    closeMapToolbarPopovers();
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function closeMapToolbarPopovers() {
    [els.mapRadiusPanel, els.mapOptionsPanel, els.mapSortPanel].forEach((panel) => { if (panel) panel.hidden = true; });
    [els.mapRadiusToggle, els.mapOptionsToggle, els.mapSortToggle].forEach((toggle) => toggle?.setAttribute('aria-expanded', 'false'));
  }

  function openMobileSheet(mode = 'open') {
    if (!els.mobileSheet) return;
    els.mobileSheet.classList.remove('is-open', 'is-expanded', 'is-collapsed');
    if (mode === 'expanded') els.mobileSheet.classList.add('is-expanded', 'is-open');
    else if (mode === 'collapsed') els.mobileSheet.classList.add('is-collapsed');
    else els.mobileSheet.classList.add('is-open');
    els.mobileListToggle?.setAttribute('aria-expanded', mode !== 'collapsed' ? 'true' : 'false');
  }

  function closeMobileSheet() {
    els.mobileSheet?.classList.remove('is-open', 'is-expanded');
    els.mobileSheet?.classList.add('is-collapsed');
    els.mobileListToggle?.setAttribute('aria-expanded', 'false');
  }

  function toggleMobileSheet() {
    const expanded = els.mobileSheet?.classList.contains('is-expanded') || els.mobileSheet?.classList.contains('is-open');
    if (expanded) closeMobileSheet();
    else openMobileSheet('expanded');
  }

  function scrollToMap() { els.map?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function scrollToControls() { els.form?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function setListLoading() {
    const html = '<article class="parking-result-card"><strong>충전소 정보를 확인하고 있습니다.</strong><p>제공기관 데이터 기준으로 주변 충전소를 불러오는 중입니다.</p></article>';
    if (els.resultList) els.resultList.innerHTML = html;
    if (els.mobileResults) els.mobileResults.innerHTML = html;
  }

  function renderEmpty(message) {
    const html = `<article class="parking-result-card"><strong>확인할 충전소가 없습니다.</strong><p>${escapeHtml(message)}</p></article>`;
    if (els.resultList) els.resultList.innerHTML = html;
    if (els.mobileResults) els.mobileResults.innerHTML = html;
  }

  function renderDataBadges(data) {
    if (!els.dataBadges) return;
    const badges = ['전기차 충전소 정보', '제공기관 데이터 기준'];
    if (data?.count != null) badges.push(`반경 내 충전기 ${Number(data.count).toLocaleString()}개`);
    if (data?.checkedAt) badges.push('상태 갱신 참고');
    els.dataBadges.innerHTML = badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('');
  }

  function sorter(mode) {
    return (a, b) => {
      if (mode === 'nearby') return a.distanceM - b.distanceM;
      if (mode === 'rapid') return b.rapidCount - a.rapidCount || b.bestScore - a.bestScore || a.distanceM - b.distanceM;
      if (mode === 'available') return b.availableCount - a.availableCount || a.distanceM - b.distanceM;
      if (mode === 'updated') return updatedScore(b) - updatedScore(a) || b.bestScore - a.bestScore;
      return b.bestScore - a.bestScore || a.distanceM - b.distanceM;
    };
  }

  function buildReason(item) {
    if (item.availableCount > 0) return `현재 제공 데이터 기준 사용 가능 충전기 ${item.availableCount}기가 확인됩니다.`;
    if (item.chargingCount > 0) return '충전 중인 충전기가 있어 도착 시점의 상태 확인이 필요합니다.';
    if (item.troubleCount > 0) return '고장·점검 또는 통신 이상 상태가 포함되어 현장 확인이 필요합니다.';
    return '상태 정보가 부족하므로 운영기관 안내와 현장 표시를 함께 확인해 주세요.';
  }

  function typesSummary(item) {
    const labels = [...new Set((item.chargers || []).map((c) => c.typeLabel).filter(Boolean))];
    return labels.length ? labels.slice(0, 4).join(' · ') : '충전 타입 확인 필요';
  }

  function renderKakaoLink(item) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return '';
    const label = encodeURIComponent(item.name || '전기차 충전소');
    return `<a class="parking-kakao-link" href="https://map.kakao.com/link/to/${label},${item.lat},${item.lng}" target="_blank" rel="noopener">길찾기</a>`;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `요청 오류가 발생했습니다. (${response.status})`);
    return data;
  }

  function loadScript(src) {
    if (document.querySelector(`script[src^="${src.split('?')[0]}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function selectedText(select) { return select?.selectedOptions?.[0]?.textContent?.trim() || ''; }
  function setStatus(message, tone) { if (els.status) { els.status.textContent = message; els.status.className = `status-message ${tone || 'neutral'}`; } }
  function setSearchStatus(message) { if (els.searchStatus) els.searchStatus.textContent = message; }
  function sortLabel(mode) { return ({ recommended: '사용 가능성순', nearby: '가까운순', rapid: '급속 우선', available: '사용 가능 대수', updated: '갱신 최신순' })[mode] || '사용 가능성순'; }
  function formatRadius(value) { const number = Number(value); return number >= 1000 ? `${number / 1000}km` : `${number}m`; }
  function formatDistance(m) { return Number.isFinite(m) ? (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`) : '거리 확인'; }
  function updatedScore(item) { return item.updatedAt ? Date.parse(item.updatedAt.replace(' ', 'T')) || 0 : 0; }
  function inferSido(address) {
    const token = String(address || '').trim().split(/\s+/)[0] || '서울';
    const map = { 서울특별시: '서울', 서울: '서울', 경기도: '경기', 부산광역시: '부산', 부산: '부산', 대구광역시: '대구', 대구: '대구', 인천광역시: '인천', 인천: '인천', 광주광역시: '광주', 광주: '광주', 대전광역시: '대전', 대전: '대전', 울산광역시: '울산', 울산: '울산', 세종특별자치시: '세종', 세종: '세종', 강원특별자치도: '강원', 강원도: '강원', 강원: '강원', 충청북도: '충북', 충북: '충북', 충청남도: '충남', 충남: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전북: '전북', 전라남도: '전남', 전남: '전남', 경상북도: '경북', 경북: '경북', 경상남도: '경남', 경남: '경남', 제주특별자치도: '제주', 제주도: '제주', 제주: '제주' };
    return map[token] || token || '서울';
  }
  function distanceMeters(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
})();
