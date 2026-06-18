(() => {
  const root = document.querySelector('#outdoor-air-tool');
  if (!root) return;
  const $ = (selector) => root.querySelector(selector) || document.querySelector(selector);
  const form = $('#outdoor-air-form');
  const sidoSelect = $('#air-sido');
  const purposeSelect = $('#air-purpose');
  const placeInput = $('#air-place-query');
  const placeButton = $('#air-place-search');
  const currentButton = $('#air-current-location');
  const statusEl = $('#air-status');
  const panel = $('#air-summary-panel');
  const mainCard = $('#air-main-card');
  const metricGrid = $('#air-metric-grid');
  const warningBox = $('#air-warning-box');

  const state = {
    places: [],
    selectedPlace: null,
    isFetching: false,
    popup: null
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchAir();
  });
  placeButton?.addEventListener('click', searchPlaceRegion);
  currentButton?.addEventListener('click', useCurrentLocation);
  placeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchPlaceRegion();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePlacePopup();
  });

  async function searchPlaceRegion() {
    const query = String(placeInput.value || '').trim();
    if (!query) {
      setStatus('장소명을 입력해 주세요.', 'warning');
      placeInput?.focus();
      return;
    }
    setButtonLoading(placeButton, true, '검색 중...');
    setStatus('카카오 장소 검색으로 지역 후보를 찾는 중입니다...', 'neutral');
    try {
      const data = await fetchJson(`/api/kakao-local?query=${encodeURIComponent(query)}`);
      const places = normalizePlaceResults(data.documents);
      state.places = places;
      if (!places.length) {
        openPlacePopup([], `“${query}” 검색 결과를 찾지 못했습니다. 더 구체적인 장소명이나 주소를 입력해 주세요.`);
        setStatus('검색 결과를 찾지 못했습니다. 지역을 직접 선택하거나 다른 장소명을 입력해 주세요.', 'warning');
        return;
      }
      openPlacePopup(places);
      setStatus(`${places.length}개 장소 후보를 찾았습니다. 팝업에서 지역 기준으로 쓸 장소를 선택해 주세요.`, 'success');
    } catch (error) {
      openPlacePopup([], error?.message || '카카오 장소 검색 중 오류가 발생했습니다.');
      setStatus(error?.message || '장소 검색 중 오류가 발생했습니다.', 'warning');
    } finally {
      setButtonLoading(placeButton, false);
    }
  }

  function normalizePlaceResults(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        name: item.name || item.place_name || item.address || '검색 결과',
        address: item.address || item.roadAddress || item.address_name || '',
        roadAddress: item.roadAddress || item.road_address_name || '',
        category: item.category || item.category_name || '',
        phone: item.phone || '',
        lat: Number(item.lat || item.y),
        lng: Number(item.lng || item.x),
        region1: normalizeSido(item.region1 || inferRegion1(item.address || item.roadAddress || item.address_name || '')),
        region2: item.region2 || inferRegionParts(item.address || item.roadAddress || item.address_name || '').region2,
        region3: item.region3 || inferRegionParts(item.address || item.roadAddress || item.address_name || '').region3
      }))
      .filter((item) => item.name && item.region1);
  }

  function ensurePlacePopup() {
    let popup = document.querySelector('#air-place-popup');
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'air-place-popup';
    popup.className = 'parking-place-popup air-place-popup';
    popup.hidden = true;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-labelledby', 'air-place-popup-title');
    popup.innerHTML = `
      <div class="parking-place-popup__panel air-place-popup__panel" role="document">
        <div class="parking-place-popup__head">
          <strong id="air-place-popup-title">지역 기준으로 사용할 장소를 선택해 주세요</strong>
          <button type="button" class="parking-place-popup__close" data-air-popup-close aria-label="지역 후보 팝업 닫기">×</button>
        </div>
        <p class="air-place-popup__hint">카카오 장소 검색 결과입니다. 선택한 장소의 주소에서 시·도를 가져와 대기질을 조회합니다.</p>
        <div class="parking-place-popup__list" data-air-place-popup-list></div>
      </div>
    `;
    popup.addEventListener('click', (event) => {
      if (event.target === popup || event.target.closest('[data-air-popup-close]')) closePlacePopup();
    });
    document.body.append(popup);
    return popup;
  }

  function openPlacePopup(places, emptyMessage = '') {
    const popup = ensurePlacePopup();
    const list = popup.querySelector('[data-air-place-popup-list]');
    if (!list) return;
    if (!places.length) {
      list.innerHTML = `<p class="parking-place-popup__empty">${escapeHtml(emptyMessage || '검색 결과를 찾지 못했습니다.')}</p>`;
    } else {
      list.innerHTML = places.map((place, index) => `
        <button type="button" class="parking-place-popup__item air-place-popup__item" data-air-place-index="${index}">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(place.roadAddress || place.address || '주소 정보 없음')}</span>
          <em>${escapeHtml([place.region1, place.region2, place.region3].filter(Boolean).join(' '))}</em>
        </button>
      `).join('');
      list.querySelectorAll('[data-air-place-index]').forEach((button) => {
        button.addEventListener('click', () => selectPlace(Number(button.dataset.airPlaceIndex)));
      });
    }
    popup.hidden = false;
    document.body.classList.add('parking-place-popup-open');
    popup.querySelector('.parking-place-popup__close')?.focus({ preventScroll: true });
  }

  function closePlacePopup() {
    const popup = document.querySelector('#air-place-popup');
    if (!popup) return;
    popup.hidden = true;
    document.body.classList.remove('parking-place-popup-open');
  }

  function selectPlace(index) {
    const place = state.places[index];
    if (!place) return;
    state.selectedPlace = place;
    sidoSelect.value = place.region1;
    placeInput.value = place.name;
    closePlacePopup();
    setStatus(`${place.name} 주소 기준으로 ${place.region1} 지역을 선택했습니다. 외출 체크하기를 누르면 조회합니다.`, 'success');
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('현재 위치 확인을 지원하지 않는 브라우저입니다.', 'warning');
      return;
    }
    setButtonLoading(currentButton, true, '위치 확인 중...');
    setStatus('현재 위치를 확인하는 중입니다...', 'neutral');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const data = await fetchJson(`/api/kakao-local?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        const region = normalizeSido(data.region1 || inferRegion1(data.addressName || ''));
        if (region) sidoSelect.value = region;
        state.selectedPlace = { name: data.addressName || '현재 위치', address: data.addressName || '', region1: region };
        setStatus(`${data.addressName || '현재 위치'} 기준으로 ${sidoSelect.value} 지역을 선택했습니다.`, 'success');
        fetchAir();
      } catch (error) {
        setStatus(error?.message || '현재 위치의 주소를 확인하지 못했습니다. 지역을 직접 선택해 주세요.', 'warning');
      } finally {
        setButtonLoading(currentButton, false);
      }
    }, () => {
      setStatus('현재 위치 권한이 거부되었거나 위치를 확인할 수 없습니다.', 'warning');
      setButtonLoading(currentButton, false);
    }, { enableHighAccuracy: true, timeout: 8000 });
  }

  async function fetchAir() {
    if (state.isFetching) return;
    const sido = sidoSelect.value || '서울';
    const purpose = purposeSelect.value || 'walk';
    state.isFetching = true;
    setStatus(`${sido} 대기질과 기상특보를 확인하는 중입니다...`, 'neutral');
    panel.hidden = false;
    mainCard.className = 'air-main-card';
    mainCard.innerHTML = '<div class="empty-state">외출 체크 결과를 불러오는 중입니다.</div>';
    metricGrid.innerHTML = '';
    warningBox.innerHTML = '';
    try {
      const data = await fetchJson(`/api/outdoor-air?sido=${encodeURIComponent(sido)}&purpose=${encodeURIComponent(purpose)}`);
      if (!data.ok) throw new Error(data.message || '대기질 조회에 실패했습니다.');
      renderAir(data);
      setStatus('조회가 완료되었습니다. 결과는 공개 대기질·기상특보 기준의 참고 정보입니다.', 'success');
    } catch (error) {
      const message = error?.message || '대기질 정보를 불러오지 못했습니다.';
      mainCard.className = 'air-main-card unknown';
      mainCard.innerHTML = `<div class="empty-state"><strong>조회 결과를 불러오지 못했습니다.</strong><p>${escapeHtml(message)}</p><p>Cloudflare 환경변수의 DATA_GO_KR_SERVICE_KEY, AIRKOREA_API_KEY, KMA_API_KEY와 공공데이터 활용신청 승인 상태를 확인해 주세요.</p></div>`;
      metricGrid.innerHTML = '';
      warningBox.innerHTML = '';
      setStatus(message, 'warning');
    } finally {
      state.isFetching = false;
    }
  }

  function renderAir(data) {
    const item = data.representative || {};
    const summary = data.summary || {};
    const tone = summary.tone || 'unknown';
    mainCard.className = `air-main-card ${tone}`;
    mainCard.innerHTML = `
      <div><span class="air-tone-label">${escapeHtml(labelTone(tone))}</span><h2>${escapeHtml(summary.title || '외출 체크 결과')}</h2><p>${escapeHtml(summary.message || '')}</p></div>
      <dl><div><dt>기준 측정소</dt><dd>${escapeHtml(item.stationName || '확인 필요')}</dd></div><div><dt>측정 시각</dt><dd>${escapeHtml(item.dataTime || '확인 필요')}</dd></div><div><dt>지역</dt><dd>${escapeHtml(data.sido || '')}</dd></div></dl>
    `;
    metricGrid.innerHTML = [
      metricCard('초미세먼지 PM2.5', item.pm25, '㎍/㎥', item.pm25Label, gradeTone(item.pm25Label)),
      metricCard('미세먼지 PM10', item.pm10, '㎍/㎥', item.pm10Label, gradeTone(item.pm10Label)),
      metricCard('오존 O₃', item.o3, 'ppm', item.o3Label, gradeTone(item.o3Label)),
      metricCard('통합대기환경지수', item.khai, '', item.khaiLabel, gradeTone(item.khaiLabel))
    ].join('');
    renderWarnings(data.warning);
  }

  function metricCard(title, value, unit, label, tone) {
    const displayValue = value === null || value === undefined || Number.isNaN(value) ? '정보 없음' : `${value}${unit ? ` ${unit}` : ''}`;
    return `<article class="air-metric-card ${tone}"><span>${escapeHtml(title)}</span><strong>${escapeHtml(displayValue)}</strong><em>${escapeHtml(label || '정보 없음')}</em></article>`;
  }

  function renderWarnings(warning) {
    if (!warning?.ok) {
      warningBox.innerHTML = `<h3>기상특보</h3><p>${escapeHtml(warning?.message || '기상특보 정보를 확인하지 못했습니다.')}</p>`;
      return;
    }
    const items = Array.isArray(warning.items) ? warning.items : [];
    if (!items.length) {
      warningBox.innerHTML = '<h3>기상특보</h3><p>최근 조회 범위에서 기상특보 항목이 확인되지 않았습니다. 단, 지역별 실제 특보는 기상청 안내를 함께 확인해 주세요.</p>';
      return;
    }
    warningBox.innerHTML = `<h3>기상특보 후보</h3><ul>${items.slice(0, 5).map((item) => `<li><strong>${escapeHtml(item.title || '기상특보')}</strong><span>${escapeHtml(item.area || '')} ${escapeHtml(item.time || '')}</span></li>`).join('')}</ul><p class="fine-print">특보 데이터는 발표·해제 시점에 따라 달라질 수 있습니다.</p>`;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `요청 오류가 발생했습니다. (${response.status})`);
    return data;
  }

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `preview-note ${tone || 'neutral'}`;
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.dataset.originalText || button.textContent;
      button.disabled = true;
      if (text) button.textContent = text;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    }
  }

  function inferRegionParts(address) {
    const parts = String(address || '').trim().split(/\s+/).filter(Boolean);
    return { region1: normalizeSido(parts[0] || ''), region2: parts[1] || '', region3: parts[2] || '' };
  }

  function inferRegion1(address) { return inferRegionParts(address).region1; }

  function normalizeSido(value) {
    const aliases = {
      서울특별시: '서울', 서울: '서울', 부산광역시: '부산', 부산: '부산', 대구광역시: '대구', 대구: '대구', 인천광역시: '인천', 인천: '인천', 광주광역시: '광주', 광주: '광주', 대전광역시: '대전', 대전: '대전', 울산광역시: '울산', 울산: '울산', 세종특별자치시: '세종', 세종: '세종', 경기도: '경기', 경기: '경기', 강원특별자치도: '강원', 강원도: '강원', 강원: '강원', 충청북도: '충북', 충북: '충북', 충청남도: '충남', 충남: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전북: '전북', 전라남도: '전남', 전남: '전남', 경상북도: '경북', 경북: '경북', 경상남도: '경남', 경남: '경남', 제주특별자치도: '제주', 제주도: '제주', 제주: '제주'
    };
    return aliases[String(value || '').trim()] || String(value || '').trim();
  }

  function labelTone(tone) { return { good: '외출 무난', normal: '보통', warning: '주의', bad: '확인 필요', unknown: '정보 확인' }[tone] || '정보 확인'; }
  function gradeTone(label) { return /매우/.test(label) ? 'bad' : /나쁨/.test(label) ? 'warning' : /보통/.test(label) ? 'normal' : /좋음/.test(label) ? 'good' : 'unknown'; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
})();
