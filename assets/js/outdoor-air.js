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

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchAir();
  });
  placeButton?.addEventListener('click', searchPlaceRegion);
  currentButton?.addEventListener('click', useCurrentLocation);

  async function searchPlaceRegion() {
    const query = String(placeInput.value || '').trim();
    if (!query) {
      setStatus('장소명을 입력해 주세요.', 'warning');
      return;
    }
    setStatus('장소의 지역을 확인하는 중입니다...', 'neutral');
    try {
      const data = await fetchJson(`/api/kakao-local?query=${encodeURIComponent(query)}`);
      const first = Array.isArray(data.documents) ? data.documents[0] : null;
      if (!first?.region1) {
        setStatus('장소의 시·도 정보를 찾지 못했습니다. 지역을 직접 선택해 주세요.', 'warning');
        return;
      }
      sidoSelect.value = first.region1;
      setStatus(`${first.name} 주소 기준으로 ${first.region1} 지역을 선택했습니다.`, 'success');
      fetchAir();
    } catch (error) {
      setStatus(error?.message || '장소 검색 중 오류가 발생했습니다.', 'warning');
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('현재 위치 확인을 지원하지 않는 브라우저입니다.', 'warning');
      return;
    }
    setStatus('현재 위치를 확인하는 중입니다...', 'neutral');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const data = await fetchJson(`/api/kakao-local?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        if (data.region1) sidoSelect.value = data.region1;
        setStatus(`${data.addressName || '현재 위치'} 기준으로 ${sidoSelect.value} 지역을 선택했습니다.`, 'success');
        fetchAir();
      } catch (error) {
        setStatus(error?.message || '현재 위치의 주소를 확인하지 못했습니다.', 'warning');
      }
    }, () => setStatus('현재 위치 권한이 거부되었거나 위치를 확인할 수 없습니다.', 'warning'), { enableHighAccuracy: true, timeout: 8000 });
  }

  async function fetchAir() {
    const sido = sidoSelect.value || '서울';
    const purpose = purposeSelect.value || 'walk';
    setStatus(`${sido} 대기질과 기상특보를 확인하는 중입니다...`, 'neutral');
    panel.hidden = false;
    mainCard.innerHTML = '<div class="empty-state">외출 체크 결과를 불러오는 중입니다.</div>';
    metricGrid.innerHTML = '';
    warningBox.innerHTML = '';
    try {
      const data = await fetchJson(`/api/outdoor-air?sido=${encodeURIComponent(sido)}&purpose=${encodeURIComponent(purpose)}`);
      if (!data.ok) throw new Error(data.message || '대기질 조회에 실패했습니다.');
      renderAir(data);
      setStatus('조회가 완료되었습니다. 결과는 공개 대기질·기상특보 기준의 참고 정보입니다.', 'success');
    } catch (error) {
      mainCard.innerHTML = `<div class="empty-state">${escapeHtml(error?.message || '대기질 정보를 불러오지 못했습니다.')}</div>`;
      setStatus(error?.message || '조회 중 오류가 발생했습니다.', 'warning');
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
  function labelTone(tone) { return { good: '외출 무난', normal: '보통', warning: '주의', bad: '확인 필요', unknown: '정보 확인' }[tone] || '정보 확인'; }
  function gradeTone(label) { return /매우/.test(label) ? 'bad' : /나쁨/.test(label) ? 'warning' : /보통/.test(label) ? 'normal' : /좋음/.test(label) ? 'good' : 'unknown'; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
})();
