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
    const refreshButton = document.querySelector('#pc-refresh-button');
    const autoGpuInput = document.querySelector('#auto-gpu-manual');
    const autoSpecInterpretButton = document.querySelector('#auto-spec-interpret-button');
    const cpuTestButton = document.querySelector('#cpu-test-button');
    const benchmarkBox = document.querySelector('#benchmark-box');
    const benchmarkBar = document.querySelector('#benchmark-bar');
    const benchmarkResult = document.querySelector('#benchmark-result');
    const cpuTestStatus = document.querySelector('#cpu-test-status');
    const manualForm = document.querySelector('#manual-spec-form');
    const imageInput = document.querySelector('#spec-image-input');
    const ocrStatus = document.querySelector('#ocr-status');
    const modal = document.querySelector('#spec-help-modal');
    const modalPanel = modal?.querySelector('.help-modal-panel');
    const modalEyebrow = document.querySelector('#spec-help-eyebrow');
    const modalTitle = document.querySelector('#spec-help-title');
    const modalBody = document.querySelector('#spec-help-body');
    const modalClose = document.querySelector('#spec-help-close');

    let lastAutoSpecs = null;

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
            <li><strong>상품 페이지:</strong> 그래픽, GPU, VGA, Graphics 항목에 표시된 모델명을 입력합니다.</li>
          </ul>`
      },
      storage: {
        title: '저장장치는 어디서 보나요?',
        body: `
          <ul class="info-bullet-list">
            <li><strong>Windows:</strong> 작업 관리자 → 성능 → 디스크에서 SSD/HDD 여부와 용량을 확인합니다. 장치 관리자나 디스크 관리에서도 볼 수 있습니다.</li>
            <li><strong>macOS:</strong> 시스템 설정 → 일반 → 저장 공간에서 용량을 확인합니다.</li>
            <li><strong>상품 페이지:</strong> 저장장치, SSD, HDD, Storage 항목의 종류와 용량을 입력합니다.</li>
          </ul>`
      }
    };

    const showModal = ({ eyebrow = '확인 결과', title, body, wide = false }) => {
      if (!modal || !modalTitle || !modalBody) return;
      if (modalEyebrow) modalEyebrow.textContent = eyebrow;
      modalTitle.textContent = title;
      modalBody.innerHTML = body;
      modal.hidden = false;
      modalPanel?.classList.toggle('wide-result', Boolean(wide));
      document.body.classList.add('modal-open');
    };

    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      modalPanel?.classList.remove('wide-result');
      document.body.classList.remove('modal-open');
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
        if (!gl) return { value: '직접 입력 권장', detail: 'WebGL 확인이 제한되어 GPU 모델명을 직접 입력하는 것이 좋습니다.' };
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return { value: '직접 입력 권장', detail: 'WebGL은 지원하지만 GPU 모델명은 보안 설정상 표시되지 않습니다.' };
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return { value: '직접 입력 권장', detail: renderer ? `참고 WebGL 렌더러: ${renderer}` : 'GPU 모델명은 직접 입력해야 더 정확합니다.', raw: renderer || '' };
      } catch {
        return { value: '직접 입력 권장', detail: '그래픽 정보를 확인할 수 없어 직접 입력이 필요합니다.' };
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
      lastAutoSpecs = specs;
      const cards = [
        { label: '운영체제 추정', value: specs.os, desc: '사용자 환경 문자열을 바탕으로 추정한 값입니다.' },
        { label: 'CPU 논리 코어', value: specs.cores ? `${specs.cores}개` : '확인 제한', desc: specs.cores ? '동시에 처리 가능한 논리 프로세서 수입니다.' : '현재 환경에서 제공되지 않습니다.', tone: specs.cores >= 8 ? 'success' : 'neutral' },
        { label: '메모리 추정', value: specs.memory ? `약 ${specs.memory}GB` : '확인 제한', desc: specs.memory ? '브라우저가 제공하는 대략적인 메모리 값입니다.' : '정확한 RAM은 직접 입력해 주세요.', tone: specs.memory >= 8 ? 'success' : 'neutral' },
        { label: 'GPU 자동 확인', value: specs.gpu.value, desc: specs.gpu.detail, tone: 'warning' },
        { label: '화면 해상도', value: specs.screen, desc: '현재 화면의 표시 해상도입니다.' },
        { label: '정확한 부품명', value: '직접 입력 필요', desc: 'CPU 모델명, GPU 모델, 저장장치 모델은 직접 입력이 더 정확합니다.', tone: 'warning' }
      ];
      autoGrid.innerHTML = cards.map(renderSpecCard).join('');
    };

    const classifyGpuText = (gpuText) => {
      const text = String(gpuText || '').toLowerCase();
      if (/(rtx\s*40(8|9)|rtx\s*50|rx\s*79|rx\s*78)/i.test(text)) return { label: '상급 외장 GPU', score: 2.4, text: '고해상도 게임, 그래픽 작업, GPU 가속 작업에 유리한 그래픽 계열로 볼 수 있습니다.' };
      if (/(rtx\s*40(5|6|7)|rtx\s*30(6|7|8)|rx\s*6[67]|rx\s*77|arc\s*a7)/i.test(text)) return { label: '중상급 외장 GPU', score: 2, text: 'FHD 게임, 그래픽 작업, 영상 편집 보조에 비교적 유리한 그래픽 계열로 볼 수 있습니다.' };
      if (/(rtx\s*20|rtx\s*30(5)|gtx\s*16|gtx\s*10|rx\s*5|rx\s*6|arc)/i.test(text)) return { label: '외장 GPU', score: 1.4, text: '내장 그래픽보다 그래픽 작업에 유리하지만, 모델별 성능 차이가 큽니다.' };
      if (/(iris|uhd|vega|integrated|내장|apple\s*m|radeon\s*graphics)/i.test(text)) return { label: '내장·통합 GPU', score: 0.6, text: '문서, 웹, 영상 시청, 가벼운 그래픽 작업 중심에 적합한 그래픽 계열로 볼 수 있습니다.' };
      return { label: 'GPU 확인 필요', score: 0, text: 'GPU 모델명이 명확하지 않아 게임·그래픽 작업 판단은 직접 입력값 확인이 필요합니다.' };
    };

    const summarizeAutoGrade = (specs, manualGpu) => {
      const gpuText = manualGpu || specs.gpu.raw || '';
      const gpuGrade = classifyGpuText(gpuText);
      let score = 0;
      if (specs.cores >= 16) score += 3;
      else if (specs.cores >= 12) score += 2.5;
      else if (specs.cores >= 8) score += 2;
      else if (specs.cores >= 4) score += 1;
      if (specs.memory >= 32) score += 2;
      else if (specs.memory >= 16) score += 1.6;
      else if (specs.memory >= 8) score += 1;
      else if (specs.memory) score += 0.4;
      score += gpuGrade.score;

      if (score >= 6) return { label: '고성능 작업용·게이밍 PC급으로 볼 수 있는 구성', detail: '멀티태스킹, 개발, FHD~QHD 게임, 가벼운 영상 편집까지 비교적 여유가 있는 쪽입니다.', gpuGrade };
      if (score >= 4.5) return { label: '중상급 생산성·FHD 게임 가능급으로 볼 수 있는 구성', detail: '문서·웹·개발·가벼운 편집에는 여유가 있고, GPU 모델에 따라 게임 체감도 기대할 수 있습니다.', gpuGrade };
      if (score >= 3) return { label: '일반 업무·학습용 이상으로 볼 수 있는 구성', detail: '웹서핑, 문서 작업, 온라인 강의, 여러 탭 사용은 대체로 무난하며 무거운 게임·편집은 추가 확인이 필요합니다.', gpuGrade };
      if (score >= 1.5) return { label: '기본 업무·웹 사용 중심 구성으로 볼 수 있습니다', detail: '가벼운 작업에는 사용할 수 있지만, 멀티태스킹이나 무거운 프로그램은 체감이 제한될 수 있습니다.', gpuGrade };
      return { label: '자동 확인값만으로는 등급 판단이 제한됩니다', detail: 'CPU 모델명, RAM, GPU, 저장장치를 직접 입력하면 더 정확하게 해석할 수 있습니다.', gpuGrade };
    };

    const buildAutoInterpretationRows = (specs, manualGpu) => {
      const rows = [];
      const grade = summarizeAutoGrade(specs, manualGpu);
      rows.push({ label: '종합 추정', text: `${grade.label} — ${grade.detail}` });
      rows.push({ label: '운영체제', text: `${specs.os}로 추정됩니다. 웹 보안 정책상 세부 버전과 설치 환경은 표시하지 않습니다.` });
      if (specs.cores) {
        rows.push({ label: 'CPU 논리 코어', text: specs.cores >= 16 ? `${specs.cores}개입니다. 고부하 멀티태스킹과 개발·편집 작업에 유리한 편입니다.` : specs.cores >= 12 ? `${specs.cores}개입니다. 중상급 노트북 또는 데스크톱급 작업 여유로 볼 수 있습니다.` : specs.cores >= 8 ? `${specs.cores}개입니다. 일반 업무와 여러 프로그램 동시 사용에 무난한 편입니다.` : specs.cores >= 4 ? `${specs.cores}개입니다. 기본 작업은 가능하지만 무거운 작업은 CPU 모델 확인이 필요합니다.` : `${specs.cores}개입니다. 동시 작업이 많으면 체감이 제한될 수 있습니다.` });
      } else {
        rows.push({ label: 'CPU 논리 코어', text: '자동 확인이 제한되었습니다. CPU 모델명을 직접 입력하면 용도별 판단이 더 정확해집니다.' });
      }
      if (specs.memory) {
        rows.push({ label: '메모리 추정', text: specs.memory >= 32 ? `약 ${specs.memory}GB입니다. 영상 편집, 개발, 멀티태스킹에 여유가 큰 편입니다.` : specs.memory >= 16 ? `약 ${specs.memory}GB입니다. 일반 작업, 개발, 가벼운 편집에는 비교적 안정적인 편입니다.` : specs.memory >= 8 ? `약 ${specs.memory}GB입니다. 문서·웹 중심은 무난하지만 무거운 편집·게임은 여유가 제한될 수 있습니다.` : `약 ${specs.memory}GB입니다. 여러 프로그램을 동시에 쓰기에는 부족할 수 있습니다.` });
      } else {
        rows.push({ label: '메모리 추정', text: '브라우저가 RAM 추정값을 제공하지 않았습니다. 실제 용량을 직접 입력하는 것이 좋습니다.' });
      }
      rows.push({ label: 'GPU', text: manualGpu ? `${manualGpu}로 직접 입력되었습니다. ${grade.gpuGrade.text}` : `${grade.gpuGrade.label}: 자동 WebGL 값은 참고용입니다. 실제 그래픽카드 모델명을 입력하면 게임·그래픽 작업 판단이 더 좋아집니다.` });
      rows.push({ label: '화면 해상도', text: `${specs.screen}입니다. 작업 공간과 선명도에 영향을 주지만, 체감은 모니터 크기와 배율 설정에 따라 달라집니다.` });
      return { grade, rows };
    };

    const interpretAutoSpecs = () => {
      const specs = lastAutoSpecs || collectAutoSpecs();
      const manualGpu = autoGpuInput?.value.trim() || '';
      const { grade, rows } = buildAutoInterpretationRows(specs, manualGpu);
      const body = `
        <div class="pc-result-summary">
          <div class="summary-callout"><strong>${escape(grade.label)}</strong><br>${escape(grade.detail)} 자동 확인값은 브라우저가 제공하는 범위 안에서만 표시되므로, 정확한 CPU·GPU·저장장치 모델명은 직접 입력 결과와 함께 보는 것이 좋습니다.</div>
          <div class="result-list">
            ${rows.map((row) => `<div class="result-row"><span>${escape(row.label)}</span><strong>${escape(row.text)}</strong></div>`).join('')}
          </div>
          <p class="legal-note pc-note"><strong>안내:</strong> 이 해석은 자동 확인값과 직접 입력한 GPU명을 바탕으로 한 참고 설명입니다. 실제 성능은 정확한 모델명, 전력 제한, 발열, 드라이버, 작업 종류에 따라 달라집니다.</p>
        </div>`;
      showModal({ eyebrow: '자동 사양 해석', title: '자동 확인 사양 결과', body, wide: true });
    };

    const classifyCpuScore = (score) => {
      if (score >= 135000000) return { label: '매우 높음', tone: 'success', width: '98%', range: '고성능 데스크톱 i7/Ryzen 7급 이상 가능 범위', text: '짧은 반복 연산 기준으로 매우 높은 처리량입니다. 단, 브라우저 테스트라 실제 CPU 순위와 일치하지 않을 수 있습니다.' };
      if (score >= 90000000) return { label: '높음', tone: 'success', width: '86%', range: '고성능 노트북 i5·i7 H급 또는 데스크톱 i5급 사이로 볼 수 있는 범위', text: '일반 작업, 개발, 가벼운 편집, 멀티태스킹에 비교적 유리한 처리량입니다.' };
      if (score >= 55000000) return { label: '보통 이상', tone: 'neutral', width: '66%', range: '일반 노트북 i5/Ryzen 5 U급과 일부 데스크톱 보급형 CPU 사이로 볼 수 있는 범위', text: '문서 작업, 웹 사용, 온라인 강의, 가벼운 작업에는 무난한 참고 처리량입니다.' };
      if (score >= 25000000) return { label: '보통', tone: 'neutral', width: '46%', range: '보급형 노트북 i3·Ryzen 3급 또는 구형 i5급 사이로 볼 수 있는 범위', text: '일반 작업은 가능하지만 여러 프로그램을 동시에 쓰거나 무거운 작업에서는 체감 차이가 날 수 있습니다.' };
      return { label: '낮음', tone: 'warning', width: '28%', range: '저전력·입문형 CPU, Intel N100 또는 구형 모바일 CPU에 가까운 범위', text: '현재 환경에서는 처리량이 낮게 측정되었습니다. 절전 모드, 발열, 백그라운드 작업을 확인해 보세요.' };
    };

    const openCpuResultModal = (score, elapsed, grade) => {
      const body = `
        <div class="pc-result-summary">
          <div class="summary-callout">참고 점수는 <strong>${escape(score.toLocaleString('ko-KR'))} ops/sec</strong>입니다. 현재 측정값은 <strong>${escape(grade.range)}</strong>로 이해하면 됩니다.</div>
          <div class="cpu-compare-card">
            <strong>${escape(grade.label)} · ${escape(grade.range)}</strong>
            <p>${escape(grade.text)}</p>
          </div>
          <div class="result-list">
            <div class="result-row"><span>참고 점수</span><strong>${escape(score.toLocaleString('ko-KR'))} ops/sec</strong></div>
            <div class="result-row"><span>측정 시간</span><strong>약 ${escape(Math.round(elapsed))}ms</strong></div>
            <div class="result-row"><span>주의할 점</span><strong>브라우저, 전원 모드, 발열, 백그라운드 작업에 따라 점수가 달라질 수 있습니다.</strong></div>
          </div>
          <p class="legal-note pc-note"><strong>안내:</strong> 이 비교군은 체감 이해를 돕기 위한 참고 설명입니다. 실제 CPU 벤치마크 순위나 제품 성능을 보장하지 않습니다.</p>
        </div>`;
      showModal({ eyebrow: 'CPU 간단 테스트', title: 'CPU 간단 테스트 결과', body, wide: true });
    };

    const runCpuTest = () => {
      cpuTestButton.disabled = true;
      cpuTestButton.textContent = 'CPU 테스트 중...';
      showModal({ eyebrow: 'CPU 간단 테스트', title: 'CPU 테스트 중입니다', body: '<p>브라우저 안에서 약 1초 동안 짧은 반복 연산을 실행하고 있습니다. 잠시만 기다려 주세요.</p>' });

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
        cpuTestButton.disabled = false;
        cpuTestButton.textContent = 'CPU 간단 테스트 다시 시작';
        openCpuResultModal(score, elapsed, grade);
        worker.terminate();
      };
      worker.onerror = () => {
        cpuTestButton.disabled = false;
        cpuTestButton.textContent = 'CPU 간단 테스트 시작';
        showModal({ eyebrow: 'CPU 간단 테스트', title: 'CPU 테스트 실행 오류', body: '<p>현재 브라우저 환경에서 CPU 간단 테스트를 실행할 수 없습니다. 새로고침 후 다시 시도해 주세요.</p>' });
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

      rows.push({ label: 'CPU', text: cpu ? (/(i7|i9|ryzen\s*7|ryzen\s*9|m[1-4]\s*(pro|max|ultra)?)/i.test(cpuLower) ? '무거운 작업에 비교적 유리한 CPU로 볼 수 있습니다. 다만 노트북은 전력 제한과 발열에 따라 체감 차이가 큽니다.' : /(i5|ryzen\s*5|m[1-4])/i.test(cpuLower) ? '일반 작업과 중간 수준 작업에 무난한 CPU로 볼 수 있습니다.' : /(i3|ryzen\s*3|n100|celeron|pentium)/i.test(cpuLower) ? '문서·웹 중심의 보급형 작업에 맞는 CPU로 볼 수 있습니다.' : '모델 세부 성능 확인이 필요합니다.') : 'CPU 모델명을 입력하면 더 구체적으로 해석할 수 있습니다.' });
      rows.push({ label: 'RAM', text: ramGb ? (ramGb >= 32 ? '영상 편집, 개발, 멀티태스킹에 여유가 큰 편입니다.' : ramGb >= 16 ? '일반 작업과 가벼운 편집, 개발 작업에 무난한 편입니다.' : ramGb >= 8 ? '일반 작업은 가능하지만 무거운 작업은 부족할 수 있습니다.' : '메모리가 부족해 여러 작업에서 답답할 수 있습니다.') : 'RAM 용량을 입력하면 작업 여유를 더 잘 판단할 수 있습니다.' });
      rows.push({ label: 'GPU', text: gpu ? (/(rtx\s*40|rtx\s*30|rtx\s*20|gtx|radeon\s*rx|arc)/i.test(gpuLower) ? '별도 그래픽카드로 보이며 게임·그래픽 작업에 더 유리합니다.' : /(iris|uhd|vega|integrated|내장|apple\s*m)/i.test(gpuLower) ? '내장 또는 통합 그래픽 계열로 보이며 문서·웹·가벼운 작업 중심에 적합합니다.' : 'GPU 모델명을 기준으로 추가 확인이 필요합니다.') : 'GPU 모델명을 입력하면 게임·그래픽 작업 가능성을 더 잘 볼 수 있습니다.' });
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

    const showManualResult = (rows) => {
      const body = `
        <div class="pc-result-summary">
          <div class="summary-callout">직접 입력한 CPU·RAM·GPU·저장장치 정보를 기준으로 용도별 의미를 정리했습니다.</div>
          <div class="result-list">
            ${rows.map((row) => `<div class="result-row"><span>${escape(row.label)}</span><strong>${escape(row.text)}</strong></div>`).join('')}
          </div>
          <p class="legal-note pc-note"><strong>안내:</strong> 이 해석은 입력한 텍스트와 일반적인 사양 기준을 바탕으로 한 참고 설명입니다. 정확한 성능은 실제 모델명, 전력 제한, 발열, 작업 종류에 따라 달라집니다.</p>
        </div>`;
      showModal({ eyebrow: '직접 입력 사양', title: '직접 입력 사양 해석', body, wide: true });
    };

    const normalizeOcrText = (text) => String(text || '').replace(/[|]/g, 'I').replace(/\s+/g, ' ').trim();

    const extractSpecsFromText = (text) => {
      const raw = normalizeOcrText(text);
      const lower = raw.toLowerCase();
      const lineText = String(text || '').split(/\n|\r/).map((line) => line.trim()).filter(Boolean);
      const findLine = (keywords) => lineText.find((line) => keywords.some((word) => line.toLowerCase().includes(word)));
      const cpuPattern = /(intel\s*)?(core\s*)?i[3579][-\s]?\d{3,5}[a-z]{0,3}|ryzen\s*[3579]\s*\d{3,5}[a-z]{0,3}|apple\s*m[1-4](\s*(pro|max|ultra))?|m[1-4](\s*(pro|max|ultra))?/i;
      const gpuPattern = /rtx\s*\d{3,4}\s*(ti|super|laptop)?|gtx\s*\d{3,4}\s*(ti)?|radeon\s*(rx)?\s*\d{3,4}\s*[a-z]{0,3}|intel\s*(iris\s*xe|uhd\s*graphics|arc\s*[a-z0-9]+)|apple\s*m[1-4]\s*(gpu)?/i;
      const ramPattern = /(\d{1,3})\s*(gb|기가)\s*(ram|memory|메모리)?/i;
      const storagePattern = /((nvme\s*)?(ssd|hdd)\s*[a-z0-9\-\s]*\d+(?:\.\d+)?\s*(tb|gb)|\d+(?:\.\d+)?\s*(tb|gb)\s*(nvme\s*)?(ssd|hdd))/i;

      let cpu = raw.match(cpuPattern)?.[0] || '';
      const cpuLine = findLine(['cpu', 'processor', '프로세서', '칩']);
      if (cpuLine && !cpu) cpu = cpuLine.replace(/^(cpu|processor|프로세서|칩)\s*[:：-]?\s*/i, '').slice(0, 80);

      let ram = raw.match(ramPattern)?.[0] || '';
      const ramLine = findLine(['ram', 'memory', '메모리']);
      if (ramLine && !ram) ram = ramLine.match(/\d{1,3}\s*(gb|기가)/i)?.[0] || '';

      let gpu = raw.match(gpuPattern)?.[0] || '';
      const gpuLine = findLine(['gpu', 'graphics', '그래픽', 'vga']);
      if (gpuLine && !gpu) gpu = gpuLine.replace(/^(gpu|graphics|그래픽|vga)\s*[:：-]?\s*/i, '').slice(0, 90);

      let storage = raw.match(storagePattern)?.[0] || '';
      const storageLine = findLine(['ssd', 'hdd', 'storage', '저장장치', '스토리지']);
      if (storageLine && !storage) storage = storageLine.replace(/^(storage|저장장치|스토리지)\s*[:：-]?\s*/i, '').slice(0, 100);

      return { cpu, ram, gpu, storage, raw, lower };
    };

    const fillIfFound = (selector, value) => {
      const input = document.querySelector(selector);
      if (input && value) input.value = value.trim();
    };

    const fieldTargets = {
      cpu: { selector: '#manual-cpu', label: 'CPU', key: 'cpu' },
      ram: { selector: '#manual-ram', label: 'RAM', key: 'ram' },
      gpu: { selector: '#manual-gpu', label: 'GPU', key: 'gpu' },
      storage: { selector: '#manual-storage', label: '저장장치', key: 'storage' },
      autoGpu: { selector: '#auto-gpu-manual', label: 'GPU', key: 'gpu' }
    };

    const extractTargetValue = (text, targetKey) => {
      const target = fieldTargets[targetKey];
      if (!target) return '';
      const specs = extractSpecsFromText(text);
      return specs[target.key] || normalizeOcrText(text).slice(0, 100);
    };

    const fillTargetValue = (targetKey, value) => {
      const target = fieldTargets[targetKey];
      if (!target || !value) return false;
      const input = document.querySelector(target.selector);
      if (!input) return false;
      input.value = String(value).trim();
      return true;
    };

    const recognizeImageText = async (file, statusElement = ocrStatus) => {
      if (!window.Tesseract?.recognize) throw new Error('OCR 모듈을 불러오지 못했습니다.');
      const result = await window.Tesseract.recognize(file, 'kor+eng', {
        logger: (message) => {
          if (!statusElement || message.status !== 'recognizing text') return;
          const pct = Math.round((message.progress || 0) * 100);
          statusElement.textContent = `텍스트 인식 중... ${pct}%`;
        }
      });
      return result?.data?.text || '';
    };

    const readPdfText = async (file) => {
      if (!window.pdfjsLib?.getDocument) throw new Error('PDF 분석 모듈을 불러오지 못했습니다.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const data = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data }).promise;
      const pageCount = Math.min(pdf.numPages, 3);
      const parts = [];
      for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const textContent = await page.getTextContent();
        parts.push(textContent.items.map((item) => item.str || '').join(' '));
      }
      const text = parts.join('\n').trim();
      if (text) return text;
      if (!window.Tesseract?.recognize) return '';
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.7 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      return blob ? recognizeImageText(blob) : '';
    };

    const processSpecText = (text, sourceLabel = '사양표') => {
      const specs = extractSpecsFromText(text);
      fillIfFound('#manual-cpu', specs.cpu);
      fillIfFound('#manual-ram', specs.ram);
      fillIfFound('#manual-gpu', specs.gpu);
      fillIfFound('#manual-storage', specs.storage);
      const found = [specs.cpu && 'CPU', specs.ram && 'RAM', specs.gpu && 'GPU', specs.storage && '저장장치'].filter(Boolean);
      if (ocrStatus) ocrStatus.textContent = found.length ? `${found.join(', ')} 후보를 입력란에 채웠습니다. 정확한지 직접 확인해 주세요.` : '자동으로 찾은 사양 후보가 없습니다. 더 선명한 이미지·PDF를 사용하거나 직접 입력해 주세요.';
      showModal({
        eyebrow: '사양표 자동 인식',
        title: `${sourceLabel} 인식 결과`,
        wide: true,
        body: `
          <div class="pc-result-summary">
            <div class="summary-callout">인식한 텍스트에서 찾은 후보를 입력란에 채웠습니다. OCR과 PDF 추출은 오인식이 있을 수 있으므로 모델명과 용량을 반드시 확인해 주세요.</div>
            <div class="result-list">
              <div class="result-row"><span>CPU 후보</span><strong>${escape(specs.cpu || '찾지 못함')}</strong></div>
              <div class="result-row"><span>RAM 후보</span><strong>${escape(specs.ram || '찾지 못함')}</strong></div>
              <div class="result-row"><span>GPU 후보</span><strong>${escape(specs.gpu || '찾지 못함')}</strong></div>
              <div class="result-row"><span>저장장치 후보</span><strong>${escape(specs.storage || '찾지 못함')}</strong></div>
            </div>
            <p class="legal-note pc-note"><strong>안내:</strong> 이미지와 PDF는 브라우저에서 텍스트 인식·추출에만 사용하며, 한눈체크 서버 DB에 저장하지 않습니다.</p>
          </div>`
      });
    };

    const runSpecFileExtract = async (file) => {
      if (!file) return;
      if (ocrStatus) ocrStatus.textContent = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf') ? 'PDF에서 사양 텍스트를 추출하는 중입니다.' : '이미지에서 텍스트를 인식하는 중입니다. 잠시만 기다려 주세요.';
      try {
        const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
        const text = isPdf ? await readPdfText(file) : await recognizeImageText(file, ocrStatus);
        processSpecText(text, isPdf ? 'PDF 사양표' : '이미지 사양표');
      } catch (error) {
        if (ocrStatus) ocrStatus.textContent = '텍스트 인식에 실패했습니다. 직접 입력해 주세요.';
        showModal({ eyebrow: '사양표 자동 인식', title: '인식 실패', body: `<p>사양표 인식 중 오류가 발생했습니다. 직접 입력하거나 더 선명한 이미지·텍스트 포함 PDF로 다시 시도해 주세요.</p><p class="legal-note pc-note">${escape(error?.message || '')}</p>` });
      }
    };

    const readClipboardForTarget = async (targetKey) => {
      const target = fieldTargets[targetKey];
      if (!target) return;
      try {
        if (navigator.clipboard?.read) {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const textType = item.types.find((type) => type === 'text/plain');
            if (textType) {
              const blob = await item.getType(textType);
              const text = await blob.text();
              const value = extractTargetValue(text, targetKey);
              if (fillTargetValue(targetKey, value)) {
                showModal({ eyebrow: '붙여넣기 인식', title: `${target.label} 값을 채웠습니다`, body: `<p>클립보드 텍스트에서 <strong>${escape(value)}</strong> 값을 추출했습니다. 정확한지 확인해 주세요.</p>` });
                return;
              }
            }
            const imageType = item.types.find((type) => type.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              const text = await recognizeImageText(blob);
              const value = extractTargetValue(text, targetKey);
              if (fillTargetValue(targetKey, value)) {
                showModal({ eyebrow: '붙여넣기 인식', title: `${target.label} 이미지 인식 결과`, body: `<p>클립보드 이미지에서 <strong>${escape(value)}</strong> 후보를 채웠습니다. OCR 결과는 반드시 확인해 주세요.</p>` });
                return;
              }
            }
          }
        }
        if (navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          const value = extractTargetValue(text, targetKey);
          if (fillTargetValue(targetKey, value)) {
            showModal({ eyebrow: '붙여넣기 인식', title: `${target.label} 값을 채웠습니다`, body: `<p>클립보드 텍스트에서 <strong>${escape(value)}</strong> 값을 추출했습니다. 정확한지 확인해 주세요.</p>` });
            return;
          }
        }
        throw new Error('클립보드에서 인식할 수 있는 텍스트나 이미지를 찾지 못했습니다.');
      } catch (error) {
        showModal({ eyebrow: '붙여넣기 인식', title: '클립보드 인식이 제한되었습니다', body: `<p>브라우저 권한이나 보안 설정 때문에 클립보드 이미지를 직접 읽지 못했습니다. 해당 입력칸을 클릭한 뒤 Ctrl+V 또는 ⌘+V로 붙여넣어 보세요.</p><p class="legal-note pc-note">${escape(error?.message || '')}</p>` });
      }
    };

    manualForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const rows = interpretManual(new FormData(manualForm));
      showManualResult(rows);
    });

    imageInput?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      runSpecFileExtract(file);
    });

    Object.entries(fieldTargets).forEach(([targetKey, config]) => {
      const input = document.querySelector(config.selector);
      input?.addEventListener('paste', async (event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (!imageItem) return;
        event.preventDefault();
        try {
          const file = imageItem.getAsFile();
          const text = await recognizeImageText(file);
          const value = extractTargetValue(text, targetKey);
          if (fillTargetValue(targetKey, value)) {
            showModal({ eyebrow: '붙여넣기 인식', title: `${config.label} 이미지 인식 결과`, body: `<p>붙여넣은 이미지에서 <strong>${escape(value)}</strong> 후보를 채웠습니다. 정확한지 확인해 주세요.</p>` });
          }
        } catch (error) {
          showModal({ eyebrow: '붙여넣기 인식', title: '이미지 인식 실패', body: `<p>붙여넣은 이미지에서 텍스트를 인식하지 못했습니다. 더 선명한 캡처를 사용하거나 직접 입력해 주세요.</p><p class="legal-note pc-note">${escape(error?.message || '')}</p>` });
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const pasteButton = event.target.closest('[data-ocr-target]');
      if (pasteButton) {
        readClipboardForTarget(pasteButton.dataset.ocrTarget);
        return;
      }
      const helpButton = event.target.closest('[data-help-topic]');
      if (!helpButton) return;
      const topic = helpContents[helpButton.dataset.helpTopic];
      if (!topic) return;
      showModal({ eyebrow: '확인 위치', title: topic.title, body: topic.body });
    });

    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    refreshButton?.addEventListener('click', renderAutoSpecs);
    autoSpecInterpretButton?.addEventListener('click', interpretAutoSpecs);
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
