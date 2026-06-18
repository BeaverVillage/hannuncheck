(() => {
  const root = document.querySelector('[data-ev-charger-map]');
  if (!root) return;

  const $ = (selector) => root.querySelector(selector) || document.querySelector(selector);
  const form = $('#ev-search-form');
  const destinationInput = $('#ev-destination');
  const statusEl = $('#ev-status');
  const searchStatusEl = $('#ev-search-status');
  const resultList = $('#ev-result-list');
  const badgesEl = $('#ev-data-badges');
  const summaryTitle = $('#ev-summary-title');
  const summarySubtitle = $('#ev-summary-subtitle');
  const mapEl = $('#ev-map');
  const fallbackMarkersEl = $('#ev-map-markers');
  const placeResultsEl = $('#ev-place-results');
  const searchButton = $('#ev-search-button');
  const currentButton = $('#ev-current-location');
  const demoButton = $('#ev-demo-location');
  const researchButton = $('#ev-map-research-button');

  const state = {
    center: { lat: 37.4979, lng: 127.0276, name: '강남역', address: '서울 강남구 강남대로', sido: '서울' },
    chargers: [],
    rawItems: [],
    sort: 'recommended',
    kakaoReady: false,
    map: null,
    markers: []
  };

  init();

  function init() {
    bindEvents();
    loadKakaoMap().finally(() => {
      setStatus('목적지를 검색하거나 충전소 찾기를 눌러 주변 충전소를 확인하세요.', 'neutral');
      updateMapCenter();
    });
  }

  function bindEvents() {
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      searchDestination(destinationInput.value);
    });
    searchButton?.addEventListener('click', () => fetchChargers());
    currentButton?.addEventListener('click', useCurrentLocation);
    demoButton?.addEventListener('click', () => {
      state.center = { lat: 37.4979, lng: 127.0276, name: '강남역', address: '서울 강남구 강남대로', sido: '서울' };
      destinationInput.value = '강남역';
      fetchChargers();
    });
    researchButton?.addEventListener('click', () => {
      if (state.map && window.kakao?.maps) {
        const center = state.map.getCenter();
        state.center.lat = center.getLat();
        state.center.lng = center.getLng();
        state.center.name = '현재 지도 중심';
      }
      fetchChargers();
    });
    root.querySelectorAll('[data-ev-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        state.sort = button.dataset.evSort || 'recommended';
        root.querySelectorAll('[data-ev-sort]').forEach((el) => el.classList.toggle('active', el.dataset.evSort === state.sort));
        renderResults();
      });
    });
    ['#ev-radius', '#ev-speed', '#ev-type', '#ev-filter-available', '#ev-filter-free-parking', '#ev-filter-no-limit'].forEach((selector) => {
      $(selector)?.addEventListener('change', () => {
        if (state.chargers.length) renderResults();
      });
    });
  }

  async function loadKakaoMap() {
    try {
      const config = await fetchJson('/api/config');
      const key = config?.kakaoMapJsKey;
      if (!key) {
        mapEl?.classList.add('is-fallback');
        mapEl.querySelector('.parking-map-fallback span').textContent = 'KAKAO_MAP_JS_KEY 환경변수를 설정하면 실제 카카오 지도가 표시됩니다.';
        return;
      }
      await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`);
      await new Promise((resolve) => window.kakao.maps.load(resolve));
      state.kakaoReady = true;
      const center = new window.kakao.maps.LatLng(state.center.lat, state.center.lng);
      state.map = new window.kakao.maps.Map(mapEl, { center, level: 5 });
      mapEl.classList.remove('is-fallback');
      researchButton.hidden = false;
    } catch (error) {
      mapEl?.classList.add('is-fallback');
      mapEl.querySelector('.parking-map-fallback span').textContent = '카카오맵을 불러오지 못해 샘플 마커로 표시합니다.';
    }
  }

  async function searchDestination(query) {
    const q = String(query || '').trim();
    if (!q) {
      setStatus('목적지를 입력해 주세요.', 'warning');
      return;
    }
    setSearchStatus('목적지를 검색하는 중입니다...');
    try {
      const data = await fetchJson(`/api/kakao-local?query=${encodeURIComponent(q)}`);
      const docs = Array.isArray(data.documents) ? data.documents.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)) : [];
      if (!docs.length) {
        setSearchStatus('검색 결과가 없습니다. 더 구체적인 장소명이나 주소를 입력해 주세요.');
        return;
      }
      renderPlaceResults(docs);
      selectPlace(docs[0], false);
      setSearchStatus(`${docs[0].name} 주변으로 지도 중심을 이동했습니다. 충전소 찾기를 누르세요.`);
    } catch (error) {
      setSearchStatus(error?.message || '목적지 검색 중 오류가 발생했습니다.');
    }
  }

  function renderPlaceResults(docs) {
    if (!placeResultsEl) return;
    placeResultsEl.innerHTML = docs.slice(0, 5).map((place, index) => `
      <button type="button" data-place-index="${index}">
        <strong>${escapeHtml(place.name)}</strong>
        <small>${escapeHtml(place.address || place.roadAddress || '')}</small>
      </button>
    `).join('');
    placeResultsEl.querySelectorAll('[data-place-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const place = docs[Number(button.dataset.placeIndex)];
        selectPlace(place, true);
      });
    });
  }

  function selectPlace(place, runSearch) {
    state.center = {
      lat: Number(place.lat),
      lng: Number(place.lng),
      name: place.name || '선택한 위치',
      address: place.address || place.roadAddress || '',
      sido: place.region1 || inferSido(place.address || place.roadAddress)
    };
    updateMapCenter();
    if (runSearch) fetchChargers();
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('이 브라우저에서는 현재 위치 확인을 지원하지 않습니다.', 'warning');
      return;
    }
    setStatus('현재 위치를 확인하는 중입니다...', 'neutral');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.center = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: '현재 위치', address: '', sido: '서울' };
      try {
        const data = await fetchJson(`/api/kakao-local?lat=${state.center.lat}&lng=${state.center.lng}`);
        if (data.region1) state.center.sido = data.region1;
        if (data.addressName) state.center.address = data.addressName;
      } catch {}
      updateMapCenter();
      fetchChargers();
    }, () => setStatus('현재 위치 권한이 거부되었거나 위치를 확인할 수 없습니다.', 'warning'), { enableHighAccuracy: true, timeout: 8000 });
  }

  async function fetchChargers() {
    const radius = $('#ev-radius')?.value || '3000';
    const speed = $('#ev-speed')?.value || 'all';
    const chargerType = $('#ev-type')?.value || '';
    const freeParking = $('#ev-filter-free-parking')?.checked ? 'true' : 'false';
    const noLimit = $('#ev-filter-no-limit')?.checked ? 'true' : 'false';
    setStatus('전기차 충전소 정보를 불러오는 중입니다...', 'neutral');
    resultList.innerHTML = '<div class="empty-state">충전소 데이터를 확인하고 있습니다.</div>';
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
      state.chargers = Array.isArray(data.chargers) ? data.chargers : [];
      state.rawItems = Array.isArray(data.rawItems) ? data.rawItems : [];
      summaryTitle.textContent = `${state.center.name || '선택 위치'} · 반경 ${Number(radius).toLocaleString()}m`;
      summarySubtitle.textContent = `${state.center.sido || '선택 지역'} 기준 ${state.chargers.length}개 충전소 후보를 확인했습니다.`;
      badgesEl.innerHTML = `<span>지역 전체 ${Number(data.totalInRegion || 0).toLocaleString()}개 충전기 데이터</span><span>반경 내 ${Number(data.count || 0).toLocaleString()}개 충전기 후보</span><span>제공기관 데이터 기준</span>`;
      setStatus('조회가 완료되었습니다. 사용 가능성은 현장 상황을 보장하지 않는 참고 정보입니다.', 'success');
      renderResults();
    } catch (error) {
      setStatus(error?.message || '충전소 조회 중 오류가 발생했습니다.', 'warning');
      resultList.innerHTML = '<div class="empty-state">충전소 정보를 불러오지 못했습니다. API 키와 활용신청 상태를 확인해 주세요.</div>';
      renderFallbackMarkers([]);
    }
  }

  function renderResults() {
    let list = [...state.chargers];
    const availableOnly = $('#ev-filter-available')?.checked;
    if (availableOnly) {
      const available = list.filter((item) => item.availableCount > 0);
      if (available.length) list = available;
    }
    list.sort(sorter(state.sort));
    if (!list.length) {
      resultList.innerHTML = '<div class="empty-state">조건에 맞는 충전소가 없습니다. 반경이나 필터를 조정해 주세요.</div>';
      renderMapMarkers([]);
      return;
    }
    resultList.innerHTML = list.slice(0, 30).map((item, index) => renderStationCard(item, index)).join('');
    resultList.querySelectorAll('[data-station-index]').forEach((button) => {
      button.addEventListener('click', () => focusStation(list[Number(button.dataset.stationIndex)]));
    });
    renderMapMarkers(list.slice(0, 30));
  }

  function renderStationCard(item, index) {
    const topCharger = item.chargers[0] || {};
    return `
      <article class="parking-result-card ev-result-card ${item.statusTone}">
        <div class="parking-result-rank">${index + 1}</div>
        <div class="parking-result-main">
          <div class="parking-result-title"><h3>${escapeHtml(item.name)}</h3><span class="ev-status-pill ${item.statusTone}">${escapeHtml(item.availabilityLabel)}</span></div>
          <p class="parking-result-address">${escapeHtml(item.address || '주소 정보 없음')}</p>
          <div class="parking-result-metrics">
            <span><strong>${formatDistance(item.distanceM)}</strong><small>직선거리</small></span>
            <span><strong>${item.availableCount}기</strong><small>사용 가능</small></span>
            <span><strong>${item.rapidCount}기</strong><small>급속 후보</small></span>
            <span><strong>${item.parkingFree === true ? '무료' : item.parkingFree === false ? '유료' : '확인'}</strong><small>주차료</small></span>
          </div>
          <div class="parking-card-badges"><span>${escapeHtml(topCharger.typeLabel || '충전 타입 확인')}</span><span>${escapeHtml(item.useTime || '이용시간 확인 필요')}</span><span>${item.limitYn === false ? '이용 제한 없음' : item.limitYn === true ? '이용 제한 있음' : '제한 정보 확인'}</span></div>
          <p class="fine-print">상태 갱신: ${escapeHtml(item.updatedAt || '확인 필요')} · 운영기관: ${escapeHtml(item.business || '확인 필요')}</p>
        </div>
        <button type="button" class="secondary-action-button" data-station-index="${index}">지도에서 보기</button>
      </article>
    `;
  }

  function renderMapMarkers(list) {
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      state.markers.forEach((marker) => marker.setMap(null));
      state.markers = [];
      const bounds = new window.kakao.maps.LatLngBounds();
      const center = new window.kakao.maps.LatLng(state.center.lat, state.center.lng);
      bounds.extend(center);
      list.forEach((item, index) => {
        const position = new window.kakao.maps.LatLng(item.lat, item.lng);
        const marker = new window.kakao.maps.Marker({ position, title: item.name });
        marker.setMap(state.map);
        state.markers.push(marker);
        bounds.extend(position);
        const content = `<div class="ev-kakao-label ${item.statusTone}">${index + 1}</div>`;
        const overlay = new window.kakao.maps.CustomOverlay({ content, position, yAnchor: 1.9 });
        overlay.setMap(state.map);
        state.markers.push(overlay);
      });
      if (list.length) state.map.setBounds(bounds);
      return;
    }
    renderFallbackMarkers(list);
  }

  function renderFallbackMarkers(list) {
    if (!fallbackMarkersEl) return;
    fallbackMarkersEl.innerHTML = list.slice(0, 12).map((item, index) => {
      const left = 16 + ((index * 19) % 68);
      const top = 18 + ((index * 31) % 62);
      return `<button class="parking-map-label ev-marker ${item.statusTone}" style="left:${left}%; top:${top}%" title="${escapeHtml(item.name)}"><span>${index + 1}</span><small>${escapeHtml(item.availableCount > 0 ? '가능' : '확인')}</small></button>`;
    }).join('');
  }

  function updateMapCenter() {
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      state.map.setCenter(new window.kakao.maps.LatLng(state.center.lat, state.center.lng));
    }
  }

  function focusStation(item) {
    if (!item) return;
    if (state.kakaoReady && state.map && window.kakao?.maps) {
      state.map.setCenter(new window.kakao.maps.LatLng(item.lat, item.lng));
      state.map.setLevel(4);
    }
    setStatus(`${item.name} 위치를 지도 중심으로 이동했습니다. 실제 충전 가능 여부는 현장에서 다시 확인해 주세요.`, 'neutral');
  }

  function sorter(mode) {
    return (a, b) => {
      if (mode === 'nearby') return a.distanceM - b.distanceM;
      if (mode === 'rapid') return b.rapidCount - a.rapidCount || b.bestScore - a.bestScore;
      if (mode === 'available') return b.availableCount - a.availableCount || a.distanceM - b.distanceM;
      return b.bestScore - a.bestScore || a.distanceM - b.distanceM;
    };
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

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${tone || 'neutral'}`;
  }
  function setSearchStatus(message) { if (searchStatusEl) searchStatusEl.textContent = message; }
  function inferSido(address) {
    const token = String(address || '').trim().split(/\s+/)[0] || '서울';
    const map = { 서울특별시: '서울', 경기도: '경기', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
    return map[token] || token || '서울';
  }
  function formatDistance(m) { return Number.isFinite(m) ? (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`) : '거리 확인'; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
})();
