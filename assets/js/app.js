(() => {
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
    submitButton.textContent = isLoading ? '확인 중입니다...' : '사업자 정보 확인하기';
    resultPanel.hidden = false;
    if (isLoading) {
      resultUpdated.textContent = '조회 중';
      resultUpdated.className = 'status-pill neutral';
      setMessage('공식 API 조회를 진행하고 있습니다. 잠시만 기다려 주세요.');
      statusStack.innerHTML = statusCard({
        icon: 'i',
        tone: 'neutral',
        title: '조회 중입니다',
        description: '사업자등록 상태와 통신판매업 정보를 확인하고 있습니다.',
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
    setMessage(messages[0] || '조회가 완료되었습니다. 아래 항목을 쇼핑몰 하단 정보와 함께 비교해 주세요.');

    const statusTone = status.tone || 'neutral';
    const statusIcon = statusTone === 'success' ? '✓' : statusTone === 'warning' ? '!' : statusTone === 'danger' ? '!' : 'i';
    const ftcTone = mailOrder.found ? 'success' : (mailOrder.error ? 'warning' : 'neutral');
    const ftcIcon = mailOrder.found ? '✓' : 'i';
    const validateTone = validate.checked ? (validate.valid ? 'success' : 'warning') : 'neutral';

    statusStack.innerHTML = [
      statusCard({
        icon: statusIcon,
        tone: statusTone,
        title: '사업자등록 상태',
        description: status.summary || '조회 결과가 없습니다.',
        pill: status.label || '확인 필요'
      }),
      statusCard({
        icon: validateTone === 'success' ? '✓' : 'i',
        tone: validateTone,
        title: '사업자 진위확인',
        description: validate.summary || '개업일자와 대표자명을 입력하면 진위확인을 함께 시도합니다.',
        pill: validate.checked ? (validate.valid ? '일치' : '확인 필요') : '선택'
      }),
      statusCard({
        icon: ftcIcon,
        tone: ftcTone,
        title: '통신판매업 정보',
        description: mailOrder.summary || '통신판매업 등록상세 조회 결과가 없습니다.',
        pill: mailOrder.found ? '확인됨' : (mailOrder.error ? '확인 필요' : '정보 없음')
      })
    ].join('');

    if (comparisons.length) {
      comparisonBox.hidden = false;
      comparisonList.innerHTML = comparisons.map(comparisonRow).join('');
    } else {
      comparisonBox.hidden = true;
      comparisonList.innerHTML = '';
    }

    if (checklist.length) {
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
        description: 'API 키 설정, 공공데이터포털 활용신청 상태, 네트워크 상태를 확인해 주세요.',
        pill: '확인 필요'
      });
      comparisonBox.hidden = true;
      checklistBox.hidden = true;
    } finally {
      setLoading(false);
    }
  });
})();
