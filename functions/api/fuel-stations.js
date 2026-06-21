import {
  buildApiFailure,
  buildApiSuccess,
  cleanText,
  createRequestId,
  fetchTextWithTimeout,
  getEnv,
  jsonResponse,
  maskSecret,
  toNumber,
} from './_lib/check-core.js';

const SERVER_VERSION = 'v81-fuel-station-final';
const OPINET_SOURCE = 'OPINET PRICE DATA';
const OPINET_BASE_HTTPS = 'https://www.opinet.co.kr/api';
const OPINET_BASE_HTTP = 'http://www.opinet.co.kr/api';

const FUEL_META = {
  gasoline: { code: 'B027', label: '휘발유' },
  diesel: { code: 'D047', label: '경유' },
  premium: { code: 'B034', label: '고급휘발유' },
  lpg: { code: 'K015', label: 'LPG' },
};

const AREA_CODES = {
  all: '',
  전국: '',
  서울: '01',
  경기: '02',
  강원: '03',
  충북: '04',
  충남: '05',
  전북: '06',
  전남: '07',
  경북: '08',
  경남: '09',
  부산: '10',
  제주: '11',
  대구: '14',
  인천: '15',
  광주: '16',
  대전: '17',
  울산: '18',
  세종: '19',
};

const BRAND_LABELS = {
  SKE: 'SK에너지',
  GSC: 'GS칼텍스',
  HDO: '현대오일뱅크',
  SOL: 'S-OIL',
  RTE: '자영알뜰',
  RTX: '고속도로알뜰',
  NHO: '농협알뜰',
  ETC: '자가상표',
  E1G: 'E1',
  SKG: 'SK가스',
};

export async function onRequestGet({ request, env }) {
  const requestId = createRequestId('fuel');
  try {
    const url = new URL(request.url);
    const mode = cleanText(url.searchParams.get('mode') || url.searchParams.get('viewMode') || 'top20', 20);
    const key = getEnv(env, ['OPINET_API_KEY']);

    if (!key) {
      return jsonResponse(buildApiFailure({
        code: 'api_key_missing',
        message: 'OPINET_API_KEY가 설정되지 않았습니다. Cloudflare Pages Production 환경변수를 확인해 주세요.',
        status: 200,
        source: OPINET_SOURCE,
        requestId,
      }), { status: 200 });
    }

    if (mode === 'detail') {
      return jsonResponse(await handleDetail({ url, key, requestId }));
    }

    return jsonResponse(await handleList({ url, key, requestId }));
  } catch (error) {
    console.log('[OPINET fuel fatal]', { requestId, version: SERVER_VERSION, message: error?.message || String(error) });
    return jsonResponse(buildApiFailure({
      code: 'server_error',
      message: '주유소 가격 정보를 불러오는 중 오류가 발생했습니다.',
      status: 200,
      source: OPINET_SOURCE,
      requestId,
      detail: error?.message || String(error),
    }), { status: 200 });
  }
}

async function handleList({ url, key, requestId }) {
  const fuelType = normalizeFuelType(url.searchParams.get('fuelType') || url.searchParams.get('fuel') || 'gasoline');
  const fuel = FUEL_META[fuelType] || FUEL_META.gasoline;
  const region = cleanText(url.searchParams.get('region') || 'all', 30);
  const sort = cleanText(url.searchParams.get('sort') || 'cheap', 20);
  const viewMode = cleanText(url.searchParams.get('viewMode') || 'top20', 20);
  const lat = toNumber(url.searchParams.get('lat'), NaN);
  const lng = toNumber(url.searchParams.get('lng'), NaN);
  const radius = clampNumber(url.searchParams.get('radius'), 1000, 5000, 3000);
  const warnings = [];

  console.log('[OPINET fuel request]', {
    requestId,
    version: SERVER_VERSION,
    region,
    fuelType,
    prodcd: fuel.code,
    viewMode,
    sort,
    hasCoordinates: Number.isFinite(lat) && Number.isFinite(lng),
  });

  let listResult;
  if (viewMode === 'nearby' && Number.isFinite(lat) && Number.isFinite(lng)) {
    listResult = await fetchNearbyStations({ key, fuel, lat, lng, radius, sort, requestId });
  } else {
    if (viewMode === 'nearby') {
      warnings.push('현재 위치 좌표가 없어 지역별 최저가 주유소 기준으로 표시했습니다.');
    }
    listResult = await fetchTop20Stations({ key, fuel, region, requestId });
  }

  const averageResult = await fetchAveragePrice({ key, fuel, requestId }).catch((error) => {
    warnings.push('전국 평균가격을 불러오지 못했습니다.');
    console.log('[OPINET avg failed]', { requestId, version: SERVER_VERSION, message: error?.message || String(error) });
    return null;
  });

  let items = listResult.items;
  if (sort === 'nearby') {
    items = [...items].sort((a, b) => numberOrMax(a.distanceM) - numberOrMax(b.distanceM));
  } else if (sort === 'recommended') {
    items = [...items].sort((a, b) => (a.price + numberOrMax(a.distanceM) / 120) - (b.price + numberOrMax(b.distanceM) / 120));
  } else {
    items = [...items].sort((a, b) => a.price - b.price);
  }

  const average = averageResult?.price ?? computeAverage(items);
  const best = items[0] || null;
  const checkedAt = new Date().toISOString();

  const summary = {
    fuelType,
    fuelLabel: fuel.label,
    region,
    viewMode: listResult.viewMode,
    requestedViewMode: viewMode,
    sort,
    averagePrice: average,
    nationalAverage: averageResult,
    bestPrice: best?.price ?? null,
    bestStationName: best?.name || '',
    count: items.length,
    radiusM: listResult.radiusM || null,
    criteria: listResult.criteria,
    dataSource: OPINET_SOURCE,
  };

  console.log('[OPINET fuel result]', {
    requestId,
    version: SERVER_VERSION,
    viewMode: listResult.viewMode,
    count: items.length,
    firstItem: items[0] ? {
      id: items[0].id,
      name: items[0].name,
      price: items[0].price,
      brand: items[0].brand,
      distanceM: items[0].distanceM,
    } : null,
    average,
  });

  if (!items.length) {
    warnings.push('조건에 맞는 주유소 가격정보를 찾지 못했습니다. 지역 또는 유종을 바꿔 확인해 주세요.');
  }

  return buildApiSuccess({
    code: items.length ? 'fuel_stations_found' : 'empty',
    source: OPINET_SOURCE,
    requestId,
    summary,
    items,
    warnings,
    extra: {
      ok: true,
      serverVersion: SERVER_VERSION,
      checkedAt,
    },
  });
}

async function handleDetail({ url, key, requestId }) {
  const id = cleanText(url.searchParams.get('id') || '', 40);
  const fuelType = normalizeFuelType(url.searchParams.get('fuelType') || 'gasoline');
  const fuel = FUEL_META[fuelType] || FUEL_META.gasoline;
  if (!id) {
    return buildApiFailure({
      code: 'missing_station_id',
      message: '상세정보를 조회할 주유소 ID가 없습니다.',
      status: 200,
      source: OPINET_SOURCE,
      requestId,
    });
  }
  const result = await fetchOpinet('detailById.do', { out: 'json', id, certkey: key }, requestId);
  const rows = extractOilRows(result.data);
  const detail = normalizeDetail(rows[0] || {}, fuelType);
  const selectedPrice = detail.prices.find((item) => item.fuelType === fuelType) || null;
  return buildApiSuccess({
    code: detail.id ? 'station_detail_found' : 'empty',
    source: OPINET_SOURCE,
    requestId,
    summary: {
      stationId: id,
      fuelType,
      fuelLabel: fuel.label,
      selectedPrice: selectedPrice?.price ?? null,
      dataSource: OPINET_SOURCE,
    },
    items: detail.id ? [detail] : [],
    warnings: detail.id ? [] : ['주유소 상세정보를 찾지 못했습니다.'],
    extra: { serverVersion: SERVER_VERSION },
  });
}

async function fetchTop20Stations({ key, fuel, region, requestId }) {
  const areaCode = AREA_CODES[region] ?? AREA_CODES[normalizeRegion(region)] ?? '';
  const params = { out: 'json', prodcd: fuel.code, cnt: '20', certkey: key };
  if (areaCode) params.area = areaCode;
  const result = await fetchOpinet('lowTop10.do', params, requestId);
  const rows = extractOilRows(result.data);
  return {
    viewMode: 'top20',
    criteria: areaCode ? `${region} 지역 최저가 TOP20` : '전국 최저가 TOP20',
    items: rows.map((row, index) => normalizeStation(row, { fuelType: fuelKeyByCode(fuel.code), rank: index + 1, viewMode: 'top20' })).filter((item) => item.id && Number.isFinite(item.price)),
  };
}

async function fetchNearbyStations({ key, fuel, lat, lng, radius, sort, requestId }) {
  const katec = wgs84ToKatec(lat, lng);
  const params = {
    out: 'json',
    x: String(Math.round(katec.x)),
    y: String(Math.round(katec.y)),
    radius: String(radius),
    prodcd: fuel.code,
    sort: sort === 'nearby' ? '2' : '1',
    certkey: key,
  };
  const result = await fetchOpinet('aroundAll.do', params, requestId);
  const rows = extractOilRows(result.data);
  return {
    viewMode: 'nearby',
    criteria: `현재 위치 반경 ${radius.toLocaleString('ko-KR')}m`,
    radiusM: radius,
    items: rows.map((row, index) => normalizeStation(row, { fuelType: fuelKeyByCode(fuel.code), rank: index + 1, viewMode: 'nearby' })).filter((item) => item.id && Number.isFinite(item.price)),
  };
}

async function fetchAveragePrice({ key, fuel, requestId }) {
  const result = await fetchOpinet('avgAllPrice.do', { out: 'json', certkey: key }, requestId);
  const rows = extractOilRows(result.data);
  const row = rows.find((item) => cleanText(item.PRODCD || item.prodcd, 10) === fuel.code);
  if (!row) return null;
  return {
    fuelCode: fuel.code,
    fuelLabel: cleanText(row.PRODNM || row.prodnm || fuel.label, 40),
    price: roundPrice(toNumber(row.PRICE || row.price, NaN)),
    diff: cleanText(row.DIFF || row.diff || '', 20),
    tradeDate: formatDate(row.TRADE_DT || row.tradeDt || ''),
  };
}

async function fetchOpinet(endpoint, params, requestId) {
  const attempts = [OPINET_BASE_HTTPS, OPINET_BASE_HTTP];
  let lastError = null;
  for (const base of attempts) {
    const url = new URL(`${base}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
    try {
      const response = await fetchTextWithTimeout(url.toString(), { timeoutMs: 9000 });
      const preview = response.text.slice(0, 220).replace(/\s+/g, ' ');
      console.log('[OPINET fetch status]', {
        requestId,
        version: SERVER_VERSION,
        endpoint,
        protocol: url.protocol.replace(':', ''),
        status: response.status,
        contentType: response.contentType,
        params: maskParams(params),
        preview,
      });
      if (!response.ok) {
        lastError = new Error(`오피넷 API 응답 오류가 발생했습니다. (${response.status})`);
        continue;
      }
      const data = parseOpinetPayload(response.text, response.contentType);
      const condition = normalizeOpinetCondition(data);
      if (condition.code && !['00', '000', 'SUCCESS', ''].includes(condition.code)) {
        console.log('[OPINET condition]', { requestId, version: SERVER_VERSION, endpoint, condition });
      }
      return { data, condition, raw: response.text };
    } catch (error) {
      lastError = error;
      console.log('[OPINET fetch error]', {
        requestId,
        version: SERVER_VERSION,
        endpoint,
        protocol: url.protocol.replace(':', ''),
        params: maskParams(params),
        message: error?.message || String(error),
      });
    }
  }
  throw lastError || new Error('오피넷 API 호출에 실패했습니다.');
}

function parseOpinetPayload(text, contentType = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return {};
  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {}
  }
  return parseSimpleXml(trimmed);
}

function parseSimpleXml(xml) {
  const cleaned = String(xml || '').replace(/<\?xml[^>]*>/gi, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const oilRows = [];
  const oilMatches = cleaned.match(/<OIL\b[^>]*>[\s\S]*?<\/OIL>/gi) || [];
  oilMatches.forEach((block) => oilRows.push(parseXmlBlock(block)));
  const resultCode = getXmlTag(cleaned, 'RESULT_CODE') || getXmlTag(cleaned, 'resultCode') || getXmlTag(cleaned, 'CODE');
  const resultMsg = getXmlTag(cleaned, 'RESULT_MSG') || getXmlTag(cleaned, 'resultMsg') || getXmlTag(cleaned, 'MESSAGE');
  return { RESULT: { OIL: oilRows, RESULT_CODE: resultCode, RESULT_MSG: resultMsg } };
}

function parseXmlBlock(block) {
  const obj = {};
  const tagRegex = /<([A-Z0-9_]+)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagRegex.exec(block))) {
    const key = match[1];
    const value = match[2];
    if (/<[A-Z0-9_]+\b/i.test(value)) continue;
    obj[key] = decodeXml(value.trim());
  }
  const nestedPrices = block.match(/<OIL_PRICE\b[^>]*>[\s\S]*?<\/OIL_PRICE>/gi) || [];
  if (nestedPrices.length) obj.OIL_PRICE = nestedPrices.map(parseXmlBlock);
  return obj;
}

function getXmlTag(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractOilRows(data) {
  const result = data?.RESULT || data?.result || data;
  const oil = result?.OIL || result?.oil || result?.Oil || [];
  if (Array.isArray(oil)) return oil;
  if (oil && typeof oil === 'object') return [oil];
  return [];
}

function normalizeOpinetCondition(data) {
  const result = data?.RESULT || data?.result || data || {};
  const code = cleanText(result.RESULT_CODE || result.resultCode || result.CODE || '', 80);
  const message = cleanText(result.RESULT_MSG || result.resultMsg || result.MESSAGE || '', 240);
  return { code, message };
}

function normalizeStation(row, { fuelType, rank, viewMode }) {
  const brandCode = cleanText(row.POLL_DIV_CD || row.POLL_DIV_CO || row.pollDivCd || row.pollDivCo || '', 20);
  const price = roundPrice(toNumber(row.PRICE || row.price, NaN));
  const mapX = toNumber(row.GIS_X_COOR || row.gisXCoor || row.x, NaN);
  const mapY = toNumber(row.GIS_Y_COOR || row.gisYCoor || row.y, NaN);
  const distanceM = toNumber(row.DISTANCE || row.distance, NaN);
  return {
    id: cleanText(row.UNI_ID || row.uniId || row.id || '', 40),
    name: cleanText(row.OS_NM || row.osNm || row.name || '', 120),
    brandCode,
    brand: BRAND_LABELS[brandCode] || brandCode || '브랜드 정보 없음',
    address: cleanText(row.NEW_ADR || row.VAN_ADR || row.newAdr || row.vanAdr || '', 180),
    jibunAddress: cleanText(row.VAN_ADR || row.vanAdr || '', 180),
    roadAddress: cleanText(row.NEW_ADR || row.newAdr || '', 180),
    fuelType,
    price,
    distanceM: Number.isFinite(distanceM) ? distanceM : null,
    rank,
    mapX: Number.isFinite(mapX) ? mapX : null,
    mapY: Number.isFinite(mapY) ? mapY : null,
    services: [],
    updated: formatDate(row.TRADE_DT || row.tradeDt || ''),
    updatedTime: formatTime(row.TRADE_TM || row.tradeTm || ''),
    source: OPINET_SOURCE,
    viewMode,
    kakaoSearchUrl: buildKakaoSearchUrl(row.OS_NM || row.osNm || '', row.NEW_ADR || row.VAN_ADR || ''),
  };
}

function normalizeDetail(row, selectedFuelType) {
  const id = cleanText(row.UNI_ID || row.uniId || '', 40);
  const brandCode = cleanText(row.POLL_DIV_CD || row.POLL_DIV_CO || '', 20);
  const oilPrices = normalizeOilPriceRows(row.OIL_PRICE || row.oilPrice || []);
  return {
    id,
    name: cleanText(row.OS_NM || '', 120),
    brandCode,
    brand: BRAND_LABELS[brandCode] || brandCode || '브랜드 정보 없음',
    address: cleanText(row.NEW_ADR || row.VAN_ADR || '', 180),
    phone: cleanText(row.TEL || '', 40),
    lpgYn: cleanText(row.LPG_YN || '', 10),
    services: [
      row.CAR_WASH_YN === 'Y' ? '세차' : '',
      row.MAINT_YN === 'Y' ? '경정비' : '',
      row.CVS_YN === 'Y' ? '편의점' : '',
      row.KPETRO_YN === 'Y' ? '품질인증' : '',
    ].filter(Boolean),
    prices: oilPrices.map((priceRow) => ({
      fuelCode: cleanText(priceRow.PRODCD || '', 20),
      fuelType: fuelKeyByCode(priceRow.PRODCD),
      fuelLabel: FUEL_META[fuelKeyByCode(priceRow.PRODCD)]?.label || cleanText(priceRow.PRODCD || '', 20),
      price: roundPrice(toNumber(priceRow.PRICE, NaN)),
      updated: formatDate(priceRow.TRADE_DT || ''),
      updatedTime: formatTime(priceRow.TRADE_TM || ''),
    })).filter((item) => Number.isFinite(item.price)),
    selectedFuelType,
    source: OPINET_SOURCE,
  };
}

function normalizeOilPriceRows(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function normalizeFuelType(value) {
  const text = cleanText(value, 30).toLowerCase();
  if (['diesel', 'd047', '경유'].includes(text)) return 'diesel';
  if (['premium', 'b034', '고급', '고급휘발유'].includes(text)) return 'premium';
  if (['lpg', 'k015', '부탄', '자동차부탄'].includes(text)) return 'lpg';
  return 'gasoline';
}

function fuelKeyByCode(code = '') {
  const normalized = cleanText(code, 20).toUpperCase();
  return Object.entries(FUEL_META).find(([, meta]) => meta.code === normalized)?.[0] || 'gasoline';
}

function normalizeRegion(region) {
  return cleanText(region, 30).replace(/특별시|광역시|특별자치시|특별자치도|도/g, '');
}

function roundPrice(value) {
  return Number.isFinite(value) ? Math.round(value) : NaN;
}

function computeAverage(items) {
  const prices = items.map((item) => item.price).filter(Number.isFinite);
  if (!prices.length) return null;
  return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
}

function numberOrMax(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function formatDate(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function formatTime(value) {
  const digits = String(value || '').replace(/\D+/g, '').padEnd(6, '0');
  if (digits.length < 4) return '';
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function buildKakaoSearchUrl(name, address) {
  const query = cleanText(`${name || ''} ${address || ''}`, 180) || '주유소';
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

function maskParams(params) {
  const masked = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    masked[key] = key.toLowerCase().includes('key') ? maskSecret(value) : value;
  });
  return masked;
}

// Korean KATEC 좌표계 근사 변환. 오피넷 반경 검색은 KATEC x/y를 요구한다.
// Bessel 1841 타원체, 중부원점 계열 파라미터를 사용한다.
function wgs84ToKatec(lat, lon) {
  const besselLatLon = wgs84ToBessel(lat, lon);
  return tmForward(besselLatLon.lat, besselLatLon.lon);
}

function wgs84ToBessel(lat, lon) {
  const rad = Math.PI / 180;
  const phi = lat * rad;
  const lam = lon * rad;
  const h = 0;
  const a1 = 6378137.0;
  const f1 = 1 / 298.257223563;
  const e21 = 2 * f1 - f1 * f1;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lam);
  const cosLam = Math.cos(lam);
  const N = a1 / Math.sqrt(1 - e21 * sinPhi * sinPhi);
  const X = (N + h) * cosPhi * cosLam;
  const Y = (N + h) * cosPhi * sinLam;
  const Z = (N * (1 - e21) + h) * sinPhi;

  // WGS84 -> Korean Bessel approximate Bursa-Wolf inverse of common Korean datum shift.
  const dX = -115.80;
  const dY = 474.99;
  const dZ = 674.11;
  const bessel = cartesianToGeodetic(X + dX, Y + dY, Z + dZ, 6377397.155, 1 / 299.1528128);
  return { lat: bessel.lat, lon: bessel.lon };
}

function cartesianToGeodetic(X, Y, Z, a, f) {
  const e2 = 2 * f - f * f;
  const p = Math.sqrt(X * X + Y * Y);
  let phi = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 8; i += 1) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(Z + e2 * N * Math.sin(phi), p);
  }
  const lam = Math.atan2(Y, X);
  return { lat: phi * 180 / Math.PI, lon: lam * 180 / Math.PI };
}

function tmForward(lat, lon) {
  const rad = Math.PI / 180;
  const a = 6377397.155;
  const f = 1 / 299.1528128;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);
  const lat0 = 38 * rad;
  const lon0 = 128 * rad;
  const k0 = 0.9999;
  const falseE = 400000;
  const falseN = 600000;
  const phi = lat * rad;
  const lam = lon * rad;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = (lam - lon0) * Math.cos(phi);
  const M = meridionalArc(phi, a, e2);
  const M0 = meridionalArc(lat0, a, e2);
  const x = falseE + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = falseN + k0 * (M - M0 + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { x, y };
}

function meridionalArc(phi, a, e2) {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
}
