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
  배추: '200', 양배추: '200', 시금치: '200', 상추: '200', 얼갈이배추: '200', 수박: '200', 참외: '200', 오이: '200', 호박: '200', 토마토: '200', 딸기: '200', 무: '200', 무우: '200', 당근: '200', 열무: '200', 건고추: '200', 풋고추: '200', 붉은고추: '200', 마늘: '200', 양파: '200', 파: '200', 대파: '200', 생강: '200', 미나리: '200', 깻잎: '200', 피망: '200', 파프리카: '200', 멜론: '200', 방울토마토: '200',
  참깨: '300', 들깨: '300', 땅콩: '300', 느타리버섯: '300', 팽이버섯: '300', 새송이버섯: '300', 호두: '300', 아몬드: '300',
  사과: '400', 배: '400', 복숭아: '400', 포도: '400', 감귤: '400', 단감: '400', 바나나: '400', 참다래: '400', 파인애플: '400', 오렌지: '400', 레몬: '400', 망고: '400', 체리: '400', 아보카도: '400',
  쇠고기: '500', 소고기: '500', 돼지고기: '500', 닭고기: '500', 계란: '500', 달걀: '500', 우유: '500',
  고등어: '600', 갈치: '600', 조기: '600', 명태: '600', 물오징어: '600', 오징어: '600', 건멸치: '600', 멸치: '600', 북어: '600', 김: '600', 건미역: '600', 미역: '600', 굴: '600', 새우젓: '600', 멸치액젓: '600', 굵은소금: '600', 전복: '600', 새우: '600',
};

const ITEM_ALIASES = {
  계란: ['계란', '달걀'],
  달걀: ['달걀', '계란'],
  파: ['파', '대파'],
  대파: ['대파', '파'],
  소고기: ['소고기', '쇠고기'],
  쇠고기: ['쇠고기', '소고기'],
  오징어: ['오징어', '물오징어'],
  물오징어: ['물오징어', '오징어'],
  멸치: ['멸치', '건멸치'],
  건멸치: ['건멸치', '멸치'],
  미역: ['미역', '건미역'],
  건미역: ['건미역', '미역'],
  무: ['무', '무우'],
  무우: ['무우', '무'],
  배: ['배'],
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

  const rawRows = extractRows(data);
  const normalizedRows = rawRows
    .map((row) => normalizeKamisRow(row, { marketType, marketLabel: marketInfo.label, region, category }))
    .filter(hasItemIdentity);
  const matchedRows = normalizedRows.filter((row) => isItemMatch(row, item));
  const usableRows = matchedRows.filter(hasUsablePriceRow);

  logKamisDiagnostics({
    item,
    region,
    marketType,
    category,
    condition: apiCondition,
    rawData: data,
    rawRows,
    normalizedRows,
    matchedRows,
    usableRows,
  });

  if (matchedRows.length && !usableRows.length) {
    warnings.push('KAMIS에서 품목명은 확인됐지만 최근 가격 필드가 비어 있어 결과에서 제외했습니다.');
  }
  return { results: usableRows, warnings };
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
  const condition = data?.condition || data?.response?.condition || data?.data?.condition || null;
  const first = Array.isArray(condition) ? condition[0] : condition;
  const code = String(first?.code || first?.CODE || data?.error_code || data?.data?.error_code || '').trim();
  const message = String(first?.message || first?.Message || first?.msg || data?.error_msg || data?.data?.error_msg || '').trim();
  if (!code && typeof data?.error === 'string') return { code: 'error', message: data.error };
  return { code, message };
}

function extractRows(data) {
  const candidates = [
    data?.price,
    data?.prices,
    data?.data,
    data?.list,
    data?.result,
    data?.response?.body?.items?.item,
    data?.response?.body?.items,
    data?.items?.item,
    data?.items,
  ];

  const rows = [];
  for (const value of candidates) {
    rows.push(...collectPriceLikeRows(value));
  }

  if (!rows.length) rows.push(...collectPriceLikeRows(data));
  return rows;
}

function collectPriceLikeRows(value, depth = 0) {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectPriceLikeRows(entry, depth + 1));
  }
  if (typeof value !== 'object') return [];

  const nestedKeys = ['price', 'prices', 'data', 'list', 'result', 'rows', 'row', 'items', 'item', 'body'];
  const nestedRows = [];
  for (const key of nestedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      nestedRows.push(...collectPriceLikeRows(value[key], depth + 1));
    }
  }
  if (nestedRows.length) return nestedRows;

  return isPriceLikeRow(value) ? [value] : [];
}

function isPriceLikeRow(row) {
  if (!row || typeof row !== 'object') return false;
  const item = firstValue(row, ITEM_NAME_KEYS);
  const kind = firstValue(row, KIND_NAME_KEYS);
  const unit = firstValue(row, UNIT_KEYS);
  const price = firstValue(row, PRICE_KEYS);
  const day = firstValue(row, DAY_KEYS);
  return Boolean(item || kind || unit || price || day);
}

function normalizeKamisRow(row, meta) {
  const priceRaw = firstValue(row, PRICE_KEYS);
  const price = parsePrice(priceRaw);
  const weekAgo = parsePrice(firstValue(row, WEEK_PRICE_KEYS));
  const monthAgo = parsePrice(firstValue(row, MONTH_PRICE_KEYS));
  const oneDayAgo = parsePrice(firstValue(row, ONE_DAY_PRICE_KEYS));
  const yearAgo = parsePrice(firstValue(row, YEAR_PRICE_KEYS));
  const average = parsePrice(firstValue(row, AVERAGE_PRICE_KEYS));
  const weekChange = buildChange(price, weekAgo);
  const monthChange = buildChange(price, monthAgo);
  const itemName = clean(firstValue(row, ITEM_NAME_KEYS), 40);
  const kindName = clean(firstValue(row, KIND_NAME_KEYS), 40);
  const itemCode = clean(firstValue(row, ITEM_CODE_KEYS), 20);
  const kindCode = clean(firstValue(row, KIND_CODE_KEYS), 20);
  const rank = clean(firstValue(row, RANK_KEYS), 20);
  const unit = clean(firstValue(row, UNIT_KEYS), 30);
  const day = clean(firstValue(row, DAY_KEYS), 20);
  return {
    id: [meta.marketType, meta.category, itemCode, kindCode, rank, unit, day].map((v) => String(v || '')).join('-'),
    marketType: meta.marketType,
    marketLabel: meta.marketLabel,
    region: meta.region,
    categoryCode: meta.category,
    categoryLabel: CATEGORY_LABELS[meta.category] || '기타',
    itemName,
    itemCode,
    kindName,
    kindCode,
    rank,
    unit,
    day,
    price,
    priceText: formatPrice(price, priceRaw),
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

function hasItemIdentity(row) {
  return Boolean(row?.itemName || row?.kindName);
}

function hasUsablePriceRow(row) {
  return Boolean(hasItemIdentity(row) && Number.isFinite(row.price));
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
  const target = `${item} ${kind}`.trim();
  if (!target) return false;

  const aliases = getItemAliases(query).map(normalizeText).filter(Boolean);
  return aliases.some((alias) => {
    if (item.includes(alias) || kind.includes(alias)) return true;
    if (item.length >= 2 && alias.includes(item)) return true;
    if (kind.length >= 2 && alias.includes(kind)) return true;
    return false;
  });
}

function getItemAliases(value) {
  const text = String(value || '').trim();
  const aliases = ITEM_ALIASES[text] || [text];
  return [...new Set([text, ...aliases])].filter(Boolean);
}

function normalizeItemAlias(value) {
  return getItemAliases(value)[0] || String(value || '').trim();
}

function guessCategory(item) {
  const aliases = getItemAliases(item).map(normalizeText);
  const key = Object.keys(ITEM_CATEGORY_HINTS).find((name) => {
    const normalizedName = normalizeText(name);
    return aliases.some((alias) => alias.includes(normalizedName) || normalizedName.includes(alias));
  });
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


const ITEM_NAME_KEYS = ['item_name', 'itemName', 'itemname', 'ITEM_NAME', 'productName', 'product_name', 'product_name_kor', 'productname', '품목명', '품목', 'item'];
const KIND_NAME_KEYS = ['kind_name', 'kindName', 'kindname', 'KIND_NAME', 'kind', 'variety_name', 'varietyName', 'kindnm', '품종명', '품종', '규격'];
const ITEM_CODE_KEYS = ['itemcode', 'item_code', 'itemCode', 'ITEM_CODE', 'productno', 'product_no', 'productNo', '품목코드'];
const KIND_CODE_KEYS = ['kindcode', 'kind_code', 'kindCode', 'KIND_CODE', 'kindno', 'kind_no', '품종코드'];
const RANK_KEYS = ['rank', 'product_rank_name', 'productRankName', 'rank_name', 'RANK', '등급'];
const UNIT_KEYS = ['unit', 'UNIT', 'unit_name', 'unitName', 'units', '단위', '거래단위'];
const DAY_KEYS = ['day1', 'DAY1', 'regday', 'REGDAY', 'latest_day', 'latestDay', 'lastest_day', 'date', 'base_date', 'baseDate', '조사일', '기준일'];
const PRICE_KEYS = ['dpr1', 'DPR1', 'dpr_1', 'price', 'PRICE', 'price_value', 'priceValue', 'latest_price', 'latestPrice', 'recent_price', 'recentPrice', 'amount', 'amt', 'value', '조사가격', '가격', '최근가격'];
const ONE_DAY_PRICE_KEYS = ['dpr2', 'DPR2', 'dpr_2', 'oneDayAgo', 'one_day_ago', 'previous_price', 'previousPrice', '전일가격'];
const WEEK_PRICE_KEYS = ['dpr3', 'DPR3', 'dpr_3', 'weekAgo', 'week_ago', 'oneWeekAgo', 'one_week_ago', '전주가격'];
const MONTH_PRICE_KEYS = ['dpr5', 'DPR5', 'dpr_5', 'monthAgo', 'month_ago', 'oneMonthAgo', 'one_month_ago', '전월가격'];
const YEAR_PRICE_KEYS = ['dpr6', 'DPR6', 'dpr_6', 'yearAgo', 'year_ago', 'oneYearAgo', 'one_year_ago', '전년가격'];
const AVERAGE_PRICE_KEYS = ['dpr7', 'DPR7', 'dpr_7', 'average', 'avg_price', 'avgPrice', '평균가격', '평년가격'];

function firstValue(row, keys) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    const value = row[key];
    if (isPresentValue(value)) return value;
  }

  const normalizedMap = getNormalizedKeyMap(row);
  for (const key of keys) {
    const actualKey = normalizedMap.get(normalizeKey(key));
    if (!actualKey) continue;
    const value = row[actualKey];
    if (isPresentValue(value)) return value;
  }
  return '';
}

function getNormalizedKeyMap(row) {
  const map = new Map();
  for (const key of Object.keys(row || {})) {
    map.set(normalizeKey(key), key);
  }
  return map;
}

function normalizeKey(value) {
  return String(value || '').replace(/[\s_\-\.]/g, '').toLowerCase();
}

function isPresentValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function parsePrice(value) {
  const text = String(value ?? '').replace(/원/g, '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null' || text === '가격 정보 없음') return null;
  const matched = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!matched) return null;
  const number = Number(matched[0].replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function formatPrice(number, fallback) {
  if (Number.isFinite(number)) return `${number.toLocaleString('ko-KR')}원`;
  const text = String(fallback || '').trim();
  return text && text !== '-' ? text : '가격 정보 없음';
}

function logKamisDiagnostics({ item, region, marketType, category, condition, rawData, rawRows, normalizedRows, matchedRows, usableRows }) {
  try {
    const firstRawRow = rawRows?.[0] || null;
    const firstMatchedRow = matchedRows?.[0] || null;
    console.log('[KAMIS grocery diagnostics]', {
      item,
      region,
      marketType,
      category,
      conditionCode: condition?.code || '',
      topLevelKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData).slice(0, 20) : [],
      firstRawRowKeys: firstRawRow && typeof firstRawRow === 'object' ? Object.keys(firstRawRow).slice(0, 40) : [],
      extractedRowCount: rawRows?.length || 0,
      normalizedRowCount: normalizedRows?.length || 0,
      matchedRowCount: matchedRows?.length || 0,
      usableRowCount: usableRows?.length || 0,
      firstMatchedNormalized: firstMatchedRow ? {
        itemName: firstMatchedRow.itemName,
        kindName: firstMatchedRow.kindName,
        rank: firstMatchedRow.rank,
        unit: firstMatchedRow.unit,
        day: firstMatchedRow.day,
        price: firstMatchedRow.price,
        priceText: firstMatchedRow.priceText,
      } : null,
    });
  } catch (error) {
    console.log('[KAMIS grocery diagnostics failed]', error?.message || error);
  }
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
