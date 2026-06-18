const EV_ENDPOINT = 'https://apis.data.go.kr/B552584/EvCharger/getChargerInfo';
const MAX_ROWS = 9999;
const ZCODE_MAP = {
  서울: '11', 부산: '26', 대구: '27', 인천: '28', 광주: '29', 대전: '30', 울산: '31', 세종: '36', 경기: '41', 강원: '42', 충북: '43', 충남: '44', 전북: '45', 전남: '46', 경북: '47', 경남: '48', 제주: '50'
};
const STATUS_LABELS = { '1': '통신이상', '2': '사용 가능', '3': '충전 중', '4': '운영중지', '5': '점검중', '9': '상태 미확인' };
const TYPE_LABELS = { '01': 'DC차데모', '02': 'AC완속', '03': 'DC차데모+AC3상', '04': 'DC콤보', '05': 'DC차데모+DC콤보', '06': 'DC차데모+AC3상+DC콤보', '07': 'AC3상', '89': '수소', '99': '기타' };

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'max-age=60',
    ...init.headers
  }
});

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ request, env }) {
  try {
    const key = getEnv(env, ['EV_CHARGER_API_KEY', 'DATA_GO_KR_SERVICE_KEY', 'PUBLIC_DATA_SERVICE_KEY']);
    if (!key) return json({ ok: false, message: '전기차 충전소 API 키가 설정되지 않았습니다.' }, { status: 500 });

    const url = new URL(request.url);
    const lat = toNumber(url.searchParams.get('lat'), 37.5665);
    const lng = toNumber(url.searchParams.get('lng'), 126.9780);
    const radius = Math.min(Math.max(toNumber(url.searchParams.get('radius'), 3000), 500), 20000);
    const sido = normalizeSido(url.searchParams.get('sido') || '서울');
    const zcode = url.searchParams.get('zcode') || ZCODE_MAP[sido] || '11';
    const chargerType = clean(url.searchParams.get('chargerType'), 20);
    const speed = clean(url.searchParams.get('speed'), 12);
    const freeParking = url.searchParams.get('freeParking') === 'true';
    const noLimit = url.searchParams.get('noLimit') === 'true';

    const apiUrl = new URL(EV_ENDPOINT);
    apiUrl.searchParams.set('serviceKey', key);
    apiUrl.searchParams.set('pageNo', '1');
    apiUrl.searchParams.set('numOfRows', String(MAX_ROWS));
    apiUrl.searchParams.set('zcode', zcode);
    apiUrl.searchParams.set('dataType', 'JSON');

    const data = await fetchJson(apiUrl.toString());
    const items = extractItems(data).map((item) => normalizeCharger(item, { lat, lng }));
    const filtered = items
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .filter((item) => item.distanceM <= radius)
      .filter((item) => !chargerType || item.typeCode === chargerType || item.typeLabel.includes(chargerType))
      .filter((item) => speed !== 'rapid' || item.isRapid)
      .filter((item) => speed !== 'slow' || !item.isRapid)
      .filter((item) => !freeParking || item.parkingFree === true)
      .filter((item) => !noLimit || item.limitYn === false)
      .sort((a, b) => b.score - a.score || a.distanceM - b.distanceM)
      .slice(0, 120);

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      center: { lat, lng, radius, sido, zcode },
      totalInRegion: items.length,
      count: filtered.length,
      chargers: groupByStation(filtered).slice(0, 60),
      rawItems: filtered.slice(0, 80)
    });
  } catch (error) {
    return json({ ok: false, message: error?.message || '전기차 충전소 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

function normalizeCharger(item, center) {
  const lat = toNumber(item.lat || item.LAT, NaN);
  const lng = toNumber(item.lng || item.LNG, NaN);
  const stat = String(item.stat ?? item.STAT ?? '').trim();
  const typeCode = String(item.chgerType ?? item.CHGER_TYPE ?? '').padStart(2, '0');
  const output = toNumber(item.output || item.OUTPUT, 0);
  const distanceM = distance(center.lat, center.lng, lat, lng);
  const isAvailable = stat === '2';
  const isRapid = output >= 40 || ['01', '03', '04', '05', '06'].includes(typeCode);
  const parkingFree = normalizeBoolean(item.parkingFree || item.PARKING_FREE);
  const limitYn = normalizeBoolean(item.limitYn || item.LIMIT_YN);
  const updatedAt = String(item.statUpdDt || item.STAT_UPD_DT || '').trim();
  const score = buildScore({ isAvailable, stat, distanceM, isRapid, parkingFree, limitYn, updatedAt });
  return {
    stationId: String(item.statId || item.STAT_ID || ''),
    chargerId: String(item.chgerId || item.CHGER_ID || ''),
    name: String(item.statNm || item.STAT_NM || '충전소').trim(),
    address: String(item.addr || item.ADDR || '').trim(),
    locationDetail: String(item.location || item.LOCATION || '').trim(),
    useTime: String(item.useTime || item.USE_TIME || '').trim(),
    business: String(item.bnm || item.BNM || item.busiNm || '').trim(),
    operator: String(item.busiNm || item.BUSI_NM || item.bnm || '').trim(),
    typeCode,
    typeLabel: TYPE_LABELS[typeCode] || `타입 ${typeCode}`,
    output,
    method: String(item.method || item.METHOD || '').trim(),
    stat,
    statLabel: STATUS_LABELS[stat] || '상태 정보 없음',
    isAvailable,
    isRapid,
    parkingFree,
    limitYn,
    note: String(item.note || item.NOTE || '').trim(),
    lat,
    lng,
    distanceM,
    updatedAt: formatDateTime(updatedAt),
    score,
    raw: item
  };
}

function groupByStation(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.stationId || `${item.name}-${item.address}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.name,
        address: item.address,
        useTime: item.useTime,
        business: item.business || item.operator,
        lat: item.lat,
        lng: item.lng,
        distanceM: item.distanceM,
        parkingFree: item.parkingFree,
        limitYn: item.limitYn,
        updatedAt: item.updatedAt,
        chargers: [],
        availableCount: 0,
        chargingCount: 0,
        troubleCount: 0,
        unknownCount: 0,
        rapidCount: 0,
        slowCount: 0,
        bestScore: item.score
      });
    }
    const group = map.get(key);
    group.chargers.push(item);
    group.distanceM = Math.min(group.distanceM, item.distanceM);
    group.bestScore = Math.max(group.bestScore, item.score);
    group.availableCount += item.isAvailable ? 1 : 0;
    group.chargingCount += item.stat === '3' ? 1 : 0;
    group.troubleCount += ['1', '4', '5'].includes(item.stat) ? 1 : 0;
    group.unknownCount += item.stat === '9' || !item.stat ? 1 : 0;
    group.rapidCount += item.isRapid ? 1 : 0;
    group.slowCount += item.isRapid ? 0 : 1;
    if (!group.updatedAt && item.updatedAt) group.updatedAt = item.updatedAt;
  }
  return Array.from(map.values())
    .map((group) => ({
      ...group,
      statusTone: group.availableCount > 0 ? 'good' : (group.chargingCount > 0 ? 'busy' : (group.troubleCount > 0 ? 'bad' : 'unknown')),
      availabilityLabel: group.availableCount > 0 ? '사용 가능성 높음' : (group.chargingCount > 0 ? '충전 중 확인 필요' : '상태 확인 필요')
    }))
    .sort((a, b) => b.bestScore - a.bestScore || a.distanceM - b.distanceM);
}

function buildScore({ isAvailable, stat, distanceM, isRapid, parkingFree, limitYn, updatedAt }) {
  let score = 60;
  if (isAvailable) score += 35;
  if (stat === '3') score += 8;
  if (['1', '4', '5'].includes(stat)) score -= 35;
  if (stat === '9' || !stat) score -= 18;
  if (isRapid) score += 8;
  if (parkingFree) score += 5;
  if (limitYn === false) score += 5;
  if (limitYn === true) score -= 8;
  if (Number.isFinite(distanceM)) score += Math.max(-25, 18 - distanceM / 250);
  if (updatedAt) score += 3;
  return Math.round(score);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`전기차 충전소 API 응답 오류가 발생했습니다. (${response.status})`);
  if (typeof data?.raw === 'string' && data.raw.includes('<OpenAPI_ServiceResponse>')) {
    throw new Error('공공데이터포털 API 키 승인 또는 요청 파라미터를 확인해 주세요.');
  }
  return data || {};
}

function extractItems(data) {
  const body = data?.response?.body || data?.body || data;
  const items = body?.items?.item || body?.items || data?.items?.item || data?.items || [];
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return [items];
  return [];
}

function normalizeBoolean(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', '무료', '가능'].includes(text)) return true;
  if (['N', 'NO', 'FALSE', '0', '유료', '불가'].includes(text)) return false;
  return null;
}

function normalizeSido(value) {
  const text = String(value || '').trim();
  const aliases = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 제주도: '제주' };
  return aliases[text] || text || '서울';
}

function distance(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDateTime(value) {
  const text = String(value || '').replace(/\D/g, '');
  if (text.length < 12) return value || '';
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}`;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function clean(value, max) { return String(value || '').trim().slice(0, max); }
function getEnv(env, keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
