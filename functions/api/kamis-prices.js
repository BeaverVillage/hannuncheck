const KAMIS_DAILY_ENDPOINT = 'https://www.kamis.or.kr/service/price/xml.do?action=dailyPriceByCategoryList';
const CATEGORY_LABELS = {
  '100': '식량작물',
  '200': '채소류',
  '300': '특용작물',
  '400': '과일류',
  '500': '축산물',
  '600': '수산물',
};
const MARKET_TYPES = {
  retail: { code: '01', label: '소매가격' },
  wholesale: { code: '02', label: '도매가격' },
};
const REGION_CODES = {
  전국: '',
  서울: '1101',
  부산: '2100',
  대구: '2200',
  인천: '2300',
  광주: '2401',
  대전: '2501',
  울산: '2601',
  세종: '2701',
  경기: '3111',
  강원: '3214',
  충북: '3311',
  충남: '3411',
  전북: '3511',
  전남: '3613',
  경북: '3714',
  경남: '3814',
  제주: '3911',
};
const WHOLESALE_REGION_CODES = new Set(['', '1101', '2100', '2200', '2401', '2501']);
const ITEM_CATEGORY_HINTS = {
  쌀: '100', 찹쌀: '100', 콩: '100', 팥: '100', 녹두: '100', 고구마: '100', 감자: '100',
  배추: '200', 양배추: '200', 시금치: '200', 상추: '200', 얼갈이배추: '200', 수박: '200', 참외: '200', 오이: '200', 호박: '200', 토마토: '200', 딸기: '200', 무: '200', 당근: '200', 열무: '200', 건고추: '200', 풋고추: '200', 붉은고추: '200', 마늘: '200', 양파: '200', 파: '200', 대파: '200', 생강: '200', 미나리: '200', 깻잎: '200', 피망: '200', 파프리카: '200', 멜론: '200', 방울토마토: '200',
  참깨: '300', 들깨: '300', 땅콩: '300', 느타리버섯: '300', 팽이버섯: '300', 새송이버섯: '300', 호두: '300', 아몬드: '300',
  사과: '400', 배: '400', 복숭아: '400', 포도: '400', 감귤: '400', 단감: '400', 바나나: '400', 참다래: '400', 파인애플: '400', 오렌지: '400', 레몬: '400', 망고: '400', 체리: '400', 아보카도: '400',
  쇠고기: '500', 소고기: '500', 돼지고기: '500', 닭고기: '500', 계란: '500', 달걀: '500', 우유: '500',
  고등어: '600', 갈치: '600', 조기: '600', 명태: '600', 물오징어: '600', 오징어: '600', 건멸치: '600', 멸치: '600', 북어: '600', 김: '600', 건미역: '600', 미역: '600', 굴: '600', 새우젓: '600', 멸치액젓: '600', 굵은소금: '600', 전복: '600', 새우: '600',
};

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': init.cacheControl || 'max-age=1800',
    ...init.headers,
  },
});

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ request, env }) {
  try {
    const certKey = getEnv(env, ['KAMIS_API_KEY', 'KAMIS_CERT_KEY']);
    const certId = getEnv(env, ['KAMIS_CERT_ID', 'KAMIS_USER_ID', 'KAMIS_API_ID']);
    if (!certKey || !certId) {
      return json({
        ok: false,
        code: 'missing_key',
        message: 'KAMIS API 인증 정보가 설정되지 않았습니다. Cloudflare 환경변수 KAMIS_API_KEY와 KAMIS_CERT_ID를 확인해 주세요.',
      }, { status: 500, cacheControl: 'no-store' });
    }

    const url = new URL(request.url);
    const item = clean(url.searchParams.get('item'), 30);
    const region = normalizeRegion(url.searchParams.get('region') || '전국');
    const market = normalizeMarket(url.searchParams.get('market') || 'retail');
    const category = clean(url.searchParams.get('category'), 3) || guessCategory(item);
    const regday = normalizeDate(url.searchParams.get('regday'));

    if (!item) return json({ ok: false, code: 'missing_item', message: '품목명을 입력해 주세요.' }, { status: 400, cacheControl: 'no-store' });

    const categories = category ? [category] : Object.keys(CATEGORY_LABELS);
    const marketTypes = market === 'all' ? ['retail', 'wholesale'] : [market];
    const calls = [];
    for (const marketType of marketTypes) {
      for (const cat of categories) {
        calls.push(fetchKamisDaily({ certKey, certId, item, region, marketType, category: cat, regday }));
      }
    }

    const settled = await Promise.allSettled(calls);
    const results = [];
    const warnings = [];
    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        results.push(...entry.value.results);
        warnings.push(...entry.value.warnings);
      } else {
        warnings.push(entry.reason?.message || '일부 KAMIS 요청을 처리하지 못했습니다.');
      }
    }

    const deduped = dedupeResults(results).sort(compareResult);
    const summary = buildSummary({ item, region, market, results: deduped, warnings });

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      item,
      region,
      market,
      categories,
      count: deduped.length,
      summary,
      results: deduped.slice(0, 40),
      warnings: [...new Set(warnings)].slice(0, 6),
      source: 'KAMIS 농산물유통정보 가격정보 Open API',
    });
  } catch (error) {
    return json({ ok: false, message: error?.message || '장보기 물가 정보를 불러오지 못했습니다.' }, { status: 500, cacheControl: 'no-store' });
  }
}

async function fetchKamisDaily({ certKey, certId, item, region, marketType, category, regday }) {
  const marketInfo = MARKET_TYPES[marketType] || MARKET_TYPES.retail;
  const countryCode = REGION_CODES[region] ?? '';
  const warnings = [];
  const requestCountryCode = marketType === 'wholesale' && !WHOLESALE_REGION_CODES.has(countryCode) ? '' : countryCode;
  if (marketType === 'wholesale' && countryCode && !WHOLESALE_REGION_CODES.has(countryCode)) {
    warnings.push(`${region} 지역은 KAMIS 도매가격 지역 조회가 제한되어 전체지역 기준으로 확인했습니다.`);
  }

  const url = new URL(KAMIS_DAILY_ENDPOINT);
  url.searchParams.set('p_cert_key', certKey);
  url.searchParams.set('p_cert_id', certId);
  url.searchParams.set('p_returntype', 'json');
  url.searchParams.set('p_product_cls_code', marketInfo.code);
  url.searchParams.set('p_item_category_code', category);
  url.searchParams.set('p_convert_kg_yn', 'N');
  if (requestCountryCode) url.searchParams.set('p_country_code', requestCountryCode);
  if (regday) url.searchParams.set('p_regday', regday);

  const data = await fetchKamisJson(url.toString());
  const apiCondition = readCondition(data);
  if (apiCondition.code && apiCondition.code !== '000') {
    throw new Error(apiCondition.message || `KAMIS API 오류가 발생했습니다. (${apiCondition.code})`);
  }
  const rows = extractRows(data).map((row) => normalizeKamisRow(row, { marketType, marketLabel: marketInfo.label, region, category }));
  const matched = rows.filter((row) => isItemMatch(row, item));
  return { results: matched, warnings };
}

async function fetchKamisJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json,text/plain,*/*' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`KAMIS API 응답 오류가 발생했습니다. (${response.status})`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    if (text.includes('<OpenAPI_ServiceResponse>') || text.includes('Unauthenticated')) {
      throw new Error('KAMIS 인증 정보 또는 요청 파라미터를 확인해 주세요.');
    }
    throw new Error('KAMIS 응답을 해석하지 못했습니다.');
  }
}

function readCondition(data) {
  const condition = data?.condition || data?.response?.condition || null;
  const first = Array.isArray(condition) ? condition[0] : condition;
  const code = String(first?.code || first?.CODE || '').trim();
  const message = String(first?.message || first?.Message || first?.msg || '').trim();
  if (!code && typeof data?.error === 'string') return { code: 'error', message: data.error };
  return { code, message };
}

function extractRows(data) {
  const candidates = [
    data?.data,
    data?.price,
    data?.response?.body?.items?.item,
    data?.items?.item,
    data?.items,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
  }
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeKamisRow(row, meta) {
  const price = parsePrice(row.dpr1 || row.price || row.PRICE);
  const weekAgo = parsePrice(row.dpr3);
  const monthAgo = parsePrice(row.dpr5);
  const oneDayAgo = parsePrice(row.dpr2);
  const yearAgo = parsePrice(row.dpr6);
  const average = parsePrice(row.dpr7);
  const weekChange = buildChange(price, weekAgo);
  const monthChange = buildChange(price, monthAgo);
  return {
    id: [meta.marketType, meta.category, row.itemcode, row.kindcode, row.rank, row.unit, row.day1].map((v) => String(v || '')).join('-'),
    marketType: meta.marketType,
    marketLabel: meta.marketLabel,
    region: meta.region,
    categoryCode: meta.category,
    categoryLabel: CATEGORY_LABELS[meta.category] || '기타',
    itemName: clean(row.item_name || row.itemName || row.ITEM_NAME, 40),
    itemCode: clean(row.itemcode || row.item_code, 20),
    kindName: clean(row.kind_name || row.kindName || row.KIND_NAME, 40),
    kindCode: clean(row.kindcode || row.kind_code, 20),
    rank: clean(row.rank || row.product_rank_name || row.RANK, 20),
    unit: clean(row.unit || row.UNIT, 30),
    day: clean(row.day1 || row.regday || row.REGDAY, 20),
    price,
    priceText: formatPrice(price, row.dpr1 || row.price || ''),
    oneDayAgo,
    weekAgo,
    monthAgo,
    yearAgo,
    average,
    weekChange,
    monthChange,
    raw: row,
  };
}

function compareResult(a, b) {
  const rankWeight = (value) => value.includes('상품') ? 0 : value.includes('중품') ? 1 : 2;
  const marketWeight = (value) => value === 'retail' ? 0 : 1;
  return marketWeight(a.marketType) - marketWeight(b.marketType)
    || rankWeight(a.rank) - rankWeight(b.rank)
    || normalizeText(a.itemName).localeCompare(normalizeText(b.itemName), 'ko')
    || normalizeText(a.kindName).localeCompare(normalizeText(b.kindName), 'ko');
}

function dedupeResults(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.marketType, row.categoryCode, row.itemCode, row.kindCode, row.rank, row.unit, row.day].join('|');
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function buildSummary({ item, region, market, results, warnings }) {
  if (!results.length) {
    return {
      tone: 'empty',
      title: '조회 가능한 가격정보를 찾지 못했습니다',
      message: '품목명을 조금 더 짧게 입력하거나 인기 품목을 선택해 다시 확인해 주세요.',
      item,
      region,
      market,
    };
  }
  const first = results[0];
  const change = first.weekChange?.direction === 'up' ? '전주 대비 상승' : first.weekChange?.direction === 'down' ? '전주 대비 하락' : first.weekChange?.direction === 'same' ? '전주와 비슷' : '전주 비교 정보 없음';
  return {
    tone: first.weekChange?.direction || 'normal',
    title: `${first.itemName || item} ${first.marketLabel} 기준`,
    message: `${region} ${first.marketLabel} 조사 가격 기준으로 ${change} 흐름을 참고할 수 있습니다.`,
    primaryPrice: first.priceText,
    unit: first.unit,
    day: first.day,
    representative: first,
    warning: warnings[0] || '',
  };
}

function isItemMatch(row, query) {
  const q = normalizeText(query);
  if (!q) return true;
  const item = normalizeText(row.itemName);
  const kind = normalizeText(row.kindName);
  const alias = normalizeText(normalizeItemAlias(query));
  return item.includes(q) || q.includes(item) || kind.includes(q) || item.includes(alias) || kind.includes(alias);
}

function normalizeItemAlias(value) {
  const text = String(value || '').trim();
  const aliases = { 달걀: '계란', 파: '대파', 소고기: '쇠고기', 오징어: '물오징어', 멸치: '건멸치', 미역: '건미역' };
  return aliases[text] || text;
}

function guessCategory(item) {
  const normalized = normalizeItemAlias(item);
  const key = Object.keys(ITEM_CATEGORY_HINTS).find((name) => normalizeText(normalized).includes(normalizeText(name)) || normalizeText(name).includes(normalizeText(normalized)));
  return key ? ITEM_CATEGORY_HINTS[key] : '';
}

function normalizeMarket(value) {
  const text = String(value || '').toLowerCase();
  if (text === 'wholesale') return 'wholesale';
  if (text === 'all') return 'all';
  return 'retail';
}

function normalizeRegion(value) {
  const text = String(value || '전국').trim();
  return Object.prototype.hasOwnProperty.call(REGION_CODES, text) ? text : '전국';
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function parsePrice(value) {
  const text = String(value ?? '').replace(/,/g, '').replace(/원/g, '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(number, fallback) {
  if (Number.isFinite(number)) return `${number.toLocaleString('ko-KR')}원`;
  const text = String(fallback || '').trim();
  return text && text !== '-' ? text : '가격 정보 없음';
}

function buildChange(current, past) {
  if (!Number.isFinite(current) || !Number.isFinite(past) || past === 0) return { direction: 'unknown', amount: null, rate: null, label: '비교 정보 없음' };
  const amount = current - past;
  const rate = amount / past * 100;
  const direction = amount > 0 ? 'up' : amount < 0 ? 'down' : 'same';
  const sign = amount > 0 ? '+' : '';
  return {
    direction,
    amount,
    rate,
    label: direction === 'same' ? '변동 없음' : `${sign}${Math.round(amount).toLocaleString('ko-KR')}원 (${sign}${rate.toFixed(1)}%)`,
  };
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function clean(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

function getEnv(env, keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
