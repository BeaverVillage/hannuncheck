const json = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...init.headers
  }
});

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request, env }) {
  try {
    const input = await request.json().catch(() => ({}));
    const mode = String(input.mode || 'barcode').trim();
    if (mode !== 'barcode') return json({ message: '지원하지 않는 식품 확인 방식입니다.' }, { status: 400 });
    const barcode = String(input.barcode || '').replace(/\D/g, '');
    if (!/^\d{8,14}$/.test(barcode)) return json({ message: '바코드는 숫자 8~14자리로 입력해 주세요.' }, { status: 400 });

    const key = getEnv(env, ['FOODSAFETYKOREA_KEY', 'FOOD_SAFETY_KEY', 'MFDS_SERVICE_KEY']);
    if (!key) {
      return json({
        message: '식품안전나라 API 키가 설정되지 않았습니다.',
        items: [],
        limitation: '바코드 보조 조회를 사용하려면 FOODSAFETYKOREA_KEY 환경변수가 필요합니다.'
      }, { status: 503 });
    }

    const endpoint = `https://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(key)}/C005/json/1/5/BAR_CD=${encodeURIComponent(barcode)}`;
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(`식품정보 API 응답 오류가 발생했습니다. (${response.status})`);

    const block = data?.C005 || {};
    const rows = Array.isArray(block.row) ? block.row : [];
    const items = rows.map((row) => ({
      productName: row.PRDLST_NM || row.PRDLST_REPORT_NO || '',
      foodType: row.PRDLST_DCNM || row.FOOD_TYPE || '',
      manufacturer: row.BSSH_NM || row.MANUFACTURER || '',
      reportNo: row.PRDLST_REPORT_NO || '',
      expiry: row.POG_DAYCNT || '',
      address: row.SITE_ADDR || row.ADDR || '',
      barcode: row.BAR_CD || barcode
    }));

    return json({
      ok: true,
      barcode,
      items,
      result: block.RESULT || null,
      limitation: '일부 바코드 연계 데이터는 2018년 이후 최신화 제한 안내가 있어 최신 제품 정보가 누락될 수 있습니다. 실제 영양성분과 소비기한은 제품 포장지를 우선 확인하세요.'
    });
  } catch (error) {
    return json({ message: error?.message || '식품 보조 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

function getEnv(env, keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
