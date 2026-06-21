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
  const MEDICAL_KAKAO_CACHE_URL = '/assets/data/medical/kakao-place-cache.json?v=20260621-v87-emergency-ev-format-fix';

  const MODE_META = {
    emergency: { label: '응급실', searchLabel: '응급실 확인하기', listLabel: '응급실 비교 목록', mapSuffix: '응급실', detailTitle: '선택한 응급실' },
    hospital: { label: '야간 병원', searchLabel: '야간 병원 확인하기', listLabel: '야간 병원 비교 목록', mapSuffix: '야간 병원', detailTitle: '선택한 야간 병원' },
    pharmacy: { label: '야간 약국', searchLabel: '야간 약국 확인하기', listLabel: '야간 약국 비교 목록', mapSuffix: '야간 약국', detailTitle: '선택한 야간 약국' },
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
    mapNotice: document.querySelector('.emergency-map-notice'),
    markers: document.querySelector('#emergency-map-markers'),
    list: document.querySelector('#emergency-result-list'),
    listTitle: document.querySelector('#emergency-list-title'),
    listSummary: document.querySelector('#emergency-list-summary'),
    detail: document.querySelector('#emergency-detail-card'),
    warningList: document.querySelector('#emergency-warning-list'),
    quickButtons: Array.from(document.querySelectorAll('.emergency-quick-row button')),
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
  const formatBeds = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('ko-KR')}개` : '전화 확인';
  const countGood = (items) => (Array.isArray(items) ? items.filter((item) => item.tone === 'good').length : 0);

  const setStatus = (message, tone = 'info') => {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
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
      elements.summaryPhone.innerHTML = `<span>전화 가능 후보</span><strong>${phoneCount.toLocaleString('ko-KR')}곳</strong><small>${nearest ? `가까운 후보 ${formatDistance(nearest.distanceM)}` : '전화 확인 우선'}</small>`;
      if (elements.summaryStatus) elements.summaryStatus.innerHTML = `<span>중증·상태 정보</span><strong>${criticalCount.toLocaleString('ko-KR')}곳</strong><small>${messageCount ? `상태 메시지 ${messageCount}곳` : '병상 외 상태 정보 참고'}</small>`;
      return;
    }
    const nightCount = items.filter((item) => item.isNightCandidate).length;
    elements.summaryCount.innerHTML = `<span>조회 후보</span><strong>${count.toLocaleString('ko-KR')}곳</strong><small>${escapeHtml(getRegionLabel())} · ${escapeHtml(meta().label)} 확인</small>`;
    elements.summaryBeds.innerHTML = `<span>야간 운영 참고</span><strong>${nightCount.toLocaleString('ko-KR')}곳</strong><small>운영시간 기준 · 접수 마감 전화 확인</small>`;
    elements.summaryPhone.innerHTML = `<span>전화 가능 후보</span><strong>${phoneCount.toLocaleString('ko-KR')}곳</strong><small>${nearest ? `가까운 후보 ${formatDistance(nearest.distanceM)}` : '전화 확인 우선'}</small>`;
    if (elements.summaryStatus) elements.summaryStatus.innerHTML = `<span>운영시간 표시</span><strong>${items.filter((item) => item.operationTime).length.toLocaleString('ko-KR')}곳</strong><small>공공데이터 기준 운영시간 참고</small>`;
  };

  const makeMapPosition = (item, index, total) => {
    if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) && state.geo) {
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
    if (elements.mapNotice) {
      const notice = state.careMode === 'emergency'
        ? '중증·장비 상태도 참고용입니다. 방문 전 전화 확인이 필요합니다.'
        : '운영시간은 참고용입니다. 야간 접수와 조제 가능 여부는 전화 확인이 필요합니다.';
      elements.mapNotice.innerHTML = state.dataMode === 'idle' ? `<strong>조회 전</strong><span>조건을 선택하고 조회 버튼을 누르면 공공데이터 기준 후보를 표시합니다.</span>` : `<strong>국립중앙의료원 데이터</strong><span>${notice}</span>`;
    }
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
      elements.list.innerHTML = state.dataMode === 'idle' ? `<div class="hc-empty-state"><strong>조회 전입니다</strong><p>지역과 보기 기준을 선택한 뒤 ${escapeHtml(meta().searchLabel)}를 눌러 주세요.</p></div>` : `<div class="hc-empty-state"><strong>${escapeHtml(meta().label)} 정보를 찾지 못했습니다</strong><p>지역을 바꾸거나 긴급 상황이면 119 또는 기관 전화로 확인해 주세요.</p></div>`;
      return;
    }
    elements.list.innerHTML = items.map((item, index) => {
      const phone = item.emergencyTel || item.mainTel || '';
      const kakaoAction = getKakaoAction(item);
      const kakaoUrl = kakaoAction.url;
      const kakaoLabel = kakaoAction.label;
      const isEmergency = isEmergencyItem(item);
      const metaGrid = isEmergency
        ? `<div><dt>가용 병상</dt><dd>${formatBeds(item.emergencyBeds)}</dd></div><div><dt>거리</dt><dd>${formatDistance(item.distanceM)}</dd></div><div><dt>전화</dt><dd>${escapeHtml(phone || '전화 확인')}</dd></div>`
        : `<div><dt>운영시간</dt><dd>${escapeHtml(item.operationTime || '전화 확인')}</dd></div><div><dt>거리</dt><dd>${formatDistance(item.distanceM)}</dd></div><div><dt>전화</dt><dd>${escapeHtml(phone || '전화 확인')}</dd></div>`;
      return `<article class="parking-result-card emergency-hospital-card emergency-hospital-card--ev ${state.selectedId === item.id ? 'selected' : ''}" data-hospital-id="${escapeHtml(item.id)}">
        <div class="emergency-rank"><span>${index + 1}</span></div>
        <div class="emergency-main">
          <div class="parking-card-head emergency-title-row"><div><strong>${escapeHtml(item.name || meta().label)}</strong></div><span class="emergency-status ${escapeHtml(item.statusTone || 'neutral')}">${escapeHtml(item.statusLabel || '전화 확인 필요')}</span></div>
          <p>${escapeHtml(item.address || '주소 정보 없음')}</p>
          <dl class="emergency-meta-grid">${metaGrid}</dl>
          ${renderStatusChips(item)}
        </div>
        <div class="parking-card-actions emergency-actions">
          ${phone ? `<a class="primary-mini-link" href="${buildTelLink(phone)}">전화하기</a>` : '<span class="secondary-mini-link disabled">전화 확인</span>'}
          <a class="secondary-mini-link" href="${kakaoUrl}" target="_blank" rel="noopener">${escapeHtml(kakaoLabel)}</a>
          <button type="button" class="secondary-mini-link as-button" data-detail-id="${escapeHtml(item.id)}">상세 보기</button>
        </div>
      </article>`;
    }).join('');
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
      elements.detail.innerHTML = `<h3>${escapeHtml(meta().detailTitle)}</h3><p>목록에서 항목을 선택하면 전화번호, 운영시간, 상태 정보, 카카오맵 버튼이 표시됩니다.</p>`;
      return;
    }
    const phone = item.emergencyTel || item.mainTel || '';
    const kakaoAction = getKakaoAction(item);
    const kakaoUrl = kakaoAction.url;
    const kakaoLabel = kakaoAction.label;
    if (!isEmergencyItem(item)) {
      elements.detail.innerHTML = `<h3>${escapeHtml(item.name || meta().label)}</h3>
        <p class="emergency-detail-address">${escapeHtml(item.address || '주소 정보 없음')}</p>
        <div class="emergency-detail-grid">
          <div><span>운영시간</span><strong>${escapeHtml(item.operationTime || '전화 확인')}</strong></div>
          <div><span>기관 유형</span><strong>${escapeHtml(item.hospitalType || meta().label)}</strong></div>
          <div><span>전화</span><strong>${escapeHtml(phone || '전화 확인')}</strong></div>
        </div>
        <div class="emergency-status-group"><h4>야간 방문 전 확인</h4><p class="fine-print">운영시간은 공공데이터 기준 참고 정보입니다. 접수 마감, 처방·조제 가능 여부, 휴게시간은 기관 전화로 다시 확인해 주세요.</p></div>
        <p class="fine-print">${escapeHtml(item.updatedAt ? `갱신 정보: ${item.updatedAt}` : '갱신 시점 정보가 없으면 기관에 직접 확인해 주세요.')}</p>
        <div class="emergency-detail-actions">
          ${phone ? `<a class="primary-link" href="${buildTelLink(phone)}">전화하기</a>` : ''}
          <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">${escapeHtml(kakaoLabel)}</a>
        </div>`;
      return;
    }
    elements.detail.innerHTML = `<h3>${escapeHtml(item.name || '응급의료기관')}</h3>
      <p class="emergency-detail-address">${escapeHtml(item.address || '주소 정보 없음')}</p>
      <div class="emergency-detail-grid">
        <div><span>가용 병상</span><strong>${formatBeds(item.emergencyBeds)}</strong></div>
        <div><span>중증질환 참고</span><strong>${escapeHtml(formatCriticalSummary(item))}</strong></div>
        <div><span>전화</span><strong>${escapeHtml(phone || '전화 확인')}</strong></div>
      </div>
      ${renderStatusGroup('중증질환 수용가능정보', item.criticalCare, '중증질환 수용가능정보가 없으면 119 또는 병원 전화로 확인해 주세요.')}
      ${renderStatusGroup('장비·시설 상태', item.facilityStatus, '장비·시설 상태 정보가 없으면 전화 확인이 필요합니다.')}
      <div class="emergency-status-group"><h4>응급실 메시지</h4>${renderMessages(item)}</div>
      <p class="fine-print">${escapeHtml(item.statusUpdatedAt || item.updatedAt ? `갱신 정보: ${item.statusUpdatedAt || item.updatedAt}` : '갱신 시점 정보가 없으면 병원에 직접 확인해 주세요.')}</p>
      <div class="emergency-detail-actions">
        ${phone ? `<a class="primary-link" href="${buildTelLink(phone)}">전화하기</a>` : ''}
        <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">${escapeHtml(kakaoLabel)}</a>
      </div>`;
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
      const sort = button.dataset.emergencySort;
      button.classList.toggle('is-hidden', (state.careMode === 'emergency' && sort === 'night') || (state.careMode !== 'emergency' && sort === 'critical') || (state.careMode !== 'emergency' && sort === 'beds'));
      button.classList.toggle('active', sort === (elements.sort?.value || 'distance'));
    });
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
  };

  const buildApiUrl = () => {
    const params = new URLSearchParams({
      region: elements.region?.value || '서울',
      district: elements.district?.value || '',
      keyword: elements.keyword?.value || '',
      department: elements.department?.value || '',
      sort: elements.sort?.value || (state.careMode === 'emergency' ? 'distance' : 'night'),
      mode: state.careMode,
      _v: 'v87',
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
    try {
      const data = await fetchJson(buildApiUrl(), { cache: 'no-store' });
      if (data?.ok === false) throw Object.assign(new Error(data.message || `${meta().label} 정보를 불러오지 못했습니다.`), { data });
      state.dataMode = 'api';
      state.items = Array.isArray(data.items) ? data.items : [];
      state.summary = data.summary || {};
      state.warnings = Array.isArray(data.warnings) ? data.warnings : [];
      state.selectedId = state.items[0]?.id || '';
      const suffix = state.careMode === 'emergency' ? '중증·상태 정보도 방문 전 전화 확인이 필요합니다.' : '운영시간과 접수 마감은 방문 전 전화 확인이 필요합니다.';
      setStatus(`${state.items.length.toLocaleString('ko-KR')}곳의 ${meta().label} 정보를 확인했습니다. ${suffix}`, 'success');
      render();
    } catch (error) {
      const message = error?.data?.message || error?.message || `${meta().label} 정보를 불러오지 못했습니다.`;
      setStatus(`${message} 응급 상황이면 119에 먼저 연락해 주세요.`, 'error');
      state.warnings = [message, '실제 방문 전 전화 확인이 필요합니다.'];
      renderWarnings();
    } finally {
      state.loading = false;
    }
  };

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
      const sort = button.dataset.emergencySort;
      if (sort && elements.sort) elements.sort.value = sort;
      syncModeUi();
      
    });
  });

  elements.list?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest('[data-hospital-id]');
    const id = target?.getAttribute('data-detail-id') || card?.getAttribute('data-hospital-id');
    if (!id) return;
    state.selectedId = id;
    render();
  });

  elements.markers?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-hospital-id]') : null;
    const id = target?.getAttribute('data-hospital-id');
    if (!id) return;
    state.selectedId = id;
    render();
  });

  ['change', 'input'].forEach((eventName) => {
    elements.region?.addEventListener(eventName, () => {  });
    elements.sort?.addEventListener(eventName, () => { syncModeUi();  });
  });

  resetToIdle();
  loadKakaoPlaceCache();
})();
