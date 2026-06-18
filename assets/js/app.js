(() => {
  const TOOL_DRAWER_GROUPS = [
    {
      label: '거래·사업자 체크',
      tools: [
        ['사업자등록 상태 조회', '/tools/business-status.html', '계속·휴업·폐업 여부와 과세유형 확인'],
        ['사업자 진위확인', '/tools/business-validate.html', '대표자명과 개업일자 일치 여부 확인'],
        ['통신판매업 신고 조회', '/tools/mail-order.html', '온라인 판매자 공개 신고정보 확인'],
        ['쇼핑몰 정보 비교', '/tools/store-compare.html', '사이트 하단 정보와 공식 정보 비교'],
        ['거래 전 체크리스트', '/tools/pre-payment-checklist.html', '입금 전 확인할 항목을 한 번에 정리']
      ]
    },
    {
      label: '기기·환경 체크',
      tools: [
        ['컴퓨터 사양 확인', '/tools/pc-spec.html', '운영체제·CPU 코어·메모리·GPU·화면 정보 확인'],
        ['CPU 간단 테스트', '/tools/pc-spec.html#pc-spec-tool', '브라우저 안에서 짧은 반복 연산으로 참고 성능 확인']
      ]
    },
    {
      label: '거래 전 점검 가이드',
      tools: [
        ['무통장입금 전 확인사항', '/guides/before-bank-transfer.html', '입금 전에 추가로 봐야 할 기준 설명'],
        ['공식 정보가 정상이어도 주의할 점', '/guides/official-info-limit.html', '등록정보와 거래 안전성의 차이 설명'],
        ['쇼핑몰 하단 정보 확인법', '/guides/store-footer-info.html', '상호명·대표자명·신고번호 비교 방법']
      ]
    },
    {
      label: '해석 가이드',
      tools: [
        ['사업자등록 상태 조회 가이드', '/guides/business-registration-status.html', '상태 결과를 어떻게 읽어야 하는지 안내'],
        ['계속·휴업·폐업자 차이', '/guides/active-closed-business.html', '상태별 의미와 추가 확인 포인트'],
        ['통신판매업 신고정보 가이드', '/guides/mail-order-business.html', '신고정보 확인 시 주의할 점']
      ]
    }
  ];

  initToolDrawer();
  initPcSpecTool();


  function initToolDrawer() {
    if (document.querySelector('.tool-drawer')) return;

    const drawerEscape = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const drawer = document.createElement('aside');
    drawer.className = 'tool-drawer';
    drawer.setAttribute('aria-label', '한눈체크 주요 기능');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="tool-drawer-head">
        <div>
          <strong>주요 기능</strong>
          <small>필요한 확인 도구를 바로 선택하세요.</small>
        </div>
        <button type="button" class="tool-drawer-close" aria-label="주요 기능 닫기">×</button>
      </div>
      <div class="tool-search-row">
        <span aria-hidden="true">⌕</span>
        <input type="search" id="tool-search" placeholder="기능 검색..." autocomplete="off">
      </div>
      <nav class="tool-drawer-list" aria-label="한눈체크 기능 목록">
        ${TOOL_DRAWER_GROUPS.map((group) => `
          <section class="tool-group">
            <h2>${drawerEscape(group.label)}</h2>
            ${group.tools.map(([name, href, desc]) => `
              <a href="${href}" data-tool-name="${drawerEscape((name + ' ' + desc).toLowerCase())}">
                <strong>${drawerEscape(name)}</strong>
                <small>${drawerEscape(desc)}</small>
              </a>
            `).join('')}
          </section>
        `).join('')}
      </nav>
    `;

    const backdrop = document.createElement('button');
    backdrop.className = 'drawer-backdrop';
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', '주요 기능 닫기');

    document.body.append(drawer, backdrop);

    const openDrawer = () => {
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
      if (!window.matchMedia('(max-width: 720px)').matches) {
        drawer.querySelector('#tool-search')?.focus();
      }
    };

    const closeDrawer = () => {
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
    };

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest('[data-tool-drawer], .site-nav a[href$="#features"]');
      if (!trigger) return;
      event.preventDefault();
      openDrawer();
    });

    drawer.querySelector('.tool-drawer-close')?.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });

    drawer.querySelector('#tool-search')?.addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      drawer.querySelectorAll('[data-tool-name]').forEach((link) => {
        const visible = !query || link.dataset.toolName.includes(query);
        link.hidden = !visible;
      });
    });
  }



  function initPcSpecTool() {
    const root = document.querySelector('#pc-spec-tool');
    if (!root) return;

    const escape = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const autoGrid = document.querySelector('#auto-spec-grid');
    const meaningList = document.querySelector('#auto-meaning-list');
    const refreshButton = document.querySelector('#pc-refresh-button');
    const cpuTestButton = document.querySelector('#cpu-test-button');
    const benchmarkBox = document.querySelector('#benchmark-box');
    const benchmarkBar = document.querySelector('#benchmark-bar');
    const benchmarkResult = document.querySelector('#benchmark-result');
    const cpuTestStatus = document.querySelector('#cpu-test-status');
    const manualForm = document.querySelector('#manual-spec-form');
    const manualResultBox = document.querySelector('#manual-result-box');
    const modal = document.querySelector('#spec-help-modal');
    const modalTitle = document.querySelector('#spec-help-title');
    const modalBody = document.querySelector('#spec-help-body');
    const modalClose = document.querySelector('#spec-help-close');

    const helpContents = {
      cpu: {
        title: 'CPU 모델명은 어디서 보나요?',
        body: `
          <ul class="info-bullet-list">
            <li><strong>Windows:</strong> 설정 → 시스템 → 정보에서 프로세서 항목을 확인합니다. 작업 관리자 → 성능 → CPU에서도 볼 수 있습니다.</li>
            <li><strong>macOS:</strong>  메뉴 → 이 Mac에 관하여에서 칩 또는 프로세서 항목을 확인합니다.</li>
            <li><strong>상품 페이지:</strong> 사양표에서 CPU, Processor, 프로세서라고 적힌 항목을 복사합니다.</li>
          </ul>`
      },
      ram: {
        title: 'RAM 용량은 어디서 보나요?',
        body: `
          <ul class="info-bullet-list">
            <li><strong>Windows:</strong> 설정 → 시스템 → 정보의 설치된 RAM 항목을 확인합니다.</li>
            <li><strong>macOS:</strong>  메뉴 → 이 Mac에 관하여에서 메모리 또는 통합 메모리 항목을 확인합니다.</li>
            <li><strong>상품 페이지:</strong> 메모리, RAM, Memory 항목에 표시된 GB 값을 입력합니다.</li>
          </ul>`
      },
      gpu: {
        title: 'GPU 그래픽카드는 어디서 보나요?',
        body: `
          <ul class="info-bullet-list">
            <li><strong>Windows:</strong> 작업 관리자 → 성능 → GPU에서 이름을 확인합니다. 장치 관리자 → 디스플레이 어댑터에서도 볼 수 있습니다.</li>
            <li><strong>macOS:</strong>  메뉴 → 이 Mac에 관하여에서 그래픽 또는 칩 항목을 확인합니다.</li>
            <li><strong>상품 페이지:</strong> 그래픽, GPU, VGA 항목에 표시된 모델명을 입력합니다.</li>
          </ul>`
      },
      storage: {
        title: '저장장치는 어디서 보나요?',
        body: `
          <ul class="info-bullet-list">
            <li><strong>Windows:</strong> 작업 관리자 → 성능 → 디스크에서 SSD/HDD 여부와 용량을 확인합니다.</li>
            <li><strong>macOS:</strong> 시스템 설정 → 일반 → 저장 공간에서 용량을 확인합니다.</li>
            <li><strong>상품 페이지:</strong> 저장장치, SSD, HDD, Storage 항목의 종류와 용량을 입력합니다.</li>
          </ul>`
      }
    };

    const getOsName = () => {
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      if (/Windows/i.test(ua + platform)) return 'Windows 계열';
      if (/Macintosh|Mac OS/i.test(ua + platform)) return 'macOS 계열';
      if (/Android/i.test(ua)) return 'Android 계열';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS 계열';
      if (/Linux/i.test(ua + platform)) return 'Linux 계열';
      return '확인 제한';
    };

    const getGpuInfo = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { value: 'WebGL 확인 불가', detail: '그래픽 정보 접근이 제한되었거나 WebGL을 사용할 수 없습니다.' };
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return { value: 'WebGL 지원', detail: 'GPU 모델명은 보안 설정상 표시되지 않습니다.' };
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return { value: renderer || 'WebGL 지원', detail: renderer ? 'WebGL 렌더러 기준의 그래픽 정보입니다.' : 'GPU 모델명은 표시되지 않습니다.' };
      } catch {
        return { value: '확인 제한', detail: '그래픽 정보를 확인할 수 없습니다.' };
      }
    };

    const parseMemory = (value) => {
      const match = String(value || '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : null;
    };

    const renderSpecCard = ({ label, value, desc, tone = 'neutral' }) => `
      <article class="spec-card ${tone}">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(desc)}</small>
      </article>`;

    const collectAutoSpecs = () => {
      const gpu = getGpuInfo();
      const cores = navigator.hardwareConcurrency || null;
      const memory = navigator.deviceMemory || null;
      const width = window.screen?.width || window.innerWidth;
      const height = window.screen?.height || window.innerHeight;
      const ratio = window.devicePixelRatio || 1;
      return {
        os: getOsName(),
        cores,
        memory,
        gpu,
        screen: `${width} × ${height}`,
        pixelRatio: ratio
      };
    };

    const renderAutoSpecs = () => {
      const specs = collectAutoSpecs();
      const cards = [
        { label: '운영체제 추정', value: specs.os, desc: '사용자 환경 문자열을 바탕으로 추정한 값입니다.' },
        { label: 'CPU 논리 코어', value: specs.cores ? `${specs.cores}개` : '확인 제한', desc: specs.cores ? '동시에 처리 가능한 논리 프로세서 수입니다.' : '현재 환경에서 제공되지 않습니다.', tone: specs.cores >= 8 ? 'success' : 'neutral' },
        { label: '메모리 추정', value: specs.memory ? `약 ${specs.memory}GB` : '확인 제한', desc: specs.memory ? '브라우저가 제공하는 대략적인 메모리 값입니다.' : '정확한 RAM은 직접 입력해 주세요.', tone: specs.memory >= 8 ? 'success' : 'neutral' },
        { label: 'GPU/WebGL', value: specs.gpu.value, desc: specs.gpu.detail },
        { label: '화면 해상도', value: specs.screen, desc: `픽셀 비율 ${specs.pixelRatio} 기준으로 표시됩니다.` },
        { label: '정확한 부품명', value: '직접 입력 필요', desc: 'CPU 모델명, RAM, GPU, 저장장치는 아래 입력란을 활용하세요.', tone: 'warning' }
      ];
      autoGrid.innerHTML = cards.map(renderSpecCard).join('');
      meaningList.innerHTML = buildAutoMeanings(specs).map((row) => `
        <div class="result-row"><span>${escape(row.label)}</span><strong>${escape(row.text)}</strong></div>
      `).join('');
    };

    const buildAutoMeanings = (specs) => {
      const rows = [];
      if (specs.cores) {
        rows.push({ label: 'CPU 코어 의미', text: specs.cores >= 8 ? '여러 프로그램을 동시에 쓰는 작업에 비교적 유리한 편입니다.' : specs.cores >= 4 ? '문서 작업과 웹 사용에는 대체로 무난한 편입니다.' : '동시 작업이 많으면 체감이 답답할 수 있습니다.' });
      } else {
        rows.push({ label: 'CPU 코어 의미', text: '자동 확인이 제한되어 직접 CPU 모델명을 입력하는 것이 좋습니다.' });
      }
      if (specs.memory) {
        rows.push({ label: '메모리 의미', text: specs.memory >= 16 ? '여러 탭, 문서 작업, 가벼운 편집 작업에 여유가 있는 편입니다.' : specs.memory >= 8 ? '일반 작업에는 무난하지만 무거운 편집 작업은 부족할 수 있습니다.' : '여러 프로그램을 동시에 켜면 부족할 가능성이 있습니다.' });
      } else {
        rows.push({ label: '메모리 의미', text: '브라우저에서 RAM 값을 제공하지 않아 직접 입력이 필요합니다.' });
      }
      rows.push({ label: 'GPU 의미', text: specs.gpu.value.includes('확인') ? '그래픽 성능 판단은 GPU 모델명을 직접 입력해야 더 정확합니다.' : 'WebGL 렌더러 정보는 참고용이며 실제 그래픽카드 모델명과 다르게 보일 수 있습니다.' });
      rows.push({ label: '화면 의미', text: '해상도는 작업 공간과 선명도에 영향을 주며, 모니터 크기와 배율 설정에 따라 체감이 달라집니다.' });
      return rows;
    };

    const classifyCpuScore = (score) => {
      if (score >= 90000000) return { label: '높음', tone: 'success', width: '92%', text: '짧은 반복 연산 기준으로 비교적 높은 처리량입니다.' };
      if (score >= 45000000) return { label: '보통', tone: 'neutral', width: '62%', text: '일반적인 작업에는 무난한 참고 처리량입니다.' };
      return { label: '낮음', tone: 'warning', width: '34%', text: '현재 환경에서는 처리량이 낮게 측정되었습니다. 절전 모드나 백그라운드 작업을 확인해 보세요.' };
    };

    const runCpuTest = () => {
      benchmarkBox.hidden = false;
      benchmarkBar.style.width = '8%';
      benchmarkResult.innerHTML = '<div class="result-row"><span>상태</span><strong>테스트를 준비하고 있습니다.</strong></div>';
      cpuTestStatus.textContent = '측정 중';
      cpuTestStatus.className = 'status-pill neutral';
      cpuTestButton.disabled = true;
      cpuTestButton.textContent = 'CPU 테스트 중...';

      const workerCode = `
        self.onmessage = () => {
          const start = performance.now();
          let count = 0;
          let checksum = 0;
          while (performance.now() - start < 900) {
            for (let i = 0; i < 10000; i += 1) {
              checksum = (checksum + Math.sqrt((i + count) % 9973)) % 1000000;
            }
            count += 10000;
          }
          const elapsed = performance.now() - start;
          self.postMessage({ count, elapsed, checksum });
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = (event) => {
        const { count, elapsed } = event.data || {};
        const score = Math.round((count / elapsed) * 1000);
        const grade = classifyCpuScore(score);
        benchmarkBar.style.width = grade.width;
        cpuTestStatus.textContent = grade.label;
        cpuTestStatus.className = `status-pill ${grade.tone}`;
        benchmarkResult.innerHTML = `
          <div class="result-row"><span>참고 점수</span><strong>${escape(score.toLocaleString('ko-KR'))} ops/sec</strong></div>
          <div class="result-row"><span>해석</span><strong>${escape(grade.text)}</strong></div>
          <div class="result-row"><span>측정 시간</span><strong>약 ${escape(Math.round(elapsed))}ms</strong></div>
        `;
        cpuTestButton.disabled = false;
        cpuTestButton.textContent = 'CPU 간단 테스트 다시 시작';
        worker.terminate();
      };
      worker.onerror = () => {
        cpuTestStatus.textContent = '오류';
        cpuTestStatus.className = 'status-pill warning';
        benchmarkResult.innerHTML = '<div class="result-row"><span>오류</span><strong>CPU 테스트를 실행할 수 없습니다.</strong></div>';
        cpuTestButton.disabled = false;
        cpuTestButton.textContent = 'CPU 간단 테스트 시작';
        worker.terminate();
      };
      worker.postMessage({});
    };

    const interpretManual = (data) => {
      const cpu = data.get('cpu')?.trim() || '';
      const ram = data.get('ram')?.trim() || '';
      const gpu = data.get('gpu')?.trim() || '';
      const storage = data.get('storage')?.trim() || '';
      const purpose = data.get('purpose') || '';
      const ramGb = parseMemory(ram);
      const gpuLower = gpu.toLowerCase();
      const cpuLower = cpu.toLowerCase();
      const storageLower = storage.toLowerCase();
      const rows = [];

      rows.push({ label: 'CPU', text: cpu ? (/(i7|i9|ryzen\s*7|ryzen\s*9|m[1-4]\s*(pro|max|ultra)?)/i.test(cpuLower) ? '무거운 작업에 비교적 유리한 CPU로 볼 수 있습니다.' : /(i5|ryzen\s*5|m[1-4])/i.test(cpuLower) ? '일반 작업과 중간 수준 작업에 무난한 CPU로 볼 수 있습니다.' : '모델 세부 성능 확인이 필요합니다.') : 'CPU 모델명을 입력하면 더 구체적으로 해석할 수 있습니다.' });
      rows.push({ label: 'RAM', text: ramGb ? (ramGb >= 32 ? '영상 편집, 개발, 멀티태스킹에 여유가 큰 편입니다.' : ramGb >= 16 ? '일반 작업과 가벼운 편집, 개발 작업에 무난한 편입니다.' : ramGb >= 8 ? '일반 작업은 가능하지만 무거운 작업은 부족할 수 있습니다.' : '메모리가 부족해 여러 작업에서 답답할 수 있습니다.') : 'RAM 용량을 입력하면 작업 여유를 더 잘 판단할 수 있습니다.' });
      rows.push({ label: 'GPU', text: gpu ? (/(rtx|gtx|radeon\s*rx|arc)/i.test(gpuLower) ? '별도 그래픽카드로 보이며 게임·그래픽 작업에 더 유리합니다.' : /(iris|uhd|vega|integrated|내장)/i.test(gpuLower) ? '내장 그래픽 계열로 보이며 문서·웹·가벼운 작업 중심에 적합합니다.' : 'GPU 모델명을 기준으로 추가 확인이 필요합니다.') : 'GPU 모델명을 입력하면 게임·그래픽 작업 가능성을 더 잘 볼 수 있습니다.' });
      rows.push({ label: '저장장치', text: storage ? (/nvme|ssd/i.test(storageLower) ? 'SSD 계열로 보이며 부팅과 프로그램 실행 체감에 유리합니다.' : /hdd/i.test(storageLower) ? 'HDD 계열은 대용량 보관에는 좋지만 체감 속도는 SSD보다 느릴 수 있습니다.' : '종류와 용량을 함께 확인하면 더 좋습니다.') : '저장장치 종류와 용량을 입력하면 체감 속도와 저장 여유를 판단하기 쉽습니다.' });

      const purposeText = {
        office: '문서 작업·웹서핑·온라인 강의는 RAM 8GB 이상이면 대체로 무난하고, SSD가 있으면 체감이 좋아집니다.',
        design: '이미지 편집은 RAM 16GB 이상과 SSD가 있으면 안정적이며, 큰 파일 작업은 GPU와 CPU도 영향을 줍니다.',
        video: '영상 편집은 CPU, RAM 16~32GB 이상, SSD, GPU가 모두 중요합니다. 코덱과 해상도에 따라 체감 차이가 큽니다.',
        game: '게임은 GPU 영향이 큽니다. 게임별 권장사양과 해상도, 옵션 설정을 함께 확인해야 합니다.',
        coding: '개발 작업은 CPU 코어, RAM, SSD가 중요합니다. Docker나 가상머신을 쓰면 RAM 16GB 이상이 더 안정적입니다.'
      }[purpose];
      if (purposeText) rows.push({ label: '사용 목적', text: purposeText });

      return rows;
    };

    manualForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const rows = interpretManual(new FormData(manualForm));
      manualResultBox.innerHTML = '<div class="result-list">' + rows.map((row) => `
        <div class="result-row"><span>${escape(row.label)}</span><strong>${escape(row.text)}</strong></div>
      `).join('') + '</div><p class="legal-note pc-note"><strong>안내:</strong> 이 해석은 입력한 텍스트와 일반적인 사양 기준을 바탕으로 한 참고 설명입니다. 정확한 성능은 실제 모델명, 전력 제한, 발열, 작업 종류에 따라 달라집니다.</p>';
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const helpButton = event.target.closest('[data-help-topic]');
      if (!helpButton) return;
      const topic = helpContents[helpButton.dataset.helpTopic];
      if (!topic || !modal || !modalTitle || !modalBody) return;
      modalTitle.textContent = topic.title;
      modalBody.innerHTML = topic.body;
      modal.hidden = false;
      document.body.classList.add('modal-open');
    });

    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    };
    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    refreshButton?.addEventListener('click', renderAutoSpecs);
    cpuTestButton?.addEventListener('click', runCpuTest);
    renderAutoSpecs();
  }

  const form = document.querySelector('#business-check-form');
  if (!form) return;

  const submitButton = document.querySelector('#check-submit');
  const resultPanel = document.querySelector('#result-panel');
  const resultUpdated = document.querySelector('#result-updated');
  const resultMessage = document.querySelector('#result-message');
  const statusStack = document.querySelector('#status-stack');
  const comparisonBox = document.querySelector('#comparison-box');
  const comparisonList = document.querySelector('#comparison-list');
  const checklistBox = document.querySelector('#dynamic-checklist');
  const checklistList = document.querySelector('#checklist-list');
  const businessInput = document.querySelector('#business-number');
  const startDateInput = document.querySelector('#start-date');

  const scope = form.dataset.scope || 'full';
  const submitLabel = form.dataset.submitLabel || '사업자 정보 확인하기';
  const loadingLabel = form.dataset.loadingLabel || '확인 중입니다...';

  const visibleScopes = {
    status: { status: true, validate: false, mailOrder: false, comparison: false, checklist: true },
    validate: { status: true, validate: true, mailOrder: false, comparison: false, checklist: true },
    'mail-order': { status: false, validate: false, mailOrder: true, comparison: false, checklist: true },
    compare: { status: true, validate: true, mailOrder: true, comparison: true, checklist: true },
    checklist: { status: true, validate: false, mailOrder: true, comparison: true, checklist: true },
    full: { status: true, validate: true, mailOrder: true, comparison: true, checklist: true }
  };

  const currentScope = visibleScopes[scope] || visibleScopes.full;

  const formatBusinessNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const formatDate = (value) => value.replace(/\D/g, '').slice(0, 8);

  businessInput?.addEventListener('input', (event) => {
    event.target.value = formatBusinessNumber(event.target.value);
  });

  startDateInput?.addEventListener('input', (event) => {
    event.target.value = formatDate(event.target.value);
  });

  const setMessage = (message, type = 'info') => {
    if (!message) {
      resultMessage.hidden = true;
      resultMessage.textContent = '';
      resultMessage.className = 'message-box';
      return;
    }
    resultMessage.hidden = false;
    resultMessage.textContent = message;
    resultMessage.className = `message-box ${type === 'error' ? 'error' : ''}`;
  };

  const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? loadingLabel : submitLabel;
    resultPanel.hidden = false;
    if (isLoading) {
      resultUpdated.textContent = '조회 중';
      resultUpdated.className = 'status-pill neutral';
      setMessage('공식 API 조회를 진행하고 있습니다. 잠시만 기다려 주세요.');
      statusStack.innerHTML = statusCard({
        icon: 'i',
        tone: 'neutral',
        title: '조회 중입니다',
        description: '필요한 공식 정보를 확인하고 있습니다.',
        pill: '조회 중'
      });
      comparisonBox.hidden = true;
      checklistBox.hidden = true;
    }
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const statusCard = ({ icon, tone, title, description, pill }) => `
    <article class="status-card">
      <span class="status-icon ${tone}" aria-hidden="true">${escapeHtml(icon)}</span>
      <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
      <em class="status-pill ${tone}">${escapeHtml(pill)}</em>
    </article>
  `;

  const comparisonRow = ({ label, input, official, status, tone }) => `
    <div class="result-row">
      <span>${escapeHtml(label)} <em class="status-pill ${tone}">${escapeHtml(status)}</em></span>
      <strong>${escapeHtml(input || '입력 없음')} → ${escapeHtml(official || '공식 정보 없음')}</strong>
    </div>
  `;

  const collectPayload = () => {
    const data = new FormData(form);
    return {
      mode: scope,
      businessNumber: String(data.get('businessNumber') || '').trim(),
      storeName: String(data.get('storeName') || '').trim(),
      representativeName: String(data.get('representativeName') || '').trim(),
      startDate: String(data.get('startDate') || '').trim(),
      permitNumber: String(data.get('permitNumber') || '').trim(),
      storeUrl: String(data.get('storeUrl') || '').trim()
    };
  };

  const renderResults = (payload) => {
    const status = payload.businessStatus || {};
    const validate = payload.businessValidate || {};
    const mailOrder = payload.mailOrder || {};
    const messages = payload.messages || [];
    const comparisons = payload.comparisons || [];
    const checklist = payload.checklist || [];

    resultUpdated.textContent = payload.checkedAt ? new Date(payload.checkedAt).toLocaleString('ko-KR') : '조회 완료';
    resultUpdated.className = 'status-pill success';
    setMessage(messages[0] || '조회가 완료되었습니다. 이 결과는 공식 등록정보 확인용이며, 사기 여부나 거래 안전성을 판정하지 않습니다.');

    const cards = [];
    if (currentScope.status) {
      const statusTone = status.tone || 'neutral';
      const statusIcon = statusTone === 'success' ? '✓' : statusTone === 'warning' ? '!' : statusTone === 'danger' ? '!' : 'i';
      cards.push(statusCard({
        icon: statusIcon,
        tone: statusTone,
        title: '사업자등록 상태',
        description: status.summary || '조회 결과가 없습니다.',
        pill: status.label || '확인 필요'
      }));
    }
    if (currentScope.validate) {
      const validateTone = validate.checked ? (validate.valid ? 'success' : 'warning') : 'neutral';
      cards.push(statusCard({
        icon: validateTone === 'success' ? '✓' : 'i',
        tone: validateTone,
        title: '사업자 진위확인',
        description: validate.summary || '개업일자와 대표자명을 입력하면 진위확인을 함께 시도합니다.',
        pill: validate.checked ? (validate.valid ? '일치' : '확인 필요') : '선택'
      }));
    }
    if (currentScope.mailOrder) {
      const ftcTone = mailOrder.found ? 'success' : (mailOrder.error ? 'warning' : 'neutral');
      const ftcIcon = mailOrder.found ? '✓' : 'i';
      cards.push(statusCard({
        icon: ftcIcon,
        tone: ftcTone,
        title: '통신판매업 정보',
        description: mailOrder.summary || '통신판매업 등록상세 조회 결과가 없습니다.',
        pill: mailOrder.found ? '확인됨' : (mailOrder.error ? '확인 필요' : '정보 없음')
      }));
    }

    statusStack.innerHTML = cards.join('') || statusCard({
      icon: 'i',
      tone: 'neutral',
      title: '조회 완료',
      description: '확인 가능한 항목이 없습니다.',
      pill: '완료'
    });

    if (currentScope.comparison && comparisons.length) {
      comparisonBox.hidden = false;
      comparisonList.innerHTML = comparisons.map(comparisonRow).join('');
    } else {
      comparisonBox.hidden = true;
      comparisonList.innerHTML = '';
    }

    if (currentScope.checklist && checklist.length) {
      checklistBox.hidden = false;
      checklistList.innerHTML = checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    } else {
      checklistBox.hidden = true;
      checklistList.innerHTML = '';
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectPayload();
    const digits = payload.businessNumber.replace(/\D/g, '');

    if (digits.length !== 10) {
      resultPanel.hidden = false;
      resultUpdated.textContent = '입력 확인';
      resultUpdated.className = 'status-pill warning';
      setMessage('사업자등록번호는 숫자 10자리로 입력해야 합니다.', 'error');
      statusStack.innerHTML = statusCard({
        icon: '!',
        tone: 'warning',
        title: '입력값 확인 필요',
        description: '사업자등록번호 형식을 다시 확인해 주세요.',
        pill: '확인 필요'
      });
      comparisonBox.hidden = true;
      checklistBox.hidden = true;
      return;
    }

    if (scope === 'validate') {
      const startDate = payload.startDate.replace(/\D/g, '');
      if (!payload.representativeName || startDate.length !== 8) {
        resultPanel.hidden = false;
        resultUpdated.textContent = '입력 확인';
        resultUpdated.className = 'status-pill warning';
        setMessage('진위확인은 대표자명과 YYYYMMDD 형식의 개업일자가 필요합니다.', 'error');
        statusStack.innerHTML = statusCard({
          icon: '!',
          tone: 'warning',
          title: '필수 입력값 확인 필요',
          description: '대표자명과 개업일자를 다시 확인해 주세요.',
          pill: '확인 필요'
        });
        comparisonBox.hidden = true;
        checklistBox.hidden = true;
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || '조회 중 오류가 발생했습니다.');
      }
      renderResults(result);
    } catch (error) {
      resultUpdated.textContent = '오류';
      resultUpdated.className = 'status-pill warning';
      setMessage(error.message || '조회 중 오류가 발생했습니다.', 'error');
      statusStack.innerHTML = statusCard({
        icon: '!',
        tone: 'warning',
        title: '조회 실패',
        description: 'API 키 설정, 공공데이터포털 활용신청 상태, 네트워크 상태를 확인해 주세요. 입력값은 별도 DB에 저장하지 않습니다.',
        pill: '확인 필요'
      });
      comparisonBox.hidden = true;
      checklistBox.hidden = true;
    } finally {
      setLoading(false);
    }
  });
})();
