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

  const MODE_META = {
    emergency: { label: '응급실', searchLabel: '응급실 확인하기', listLabel: '응급실 비교 목록', sampleLabel: '샘플 응급실', mapSuffix: '응급실', detailTitle: '선택한 응급실' },
    hospital: { label: '야간 병원', searchLabel: '야간 병원 확인하기', listLabel: '야간 병원 비교 목록', sampleLabel: '샘플 야간 병원', mapSuffix: '야간 병원', detailTitle: '선택한 야간 병원' },
    pharmacy: { label: '야간 약국', searchLabel: '야간 약국 확인하기', listLabel: '야간 약국 비교 목록', sampleLabel: '샘플 야간 약국', mapSuffix: '야간 약국', detailTitle: '선택한 야간 약국' },
  };

  const SAMPLE_ITEMS = {
    emergency: [
      {
        id: 'sample-er-01', kind: 'emergency', name: '한눈대학교병원 응급실', address: '대전 서구 둔산로 100', region: '대전', distanceM: 2100,
        emergencyBeds: 9, totalBeds: 120, emergencyTel: '042-000-0119', mainTel: '042-000-0000', statusLabel: '병상·중증 정보 있음', statusTone: 'good', lat: 36.3504, lng: 127.3845, updatedAt: '샘플',
        facilityStatus: [{ label: 'CT', tone: 'good', value: 'Y' }, { label: 'MRI', tone: 'good', value: 'Y' }, { label: '수술실', tone: 'good', value: '2' }], facilityAvailableCount: 3,
        criticalCare: [{ label: '심근경색 재관류', tone: 'good', value: 'Y' }, { label: '응급내시경', tone: 'good', value: 'Y' }, { label: '중증화상', tone: 'caution', value: 'N' }], criticalAvailableCount: 2,
        messages: [{ type: '상태 메시지', message: '샘플 메시지입니다. 실제 데이터는 조회 후 표시됩니다.' }],
      },
      {
        id: 'sample-er-02', kind: 'emergency', name: '대전중앙병원 응급의료센터', address: '대전 중구 중앙로 80', region: '대전', distanceM: 3600,
        emergencyBeds: 2, totalBeds: 70, emergencyTel: '042-111-0119', mainTel: '042-111-0000', statusLabel: '가용 병상 있음', statusTone: 'good', lat: 36.3287, lng: 127.4210, updatedAt: '샘플',
        facilityStatus: [{ label: 'CT', tone: 'good', value: 'Y' }, { label: 'MRI', tone: 'caution', value: 'N' }], facilityAvailableCount: 1,
        criticalCare: [{ label: '응급투석', tone: 'good', value: 'Y' }], criticalAvailableCount: 1, messages: [],
      },
      {
        id: 'sample-er-03', kind: 'emergency', name: '유성응급의료기관', address: '대전 유성구 대학로 30', region: '대전', distanceM: 6400,
        emergencyBeds: null, totalBeds: null, emergencyTel: '042-222-0119', mainTel: '042-222-0000', statusLabel: '전화 확인 필요', statusTone: 'neutral', lat: 36.3621, lng: 127.3562, updatedAt: '샘플',
        facilityStatus: [{ label: 'CT', tone: 'neutral', value: '확인 필요' }], facilityAvailableCount: 0, criticalCare: [], criticalAvailableCount: 0,
        messages: [{ type: '상태 메시지', message: '병상 정보가 없으면 전화 확인이 필요합니다.' }],
      },
    ],
    hospital: [
      { id: 'sample-hp-01', kind: 'hospital', name: '한눈야간의원', address: '대전 서구 둔산중로 20', region: '대전', distanceM: 1800, mainTel: '042-333-1000', statusLabel: '야간 운영 참고', statusTone: 'good', operationTime: '09:00 ~ 22:00', hospitalType: '의원', department: '내과·소아청소년과', isNightCandidate: true, lat: 36.3490, lng: 127.3812, messages: [] },
      { id: 'sample-hp-02', kind: 'hospital', name: '대전가정의학과의원', address: '대전 중구 중앙로 55', region: '대전', distanceM: 4100, mainTel: '042-333-2000', statusLabel: '운영시간 확인', statusTone: 'neutral', operationTime: '09:00 ~ 18:30', hospitalType: '의원', department: '가정의학과', isNightCandidate: true, lat: 36.3270, lng: 127.4200, messages: [] },
    ],
    pharmacy: [
      { id: 'sample-ph-01', kind: 'pharmacy', name: '한눈365약국', address: '대전 서구 둔산로 11', region: '대전', distanceM: 1200, mainTel: '042-444-7000', statusLabel: '심야 운영 참고', statusTone: 'good', operationTime: '08:30 ~ 23:30', hospitalType: '약국', department: '처방·일반의약품', isNightCandidate: true, lat: 36.3510, lng: 127.3841, messages: [] },
      { id: 'sample-ph-02', kind: 'pharmacy', name: '대전중앙약국', address: '대전 중구 중앙로 90', region: '대전', distanceM: 3700, mainTel: '042-444-8000', statusLabel: '운영시간 확인', statusTone: 'neutral', operationTime: '09:00 ~ 19:00', hospitalType: '약국', department: '약국', isNightCandidate: true, lat: 36.3290, lng: 127.4193, messages: [] },
    ],
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
    reset: document.querySelector('#emergency-demo-reset'),
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
    dataMode: 'sample',
    careMode: 'emergency',
    loading: false,
    geo: null,
    items: [],
    summary: {},
    warnings: [],
    selectedId: '',
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const meta = () => MODE_META[state.careMode] || MODE_META.emergency;
  const getRegionLabel = () => elements.region?.value || '대전';
  const isSample = () => state.dataMode === 'sample';
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

  const getSampleItems = () => {
    const region = getRegionLabel();
    let items = SAMPLE_ITEMS[state.careMode] || SAMPLE_ITEMS.emergency;
    items = items.filter((item) => !region || region === 'all' || item.region === region);
    if (!items.length) items = SAMPLE_ITEMS[state.careMode] || SAMPLE_ITEMS.emergency;
    return sortItems(items, elements.sort?.value || 'distance');
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
      elements.summaryCount.innerHTML = `<span>${isSample() ? '샘플 후보' : '조회 후보'}</span><strong>${count.toLocaleString('ko-KR')}곳</strong><small>${escapeHtml(getRegionLabel())} · 응급실 상태 확인</small>`;
      elements.summaryBeds.innerHTML = `<span>가용 병상 표시</span><strong>${withBeds.toLocaleString('ko-KR')}곳</strong><small>공공데이터 기준 · 전화 확인 필요</small>`;
      elements.summaryPhone.innerHTML = `<span>전화 가능 후보</span><strong>${phoneCount.toLocaleString('ko-KR')}곳</strong><small>${nearest ? `가까운 후보 ${formatDistance(nearest.distanceM)}` : '전화 확인 우선'}</small>`;
      if (elements.summaryStatus) elements.summaryStatus.innerHTML = `<span>중증·상태 정보</span><strong>${criticalCount.toLocaleString('ko-KR')}곳</strong><small>${messageCount ? `상태 메시지 ${messageCount}곳` : '병상 외 상태 정보 참고'}</small>`;
      return;
    }
    const nightCount = items.filter((item) => item.isNightCandidate).length;
    elements.summaryCount.innerHTML = `<span>${isSample() ? '샘플 후보' : '조회 후보'}</span><strong>${count.toLocaleString('ko-KR')}곳</strong><small>${escapeHtml(getRegionLabel())} · ${escapeHtml(meta().label)} 확인</small>`;
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
    if (elements.mapTitle) elements.mapTitle.textContent = isSample() ? `${getRegionLabel()} 주변 ${meta().mapSuffix} 샘플` : `${state.summary.criteria || getRegionLabel()} ${meta().mapSuffix}`;
    if (elements.mapNotice) {
      const notice = state.careMode === 'emergency'
        ? '중증·장비 상태도 참고용입니다. 방문 전 전화 확인이 필요합니다.'
        : '운영시간은 참고용입니다. 야간 접수와 조제 가능 여부는 전화 확인이 필요합니다.';
      elements.mapNotice.innerHTML = `<strong>${isSample() ? `${meta().label} 미리보기` : '국립중앙의료원 데이터'}</strong><span>${isSample() ? '검색 버튼을 누르면 실제 공공데이터 정보를 조회합니다.' : notice}</span>`;
    }
    elements.markers.innerHTML = items.slice(0, 12).map((item, index) => {
      const pos = makeMapPosition(item, index, items.length);
      const tone = item.statusTone || (Number(item.emergencyBeds) > 0 ? 'good' : 'neutral');
      return `<button type="button" class="emergency-map-marker ${escapeHtml(tone)}" style="left:${pos.x}%;top:${pos.y}%" data-hospital-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)}"><span>${index + 1}</span><strong>${escapeHtml(markerText(item))}</strong></button>`;
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
    elements.listSummary.textContent = isSample() ? meta().sampleLabel : `조회 결과 ${items.length}곳`;
    if (elements.listTitle) elements.listTitle.textContent = meta().listLabel;
    if (!items.length) {
      elements.list.innerHTML = `<div class="hc-empty-state"><strong>${escapeHtml(meta().label)} 정보를 찾지 못했습니다</strong><p>지역을 바꾸거나 긴급 상황이면 119 또는 기관 전화로 확인해 주세요.</p></div>`;
      return;
    }
    elements.list.innerHTML = items.map((item, index) => {
      const phone = item.emergencyTel || item.mainTel || '';
      const kakaoUrl = buildKakaoSearchUrl(item);
      const isEmergency = isEmergencyItem(item);
      const metaGrid = isEmergency
        ? `<div><dt>가용 병상</dt><dd>${formatBeds(item.emergencyBeds)}</dd></div><div><dt>거리</dt><dd>${formatDistance(item.distanceM)}</dd></div><div><dt>중증 정보</dt><dd>${escapeHtml(formatCriticalSummary(item))}</dd></div><div><dt>장비 상태</dt><dd>${escapeHtml(formatFacilitySummary(item))}</dd></div>`
        : `<div><dt>운영시간</dt><dd>${escapeHtml(item.operationTime || '전화 확인')}</dd></div><div><dt>거리</dt><dd>${formatDistance(item.distanceM)}</dd></div><div><dt>기관 유형</dt><dd>${escapeHtml(item.hospitalType || (state.careMode === 'pharmacy' ? '약국' : '병·의원'))}</dd></div><div><dt>진료/분류</dt><dd>${escapeHtml(item.department || '전화 확인')}</dd></div>`;
      return `<article class="emergency-hospital-card ${state.selectedId === item.id ? 'selected' : ''}" data-hospital-id="${escapeHtml(item.id)}">
        <div class="emergency-rank"><span>${index + 1}</span></div>
        <div class="emergency-main">
          <div class="emergency-title-row"><h3>${escapeHtml(item.name || meta().label)}</h3><span class="emergency-status ${escapeHtml(item.statusTone || 'neutral')}">${escapeHtml(item.statusLabel || '전화 확인 필요')}</span></div>
          <p>${escapeHtml(item.address || '주소 정보 없음')}</p>
          <dl class="emergency-meta-grid">${metaGrid}</dl>
          ${renderStatusChips(item)}
        </div>
        <div class="emergency-actions">
          ${phone ? `<a class="primary-mini-link" href="${buildTelLink(phone)}">전화하기</a>` : '<span class="secondary-mini-link disabled">전화 확인</span>'}
          <a class="secondary-mini-link" href="${kakaoUrl}" target="_blank" rel="noopener">카카오맵</a>
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
      elements.detail.innerHTML = `<h3>${escapeHtml(meta().detailTitle)}</h3><p>목록에서 항목을 선택하면 전화번호, 운영시간, 상태 정보, 카카오맵 검색 버튼이 표시됩니다.</p>`;
      return;
    }
    const phone = item.emergencyTel || item.mainTel || '';
    const kakaoUrl = buildKakaoSearchUrl(item);
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
          <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">카카오맵 검색</a>
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
        <a class="secondary-link" href="${kakaoUrl}" target="_blank" rel="noopener">카카오맵 검색</a>
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

  const loadSample = () => {
    state.dataMode = 'sample';
    state.items = getSampleItems();
    state.summary = { criteria: `${getRegionLabel()} ${meta().sampleLabel}` };
    state.warnings = state.careMode === 'emergency'
      ? ['샘플 데이터입니다. 실제 응급실 조회는 검색 버튼을 누르면 국립중앙의료원 API 기준으로 표시됩니다.', '중증질환 수용가능정보와 장비 상태는 참고 정보이며 실제 수용 가능 여부는 전화 확인이 필요합니다.', '응급 상황이면 119에 먼저 연락하세요.']
      : ['샘플 데이터입니다. 실제 조회는 검색 버튼을 누르면 국립중앙의료원 API 기준으로 표시됩니다.', '야간 병원·약국 운영시간과 접수 마감은 실제 현장 상황과 다를 수 있습니다. 방문 전 전화 확인이 필요합니다.'];
    state.selectedId = state.items[0]?.id || '';
    syncModeUi();
    setStatus(`${meta().sampleLabel} 정보를 표시했습니다. 실제 조회는 ${meta().searchLabel}를 눌러 주세요.`, 'info');
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
      _v: 'v80',
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
      loadSample();
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

  elements.reset?.addEventListener('click', () => {
    state.geo = null;
    loadSample();
  });

  elements.quickButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sort = button.dataset.emergencySort;
      if (sort && elements.sort) elements.sort.value = sort;
      syncModeUi();
      if (isSample()) loadSample();
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
    elements.region?.addEventListener(eventName, () => { if (isSample()) loadSample(); });
    elements.sort?.addEventListener(eventName, () => { syncModeUi(); if (isSample()) loadSample(); });
  });

  loadSample();
})();
