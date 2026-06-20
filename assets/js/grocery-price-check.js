(() => {
  const root = document.querySelector('#grocery-price-tool');
  if (!root) return;

  const els = {
    form: root.querySelector('#grocery-price-form'),
    region: root.querySelector('#grocery-region'),
    item: root.querySelector('#grocery-item'),
    market: root.querySelector('#grocery-market'),
    period: root.querySelector('#grocery-period'),
    status: root.querySelector('#grocery-status'),
    result: root.querySelector('#grocery-result'),
    chips: root.querySelectorAll('[data-grocery-item]')
  };

  const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function setStatus(message) {
    if (els.status) els.status.textContent = message;
  }

  function selectedItem() {
    return (els.item?.value || '').trim();
  }

  function setLoading(item) {
    if (!els.result) return;
    els.result.innerHTML = `
      <article class="grocery-placeholder-card is-loading">
        <h2>${escape(item)} 가격정보를 확인하고 있습니다</h2>
        <p>KAMIS 가격정보를 기준으로 최근 조사 가격과 비교 정보를 불러오는 중입니다.</p>
      </article>`;
  }

  function renderError(message) {
    if (!els.result) return;
    els.result.innerHTML = `
      <article class="grocery-placeholder-card grocery-error-card">
        <h2>가격정보를 불러오지 못했습니다</h2>
        <p>${escape(message || '잠시 후 다시 시도하거나 품목명을 바꿔 확인해 주세요.')}</p>
      </article>`;
  }

  function changeTone(direction) {
    if (direction === 'up') return '상승';
    if (direction === 'down') return '하락';
    if (direction === 'same') return '비슷';
    return '확인 필요';
  }

  function trendLabel(direction) {
    if (direction === 'up') return '오름';
    if (direction === 'down') return '내림';
    if (direction === 'same') return '비슷';
    return '비교 정보 없음';
  }

  function formatNumberPrice(value) {
    return Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '자료 없음';
  }

  function buildTrendItems(row) {
    if (!row) return [];
    return [
      ['최근', row.price, row.day || '최근 조사일'],
      ['전일', row.oneDayAgo, '전일 기준'],
      ['전주', row.weekAgo, row.weekChange?.label || '전주 기준'],
      ['전월', row.monthAgo, row.monthChange?.label || '전월 기준'],
      ['전년', row.yearAgo, '전년 기준'],
      ['평균', row.average, '평년·평균 기준']
    ];
  }

  function trendDirectionClass(row) {
    return `tone-${row?.weekChange?.direction || 'unknown'}`;
  }

  function renderResults(data) {
    if (!els.result) return;
    if (!data?.ok) {
      renderError(data?.message);
      return;
    }
    if (!data.results?.length) {
      const warningItems = (data.warnings || []).filter(Boolean).map((item) => `<li>${escape(item)}</li>`).join('');
      els.result.innerHTML = `
        <article class="grocery-placeholder-card grocery-empty-card grocery-empty-card-compact">
          <div class="grocery-result-head compact">
            <div>
              <p class="eyebrow">KAMIS 조회 결과</p>
              <h2>${escape(data.item || '선택 품목')} 가격정보를 찾지 못했습니다</h2>
              <p>KAMIS에서 현재 조건의 실제 가격값을 확인하지 못했습니다. 전국 기준 또는 다른 시장 유형으로 다시 확인해 주세요.</p>
            </div>
            <span class="grocery-change-pill tone-unknown">자료 없음</span>
          </div>
          ${warningItems ? `<ul class="grocery-warning-list compact">${warningItems}</ul>` : ''}
          <div class="grocery-action-pills">
            <button type="button" data-grocery-action="national">전국 기준 보기</button>
            <button type="button" data-grocery-action="choose-item">품목 다시 선택</button>
          </div>
        </article>`;
      setStatus(`${data.item || '선택 품목'} 가격값을 찾지 못했습니다. 전국 기준이나 다른 품목명으로 다시 확인해 주세요.`);
      return;
    }

    const summary = data.summary || {};
    const first = summary.representative || data.results[0];
    const trendItems = buildTrendItems(first).map(([label, value, note]) => `
      <li>
        <span>${escape(label)}</span>
        <strong>${escape(formatNumberPrice(value))}</strong>
        <small>${escape(note || '')}</small>
      </li>
    `).join('');

    const rows = data.results.slice(0, 10).map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escape(row.itemName || data.item)}</strong><span>${escape(row.kindName || '기본 품종')} · ${escape(row.rank || '등급 정보 없음')}</span></td>
        <td>${escape(row.marketLabel)}</td>
        <td>${escape(row.unit || '-')}</td>
        <td><strong>${escape(row.priceText)}</strong><span>${escape(row.day || '')}</span></td>
        <td>${escape(row.weekChange?.label || '비교 정보 없음')}</td>
      </tr>
    `).join('');

    const insightCards = [
      ['최근 가격', summary.primaryPrice || first.priceText || '가격 정보 없음', `${first.unit || '단위 정보 없음'} · ${first.day || '조사일 정보 없음'}`],
      ['전주 대비', first.weekChange?.label || '비교 정보 없음', trendLabel(first.weekChange?.direction)],
      ['전월 대비', first.monthChange?.label || '비교 정보 없음', trendLabel(first.monthChange?.direction)],
      ['조회 기준', `${data.region || '전국'} · ${first.marketLabel || '소매가격'}`, first.categoryLabel || '품목 분류']
    ].map(([label, value, note]) => `
      <article>
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(note || '')}</small>
      </article>
    `).join('');

    const warnings = (data.warnings || []).filter(Boolean).map((item) => `<li>${escape(item)}</li>`).join('');

    els.result.innerHTML = `
      <article class="grocery-result-card grocery-result-card-compact">
        <div class="grocery-result-head compact">
          <div>
            <p class="eyebrow">KAMIS PRICE DATA</p>
            <h2>${escape(summary.title || `${data.item} 가격정보`)}</h2>
            <p>${escape(summary.message || '최근 조사 가격 기준으로 참고할 수 있는 가격정보입니다.')}</p>
          </div>
          <span class="grocery-change-pill ${escape(trendDirectionClass(first))}">${escape(changeTone(first.weekChange?.direction))}</span>
        </div>
        <div class="grocery-price-summary-row">
          <p class="price-value">${escape(summary.primaryPrice || first.priceText || '가격 정보 없음')}</p>
          <span>${escape(first.unit || '단위 정보 없음')} · ${escape(first.day || '조사일 정보 없음')}</span>
        </div>
        <div class="grocery-insight-grid compact">${insightCards}</div>
        <div class="grocery-action-pills" aria-label="장보기 가격 확인 보조 기능">
          <button type="button" data-grocery-action="national">전국 기준 보기</button>
          <button type="button" data-grocery-action="choose-item">품목 다시 선택</button>
        </div>
        <details class="grocery-detail-drawer">
          <summary>최근 추이·상세 가격표 보기</summary>
          <section class="grocery-trend-card compact">
            <div>
              <h3>최근 가격 흐름</h3>
              <p>제공 데이터에 포함된 최근·전주·전월 기준값입니다.</p>
            </div>
            <ol class="grocery-trend-list">${trendItems}</ol>
          </section>
          <div class="grocery-table-wrap">
            <table class="grocery-price-table">
              <thead><tr><th>#</th><th>품목</th><th>유형</th><th>단위</th><th>최근 가격</th><th>전주 대비</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>
        ${warnings ? `<ul class="grocery-warning-list">${warnings}</ul>` : ''}
        <p class="grocery-dev-note">KAMIS 공개 가격정보 기준이며 실제 매장 가격·행사 가격·판매 단위와 다를 수 있습니다.</p>
      </article>`;
    setStatus(`${data.item} ${data.region} 기준 가격정보 ${data.count}건을 확인했습니다.`);
  }

  async function fetchPrice() {
    const item = selectedItem();
    if (!item) {
      setStatus('품목을 입력하거나 인기 품목을 선택해 주세요.');
      els.item?.focus();
      return;
    }
    const params = new URLSearchParams({
      region: els.region?.value || '전국',
      item,
      market: els.market?.value || 'retail',
      period: els.period?.value || 'latest',
      _v: 'v62',
      _ts: Date.now().toString()
    });
    setStatus(`${item} 가격정보를 불러오고 있습니다.`);
    setLoading(item);
    try {
      const response = await fetch(`/api/kamis-prices?${params.toString()}`, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-cache' } });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.message || `가격정보 조회에 실패했습니다. (${response.status})`);
      renderResults(data);
    } catch (error) {
      const message = error?.message || '장보기 물가 정보를 불러오지 못했습니다.';
      renderError(message);
      setStatus(message);
    }
  }


  els.result?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-grocery-action]');
    if (!button) return;
    const action = button.dataset.groceryAction;
    if (action === 'choose-item') {
      els.item?.focus();
      els.item?.select?.();
      setStatus('품목명을 입력하거나 인기 품목을 다시 선택해 주세요.');
      return;
    }
    if (action === 'national') {
      if (els.region) els.region.value = '전국';
      setStatus('전국 기준으로 다시 확인합니다.');
      fetchPrice();
      return;
    }
    if (action === 'trend') {
      const drawer = els.result?.querySelector('.grocery-detail-drawer');
      if (drawer) {
        drawer.open = true;
        drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setStatus('최근 추이와 상세 가격표를 펼쳤습니다.');
      }
    }
  });

  els.chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const item = chip.dataset.groceryItem || '';
      if (els.item) els.item.value = item;
      els.chips.forEach((el) => el.classList.toggle('is-selected', el === chip));
      setStatus(`${item} 품목이 선택되었습니다. 가격 확인하기를 눌러 최근 가격정보를 확인하세요.`);
    });
  });

  els.item?.addEventListener('input', () => {
    const value = selectedItem();
    els.chips.forEach((chip) => chip.classList.toggle('is-selected', chip.dataset.groceryItem === value));
  });

  els.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchPrice();
  });

  setStatus('품목을 입력하거나 인기 품목을 선택하면 KAMIS 가격정보를 확인합니다.');
})();
