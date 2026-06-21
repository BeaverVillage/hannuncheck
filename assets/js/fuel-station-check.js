(() => {
  const root = document.querySelector('[data-fuel-station-tool]');
  if (!root) return;

  const toolkit = window.HannunCheckToolkit || {};
  const fetchJson = toolkit.fetchJson || ((url) => fetch(url, { cache: 'no-store' }).then((response) => response.json()));
  const formatNumber = toolkit.formatNumber || ((value, suffix = '') => `${Number(value || 0).toLocaleString('ko-KR')}${suffix}`);
  const formatDistance = toolkit.formatDistance || ((meters) => {
    const value = Number(meters || 0);
    if (!Number.isFinite(value) || value <= 0) return '거리 정보 없음';
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}km` : `${Math.round(value)}m`;
  });
  const buildKakaoSearchUrl = toolkit.buildKakaoSearchUrl || ((station) => `https://map.kakao.com/link/search/${encodeURIComponent(`${station.name} ${station.address}`)}`);

  const FUEL_LABELS = {
    gasoline: '휘발유',
    diesel: '경유',
    premium: '고급휘발유',
    lpg: 'LPG',
  };

  const SAMPLE_STATIONS = [
    { id: 'demo-dj-01', name: '한눈에너지 둔산점', region: '대전', brand: 'S-OIL', address: '대전 서구 둔산로 100', distanceM: 820, mapX: 27, mapY: 38, prices: { gasoline: 1624, diesel: 1498, premium: 1889, lpg: 969 }, services: ['세차', '편의점'], updated: '샘플', source: 'UI_SAMPLE' },
    { id: 'demo-dj-02', name: '대전중앙 셀프주유소', region: '대전', brand: '현대오일뱅크', address: '대전 중구 중앙로 80', distanceM: 1240, mapX: 48, mapY: 57, prices: { gasoline: 1632, diesel: 1508, premium: 1902, lpg: 982 }, services: ['셀프', '경정비'], updated: '샘플', source: 'UI_SAMPLE' },
    { id: 'demo-dj-03', name: '유성IC 주유소', region: '대전', brand: 'SK에너지', address: '대전 유성구 계룡로 20', distanceM: 2310, mapX: 68, mapY: 33, prices: { gasoline: 1651, diesel: 1512, premium: 1915, lpg: 988 }, services: ['세차', '셀프'], updated: '샘플', source: 'UI_SAMPLE' },
  ];

  const elements = {
    form: document.querySelector('#fuel-station-form'),
    region: document.querySelector('#fuel-region'),
    fuelType: document.querySelector('#fuel-type'),
    viewMode: document.querySelector('#fuel-view-mode'),
    sort: document.querySelector('#fuel-sort'),
    status: document.querySelector('#fuel-status'),
    best: document.querySelector('#fuel-best-card'),
    average: document.querySelector('#fuel-average-card'),
    count: document.querySelector('#fuel-count-card'),
    costTitle: document.querySelector('#fuel-cost-title'),
    costGrid: document.querySelector('#fuel-cost-grid'),
    liters: document.querySelector('#fuel-liters'),
    efficiency: document.querySelector('#fuel-efficiency'),
    extraDistance: document.querySelector('#fuel-extra-distance'),
    mapTitle: document.querySelector('#fuel-map-title'),
    mapNotice: document.querySelector('.fuel-map-notice'),
    markers: document.querySelector('#fuel-map-markers'),
    list: document.querySelector('#fuel-result-list'),
    listSummary: document.querySelector('#fuel-list-summary'),
    detail: document.querySelector('#fuel-detail-card'),
    reset: document.querySelector('#fuel-demo-reset'),
    location: document.querySelector('#fuel-use-location'),
    quickButtons: Array.from(document.querySelectorAll('.fuel-quick-row button')),
  };

  const state = {
    mode: 'sample',
    loading: false,
    stations: [],
    summary: {},
    warnings: [],
    geo: null,
    selectedId: '',
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getSelectedFuel = () => elements.fuelType?.value || 'gasoline';
  const getFuelLabel = () => FUEL_LABELS[getSelectedFuel()] || '선택 유종';
  const isSample = () => state.mode === 'sample';
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };
  const getFuelLiters = () => clamp(elements.liters?.value, 1, 120, 30);
  const getEfficiency = () => clamp(elements.efficiency?.value, 1, 40, 12);
  const getExtraDistanceKm = () => clamp(elements.extraDistance?.value, 0, 100, 0);
  const formatMoney = (value) => Number.isFinite(value) ? formatNumber(Math.round(value), '원') : '계산 불가';

  const getSampleStations = () => {
    const fuelType = getSelectedFuel();
    const sort = elements.sort?.value || 'cheap';
    const region = elements.region?.value || 'all';
    let stations = SAMPLE_STATIONS.filter((station) => Number.isFinite(station.prices[fuelType]));
    if (region !== 'all') stations = stations.filter((station) => station.region === region);
    if (!stations.length) stations = SAMPLE_STATIONS.filter((station) => Number.isFinite(station.prices[fuelType]));
    return [...stations].sort((a, b) => {
      if (sort === 'nearby') return (a.distanceM || 999999) - (b.distanceM || 999999);
      if (sort === 'recommended') return (a.prices[fuelType] + (a.distanceM || 0) / 45) - (b.prices[fuelType] + (b.distanceM || 0) / 45);
      return a.prices[fuelType] - b.prices[fuelType];
    });
  };

  const normalizeApiStation = (station) => ({
    ...station,
    prices: {
      [station.fuelType || getSelectedFuel()]: Number(station.price),
    },
    distanceM: Number.isFinite(Number(station.distanceM)) ? Number(station.distanceM) : null,
    mapX: Number.isFinite(Number(station.mapX)) ? Number(station.mapX) : null,
    mapY: Number.isFinite(Number(station.mapY)) ? Number(station.mapY) : null,
    services: Array.isArray(station.services) ? station.services : [],
    kakaoSearchUrl: station.kakaoSearchUrl || buildKakaoSearchUrl(station),
  });

  const getPrice = (station) => {
    const fuelType = getSelectedFuel();
    if (station.prices && Number.isFinite(station.prices[fuelType])) return station.prices[fuelType];
    if (Number.isFinite(station.price)) return station.price;
    return NaN;
  };

  const getAveragePrice = (stations) => {
    if (Number.isFinite(Number(state.summary.averagePrice))) return Number(state.summary.averagePrice);
    const prices = stations.map(getPrice).filter(Number.isFinite);
    if (!prices.length) return null;
    return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
  };

  const getTone = (price, average) => {
    if (!Number.isFinite(price) || !Number.isFinite(average)) return 'neutral';
    if (price <= average - 25) return 'good';
    if (price <= average + 20) return 'neutral';
    return 'caution';
  };

  const renderSummary = (stations) => {
    const fuelLabel = getFuelLabel();
    const average = getAveragePrice(stations);
    const best = stations[0];
    if (!best) {
      elements.best.innerHTML = '<span>최저가</span><strong>자료 없음</strong><small>조건을 바꿔 다시 확인해 주세요.</small>';
      elements.average.innerHTML = '<span>전국 평균</span><strong>자료 없음</strong><small>가격 비교 불가</small>';
      elements.count.innerHTML = '<span>표시 후보</span><strong>0곳</strong><small>조회 결과 없음</small>';
      return;
    }
    const bestPrice = getPrice(best);
    const gap = Number.isFinite(average) ? average - bestPrice : 0;
    const averageSource = isSample() ? '샘플 평균' : '전국 평균';
    const countLabel = isSample() ? '샘플 후보' : '조회 후보';
    elements.best.innerHTML = `<span>${escapeHtml(fuelLabel)} 최저가</span><strong>${formatNumber(bestPrice, '원/L')}</strong><small>${escapeHtml(best.name)} · ${escapeHtml(best.brand)}</small>`;
    elements.average.innerHTML = `<span>${averageSource}</span><strong>${Number.isFinite(average) ? formatNumber(average, '원/L') : '자료 없음'}</strong><small>${Number.isFinite(average) ? `최저가보다 ${formatNumber(Math.max(gap, 0), '원/L')} 높음` : '오피넷 평균가 미수신'}</small>`;
    elements.count.innerHTML = `<span>${countLabel}</span><strong>${stations.length}곳</strong><small>${escapeHtml(state.summary.criteria || getRegionLabel())} · ${escapeHtml(fuelLabel)}</small>`;
  };

  const renderCostPanel = (stations) => {
    if (!elements.costGrid) return;
    const liters = getFuelLiters();
    const efficiency = getEfficiency();
    const extraDistanceKm = getExtraDistanceKm();
    const average = getAveragePrice(stations);
    const best = stations[0];
    const fuelLabel = getFuelLabel();
    if (elements.costTitle) elements.costTitle.textContent = `${liters.toLocaleString('ko-KR')}L 기준 예상 비용`;

    if (!best) {
      elements.costGrid.innerHTML = `<article class="fuel-cost-card"><span>최저가 기준</span><strong>자료 없음</strong><small>주유소 조회 결과가 없습니다.</small></article><article class="fuel-cost-card"><span>평균가 기준</span><strong>자료 없음</strong><small>가격 비교 불가</small></article><article class="fuel-cost-card"><span>예상 절약</span><strong>자료 없음</strong><small>조건을 바꿔 다시 확인해 주세요.</small></article><article class="fuel-cost-card"><span>거리 고려</span><strong>자료 없음</strong><small>거리 정보가 없습니다.</small></article>`;
      return;
    }

    const bestPrice = getPrice(best);
    const averagePrice = Number.isFinite(average) ? average : null;
    const bestCost = Number.isFinite(bestPrice) ? bestPrice * liters : NaN;
    const averageCost = Number.isFinite(averagePrice) ? averagePrice * liters : NaN;
    const savings = Number.isFinite(averageCost) && Number.isFinite(bestCost) ? averageCost - bestCost : NaN;
    const roundTripKm = best.distanceM ? (Number(best.distanceM) * 2 / 1000) : null;
    const totalTravelKm = Number.isFinite(roundTripKm) ? roundTripKm + extraDistanceKm : (extraDistanceKm || null);
    const travelFuelLiters = Number.isFinite(totalTravelKm) && efficiency > 0 ? totalTravelKm / efficiency : NaN;
    const travelCost = Number.isFinite(travelFuelLiters) && Number.isFinite(bestPrice) ? travelFuelLiters * bestPrice : NaN;
    const netSavings = Number.isFinite(savings) && Number.isFinite(travelCost) ? savings - travelCost : NaN;
    const distanceNote = Number.isFinite(totalTravelKm)
      ? `왕복·추가 ${totalTravelKm.toFixed(totalTravelKm >= 10 ? 0 : 1)}km, 연비 ${efficiency.toFixed(1)}km/L 기준`
      : '거리 정보가 없으면 직접 절약액만 참고하세요.';
    const netLabel = Number.isFinite(netSavings)
      ? (netSavings >= 0 ? `${formatMoney(netSavings)} 이득 참고` : `${formatMoney(Math.abs(netSavings))} 손해 가능`)
      : '계산 불가';

    elements.costGrid.innerHTML = `<article class="fuel-cost-card main"><span>최저가 주유비</span><strong>${formatMoney(bestCost)}</strong><small>${escapeHtml(best.name)} · ${escapeHtml(fuelLabel)} ${formatNumber(bestPrice, '원/L')}</small></article><article class="fuel-cost-card"><span>평균가 기준</span><strong>${formatMoney(averageCost)}</strong><small>${Number.isFinite(averagePrice) ? `${formatNumber(averagePrice, '원/L')} 기준` : '평균가 자료 없음'}</small></article><article class="fuel-cost-card ${Number.isFinite(savings) && savings > 0 ? 'good' : ''}"><span>직접 예상 절약</span><strong>${Number.isFinite(savings) ? formatMoney(Math.max(savings, 0)) : '자료 없음'}</strong><small>주유량 ${liters.toLocaleString('ko-KR')}L 기준</small></article><article class="fuel-cost-card ${Number.isFinite(netSavings) && netSavings < 0 ? 'caution' : ''}"><span>거리 고려 참고</span><strong>${netLabel}</strong><small>${escapeHtml(distanceNote)}</small></article>`;
  };

  const getRegionLabel = () => elements.region.value === 'all' ? '전국' : elements.region.value;

  const getMarkerPositions = (stations) => {
    const values = stations
      .map((station) => ({ id: station.id, x: Number(station.mapX), y: Number(station.mapY) }))
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
    if (values.length >= 2 && !isSample()) {
      const xs = values.map((item) => item.x);
      const ys = values.map((item) => item.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      return Object.fromEntries(values.map((item) => [item.id, {
        x: Math.round(12 + ((item.x - minX) / spanX) * 76),
        y: Math.round(12 + (1 - ((item.y - minY) / spanY)) * 76),
      }]));
    }
    return {};
  };

  const renderMarkers = (stations) => {
    const average = getAveragePrice(stations);
    const positions = getMarkerPositions(stations);
    elements.markers.innerHTML = stations.map((station, index) => {
      const price = getPrice(station);
      const tone = getTone(price, average);
      const pos = positions[station.id] || { x: Number(station.mapX) || 18 + ((index * 17) % 66), y: Number(station.mapY) || 28 + ((index * 23) % 52) };
      return `<button type="button" class="fuel-marker ${tone}" style="left:${Math.min(90, Math.max(8, pos.x))}%;top:${Math.min(88, Math.max(10, pos.y))}%" data-station-id="${escapeHtml(station.id)}" aria-label="${escapeHtml(station.name)} ${formatNumber(price, '원/L')}"><span>${index + 1}</span><strong>${formatNumber(price, '원')}</strong></button>`;
    }).join('');
  };

  const renderList = (stations) => {
    const average = getAveragePrice(stations);
    const fuelLabel = getFuelLabel();
    elements.listSummary.textContent = `${state.summary.criteria || getRegionLabel()} · ${fuelLabel} · ${stations.length}곳`;
    elements.list.innerHTML = stations.map((station, index) => {
      const price = getPrice(station);
      const tone = getTone(price, average);
      const diff = Number.isFinite(average) ? price - average : 0;
      const diffText = Number.isFinite(average) ? (diff <= 0 ? `평균보다 ${formatNumber(Math.abs(diff), '원 저렴')}` : `평균보다 ${formatNumber(diff, '원 높음')}`) : '평균 비교 없음';
      const distance = station.distanceM ? `<span>${formatDistance(station.distanceM)}</span>` : '';
      const serviceTags = station.services?.length ? station.services.map((service) => `<span>${escapeHtml(service)}</span>`).join('') : '<span>상세 선택 시 확인</span>';
      return `<article class="fuel-station-card" data-station-id="${escapeHtml(station.id)}">
        <div class="fuel-station-rank">${index + 1}위</div>
        <div class="fuel-station-main">
          <div class="fuel-station-title"><strong>${escapeHtml(station.name)}</strong><span>${escapeHtml(station.brand)}</span></div>
          <p>${escapeHtml(station.address || station.jibunAddress || '주소 정보 없음')}</p>
          <div class="fuel-station-tags"><span class="hc-state-badge ${tone}">${escapeHtml(diffText)}</span>${distance}${serviceTags}</div>
        </div>
        <div class="fuel-station-price"><span>${escapeHtml(fuelLabel)}</span><strong>${formatNumber(price, '원')}</strong><small>리터당${station.updated ? ` · ${escapeHtml(station.updated)}` : ''}</small></div>
        <div class="fuel-station-actions"><button type="button" data-fuel-detail="${escapeHtml(station.id)}">상세 보기</button><a href="${escapeHtml(station.kakaoSearchUrl || buildKakaoSearchUrl(station))}" target="_blank" rel="noopener">카카오맵 검색</a></div>
      </article>`;
    }).join('');
  };

  const renderDetail = (station) => {
    const fuelLabel = getFuelLabel();
    const price = getPrice(station);
    const services = station.services?.length ? station.services.join(', ') : isSample() ? '자료 없음' : '상세정보 조회 전';
    const sourceLabel = isSample() ? 'UI 샘플' : '오피넷 제공 기준';
    elements.detail.innerHTML = `<h3>선택한 주유소</h3><div class="fuel-detail-name"><strong>${escapeHtml(station.name)}</strong><span>${escapeHtml(station.brand)}</span></div><p>${escapeHtml(station.address || station.jibunAddress || '주소 정보 없음')}</p><div class="fuel-detail-price"><span>${escapeHtml(fuelLabel)}</span><strong>${Number.isFinite(price) ? formatNumber(price, '원/L') : '가격 정보 없음'}</strong></div><ul class="checklist fuel-detail-list"><li>거리: ${station.distanceM ? formatDistance(station.distanceM) : '자료 없음'}</li><li>부가서비스: ${escapeHtml(services)}</li><li>가격 기준: ${escapeHtml(sourceLabel)}</li></ul><a class="secondary-action-button" href="${escapeHtml(station.kakaoSearchUrl || buildKakaoSearchUrl(station))}" target="_blank" rel="noopener">카카오맵 검색</a>`;
  };

  const renderWarnings = () => {
    if (!state.warnings.length) return '';
    return `<div class="fuel-warning-list">${state.warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}</div>`;
  };

  const render = (stations = state.stations) => {
    if (state.loading) return;
    const fuelLabel = getFuelLabel();
    renderSummary(stations);
    renderCostPanel(stations);
    renderMarkers(stations);
    renderList(stations);
    elements.mapTitle.textContent = `${state.summary.criteria || getRegionLabel()} ${fuelLabel} 주유소`;
    if (elements.mapNotice) {
      elements.mapNotice.innerHTML = isSample()
        ? '<strong>샘플 표시 중</strong><span>주유소 확인하기를 누르면 오피넷 실제 가격을 조회합니다.</span>'
        : '<strong>오피넷 가격 반영</strong><span>지도 표시는 가격 후보의 상대적 위치를 간단히 보여줍니다.</span>';
    }
    const warningMarkup = renderWarnings();
    if (warningMarkup) elements.list.insertAdjacentHTML('afterbegin', warningMarkup);
    if (stations[0]) renderDetail(stations.find((item) => item.id === state.selectedId) || stations[0]);
    updateQuickButtons();
  };

  const updateQuickButtons = () => {
    elements.quickButtons.forEach((button) => {
      const matchFuel = button.dataset.fuelType && button.dataset.fuelType === elements.fuelType.value;
      const matchSort = button.dataset.fuelSort && button.dataset.fuelSort === elements.sort.value;
      button.classList.toggle('active', Boolean(matchFuel || matchSort));
    });
  };

  const setStatus = (message, isError = false) => {
    elements.status.textContent = message;
    elements.status.classList.toggle('error-text', Boolean(isError));
  };

  const setLoading = (loading) => {
    state.loading = loading;
    const submit = elements.form?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = loading;
    if (elements.location) elements.location.disabled = loading;
  };

  const buildApiUrl = () => {
    const params = new URLSearchParams({
      region: elements.region.value,
      fuelType: getSelectedFuel(),
      viewMode: elements.viewMode.value,
      sort: elements.sort.value,
      _v: 'v77',
      _ts: String(Date.now()),
    });
    if (state.geo && elements.viewMode.value === 'nearby') {
      params.set('lat', String(state.geo.lat));
      params.set('lng', String(state.geo.lng));
      params.set('radius', '3000');
    }
    return `/api/fuel-stations?${params.toString()}`;
  };

  const loadStations = async () => {
    setLoading(true);
    setStatus('오피넷 주유소 가격 정보를 불러오는 중입니다.');
    try {
      const data = await fetchJson(buildApiUrl());
      if (!data.ok) {
        state.mode = 'api-error';
        state.warnings = data.message ? [data.message] : ['주유소 가격정보를 불러오지 못했습니다.'];
        setStatus(data.message || '주유소 가격정보를 불러오지 못했습니다.', true);
        state.stations = [];
        state.summary = {};
        render([]);
        return;
      }
      state.mode = 'api';
      state.summary = data.summary || {};
      state.warnings = Array.isArray(data.warnings) ? data.warnings : [];
      state.stations = (data.items || []).map(normalizeApiStation);
      setStatus(`${state.summary.criteria || getRegionLabel()} ${getFuelLabel()} 주유소 ${state.stations.length}곳을 오피넷 기준으로 확인했습니다.`);
      render(state.stations);
    } catch (error) {
      state.mode = 'api-error';
      state.warnings = ['네트워크 또는 API 오류로 주유소 정보를 불러오지 못했습니다.'];
      setStatus('주유소 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.', true);
      render([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('현재 위치 기능을 지원하지 않는 브라우저입니다.', true);
      return;
    }
    setStatus('현재 위치를 확인하는 중입니다.');
    navigator.geolocation.getCurrentPosition((position) => {
      state.geo = {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      };
      elements.viewMode.value = 'nearby';
      setStatus('현재 위치를 반영했습니다. 주유소 확인하기를 누르면 반경 내 주유소를 조회합니다.');
      updateQuickButtons();
    }, () => {
      setStatus('현재 위치를 가져오지 못했습니다. 지역 최저가 기준으로 확인해 주세요.', true);
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  };

  const resetSample = () => {
    state.mode = 'sample';
    state.summary = { criteria: '대전 샘플' };
    state.warnings = [];
    elements.region.value = '대전';
    elements.fuelType.value = 'gasoline';
    elements.viewMode.value = 'top20';
    elements.sort.value = 'cheap';
    state.stations = getSampleStations();
    setStatus('샘플 데이터를 표시했습니다. 실제 가격은 주유소 확인하기를 눌러 조회하세요.');
    render(state.stations);
  };

  [elements.liters, elements.efficiency, elements.extraDistance].forEach((element) => {
    element?.addEventListener('input', () => {
      renderCostPanel(state.stations);
    });
  });

  elements.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadStations();
  });

  elements.reset?.addEventListener('click', resetSample);
  elements.location?.addEventListener('click', getCurrentLocation);

  elements.quickButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.fuelType) elements.fuelType.value = button.dataset.fuelType;
      if (button.dataset.fuelSort) elements.sort.value = button.dataset.fuelSort;
      if (isSample()) {
        state.stations = getSampleStations();
        render(state.stations);
      } else {
        setStatus('조건을 바꿨습니다. 주유소 확인하기를 눌러 최신 가격을 다시 조회해 주세요.');
        updateQuickButtons();
      }
    });
  });

  [elements.region, elements.fuelType, elements.sort, elements.viewMode].forEach((element) => {
    element?.addEventListener('change', () => {
      if (isSample()) {
        state.stations = getSampleStations();
        state.summary = { criteria: `${getRegionLabel()} 샘플` };
        render(state.stations);
      } else {
        setStatus('조건을 바꿨습니다. 주유소 확인하기를 눌러 다시 조회해 주세요.');
      }
    });
  });

  elements.list?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-fuel-detail]');
    const card = event.target.closest('[data-station-id]');
    const id = button?.dataset.fuelDetail || card?.dataset.stationId;
    if (!id) return;
    state.selectedId = id;
    const station = state.stations.find((item) => item.id === id) || getSampleStations().find((item) => item.id === id);
    if (station) renderDetail(station);
  });

  elements.markers?.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-station-id]');
    const station = state.stations.find((item) => item.id === marker?.dataset.stationId) || getSampleStations().find((item) => item.id === marker?.dataset.stationId);
    if (station) {
      state.selectedId = station.id;
      renderDetail(station);
    }
  });

  resetSample();
})();
