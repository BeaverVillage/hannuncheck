(() => {
  'use strict';

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  ready(() => {
    if (!document.querySelector('#nutrition-tool')) return;

    const $ = (selector) => document.querySelector(selector);
    const imageInput = $('#nutrition-image-input');
    const ocrButton = $('#nutrition-ocr-run');
    const pasteZone = $('#nutrition-paste-zone');
    const status = $('#nutrition-ocr-status');
    const nutritionForm = $('#nutrition-form');
    const resultPanel = $('#nutrition-result-panel');
    const modal = $('#nutrition-modal');
    const modalTitle = $('#nutrition-modal-title');
    const modalEyebrow = $('#nutrition-modal-eyebrow');
    const modalBody = $('#nutrition-modal-body');
    const modalClose = $('#nutrition-modal-close');

    let selectedFile = null;
    let isProcessing = false;

    const fields = {
      product: $('#nutrition-product'),
      serving: $('#nutrition-serving'),
      calories: $('#nutrient-calories'),
      sodium: $('#nutrient-sodium'),
      carbs: $('#nutrient-carbs'),
      sugar: $('#nutrient-sugar'),
      fat: $('#nutrient-fat'),
      satFat: $('#nutrient-satfat'),
      protein: $('#nutrient-protein'),
      purpose: $('#nutrition-purpose')
    };

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const setStatus = (message) => {
      if (status) status.textContent = message;
    };

    const setButtonBusy = (busy, label) => {
      if (!ocrButton) return;
      ocrButton.disabled = !!busy;
      ocrButton.textContent = busy ? (label || '인식 중입니다...') : '영양성분표 인식·해석하기';
    };

    const showModal = ({ eyebrow = '확인 결과', title = '영양성분표 해석', body = '' }) => {
      if (!modal || !modalTitle || !modalBody) return;
      if (modalEyebrow) modalEyebrow.textContent = eyebrow;
      modalTitle.textContent = title;
      modalBody.innerHTML = body;
      modal.hidden = false;
      document.body.classList.add('modal-open');
      modalClose?.focus({ preventScroll: true });
    };

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
      if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    const toNumber = (value) => {
      if (value == null || value === '') return null;
      const normalized = String(value)
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/[Ooㅇ○]/g, '0')
        .replace(/[Il|]/g, '1')
        .replace(/,/g, '.')
        .match(/[0-9]+(?:\.[0-9]+)?/);
      if (!normalized) return null;
      const number = Number(normalized[0]);
      return Number.isFinite(number) ? number : null;
    };

    const fmt = (value, unit) => value == null || value === '' ? '확인 필요' : `${value}${unit}`;

    const readFormItem = () => ({
      product: fields.product?.value?.trim() || '입력 제품',
      serving: fields.serving?.value?.trim() || '기준량 확인 필요',
      calories: toNumber(fields.calories?.value),
      sodium: toNumber(fields.sodium?.value),
      carbs: toNumber(fields.carbs?.value),
      sugar: toNumber(fields.sugar?.value),
      fat: toNumber(fields.fat?.value),
      satFat: toNumber(fields.satFat?.value),
      protein: toNumber(fields.protein?.value),
      purpose: fields.purpose?.value || 'general'
    });

    const purposeLabel = (purpose) => ({
      general: '일반 간식',
      diet: '다이어트 중 참고',
      protein: '운동 후 단백질 확인',
      sugar: '당류 줄이기',
      sodium: '나트륨 확인',
      kids: '아이 간식 확인'
    }[purpose] || '일반 확인');

    const interpretNutrition = (item) => {
      const rows = [];
      const comments = [];

      if (item.calories != null) {
        const text = item.calories >= 500 ? '한 번에 먹는 양 기준으로는 열량이 높은 편일 수 있습니다. 식사 대용인지 간식인지 먼저 구분해 보세요.'
          : item.calories >= 250 ? '간식 기준으로는 열량을 눈여겨볼 수 있습니다. 다른 음료나 디저트와 함께 먹으면 총열량이 늘어납니다.'
          : '열량은 비교적 낮은 편으로 볼 수 있지만, 기준량이 100g인지 1회 제공량인지 확인해야 합니다.';
        rows.push(['열량', fmt(item.calories, 'kcal'), text]);
        comments.push(text);
      }

      if (item.sodium != null) {
        const text = item.sodium >= 1000 ? '나트륨이 높은 편으로 볼 수 있습니다. 국물, 소스, 가공식품과 함께 먹는 경우 총 나트륨 섭취가 더 늘 수 있습니다.'
          : item.sodium >= 600 ? '나트륨을 확인해 볼 만한 수치입니다. 같은 날 라면, 찌개, 소스류와 함께 먹는다면 총량을 의식하는 것이 좋습니다.'
          : '나트륨은 아주 높은 편으로 보기는 어렵지만, 기준량과 함께 먹는 음식을 함께 봐야 합니다.';
        rows.push(['나트륨', fmt(item.sodium, 'mg'), text]);
        comments.push(text);
      }

      if (item.sugar != null) {
        const text = item.sugar >= 25 ? '당류가 높은 편으로 볼 수 있습니다. 음료, 과자, 디저트와 함께 먹으면 하루 당류 섭취가 빠르게 늘 수 있습니다.'
          : item.sugar >= 12 ? '당류를 눈여겨볼 수 있습니다. 단맛이 있는 간식이라면 섭취 횟수와 양을 함께 확인하세요.'
          : '당류는 비교적 낮은 편으로 볼 수 있습니다. 다만 제품군과 기준량에 따라 해석이 달라집니다.';
        rows.push(['당류', fmt(item.sugar, 'g'), text]);
        comments.push(text);
      }

      if (item.carbs != null) {
        const text = item.carbs >= 60 ? '탄수화물 비중이 높은 편입니다. 식사 대용인지 간식인지에 따라 체감이 다를 수 있습니다.'
          : item.carbs >= 30 ? '탄수화물이 어느 정도 있는 제품입니다. 당류 수치와 함께 보는 것이 좋습니다.'
          : '탄수화물은 비교적 낮은 편으로 보입니다.';
        rows.push(['탄수화물', fmt(item.carbs, 'g'), text]);
      }

      if (item.fat != null) {
        const text = item.fat >= 20 ? '지방 함량이 높은 편일 수 있습니다. 과자류, 초콜릿류, 튀김류라면 포화지방도 함께 확인하세요.'
          : item.fat >= 10 ? '지방을 확인해 볼 만한 수치입니다. 포화지방과 함께 보는 것이 좋습니다.'
          : '지방은 아주 높은 편으로 보기는 어렵습니다.';
        rows.push(['지방', fmt(item.fat, 'g'), text]);
      }

      if (item.satFat != null) {
        const text = item.satFat >= 8 ? '포화지방을 눈여겨볼 수 있습니다. 초콜릿, 크림, 버터류 제품이라면 섭취량을 함께 확인하세요.'
          : item.satFat >= 4 ? '포화지방이 어느 정도 있는 편입니다. 지방 수치와 함께 봐야 합니다.'
          : '포화지방은 낮거나 보통 수준으로 볼 수 있습니다.';
        rows.push(['포화지방', fmt(item.satFat, 'g'), text]);
      }

      if (item.protein != null) {
        const text = item.protein >= 20 ? '단백질 보충 목적에서도 의미 있게 볼 수 있는 수치입니다.'
          : item.protein >= 10 ? '단백질이 어느 정도 있는 편입니다. 운동 후 확인 목적이라면 제품군과 열량도 함께 보세요.'
          : '단백질 보충 목적의 제품으로 보기에는 낮은 편일 수 있습니다.';
        rows.push(['단백질', fmt(item.protein, 'g'), text]);
        comments.push(text);
      }

      let headline = '입력한 영양성분표 기준으로 참고 해석을 정리했습니다.';
      if (item.purpose === 'sugar' && item.sugar != null) headline = item.sugar >= 12 ? '당류를 줄이려는 목적이라면 이 제품은 당류 수치를 먼저 확인해야 합니다.' : '당류를 줄이려는 목적에서는 비교적 부담이 낮아 보일 수 있습니다.';
      if (item.purpose === 'sodium' && item.sodium != null) headline = item.sodium >= 600 ? '나트륨 확인 목적이라면 함께 먹는 음식까지 고려해야 합니다.' : '나트륨만 보면 크게 높은 편으로 보기는 어렵지만 기준량을 확인해야 합니다.';
      if (item.purpose === 'protein' && item.protein != null) headline = item.protein >= 10 ? '운동 후 단백질 확인 목적에서 참고할 만한 단백질 수치가 있습니다.' : '운동 후 단백질 보충 목적이라면 단백질 수치가 다소 낮게 느껴질 수 있습니다.';
      if (item.purpose === 'diet') headline = '다이어트 참고 목적이라면 열량만 보지 말고 당류, 지방, 단백질, 기준량을 함께 봐야 합니다.';
      if (item.purpose === 'kids') headline = '아이 간식으로 볼 때는 당류, 나트륨, 알레르기 표시를 함께 확인하는 것이 좋습니다.';

      return { headline, rows };
    };

    const buildResultHtml = (item) => {
      const interpreted = interpretNutrition(item);
      const rowHtml = interpreted.rows.length ? interpreted.rows.map(([label, value, text]) => `
        <div class="nutrition-result-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(text)}</p>
        </div>`).join('') : '<p>해석할 영양성분 숫자를 입력하거나 사진에서 추출해 주세요.</p>';
      return `
        <div class="pc-result-summary nutrition-summary">
          <div class="summary-callout"><strong>${escapeHtml(item.product)}</strong> · ${escapeHtml(item.serving)} · ${escapeHtml(purposeLabel(item.purpose))}<br>${escapeHtml(interpreted.headline)}</div>
          <div class="nutrition-result-list">${rowHtml}</div>
          <p class="legal-note pc-note"><strong>안내:</strong> 이 결과는 영양성분표 숫자의 참고 해석입니다. 섭취 가능 여부, 질환 관리, 알레르기 안전성, 다이어트 효과를 판정하지 않습니다. 실제 표시사항은 제품 포장지를 우선 확인하세요.</p>
        </div>`;
    };

    const fillFields = (values) => {
      Object.entries(values).forEach(([key, value]) => {
        if (fields[key] && value != null && value !== '') fields[key].value = value;
      });
    };

    const updateResultPanel = (html) => {
      if (!resultPanel) return;
      resultPanel.innerHTML = html;
      resultPanel.hidden = false;
    };

    const showFormResult = () => {
      const item = readFormItem();
      const body = buildResultHtml(item);
      updateResultPanel(body);
      showModal({ eyebrow: '영양성분표 해석', title: `${item.product} 해석 결과`, body });
    };

    const normalizeText = (text) => String(text || '')
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/[㎎]/g, 'mg')
      .replace(/[㎉]/g, 'kcal')
      .replace(/[，]/g, ',')
      .replace(/[．]/g, '.')
      .replace(/[|｜]/g, ' ')
      .replace(/나트[륨름룹룬륨]/g, '나트륨')
      .replace(/탄수화물?|탄수화믈/g, '탄수화물')
      .replace(/당[규류유]/g, '당류')
      .replace(/단백[질짙]/g, '단백질')
      .replace(/포화\s*지방/g, '포화지방')
      .replace(/트랜스\s*지방/g, '트랜스지방')
      .replace(/콜레스테[롤를]/g, '콜레스테롤')
      .replace(/([0-9])\s*[Ooㅇ○]\s*([0-9])/g, '$10$2')
      .replace(/([0-9])\s*[Il|]\s*([0-9])/g, '$11$2')
      .replace(/\s+/g, ' ')
      .trim();

    const labelAliases = {
      calories: ['열량', '칼로리', 'kcal', '에너지'],
      sodium: ['나트륨', '나트름', 'sodium'],
      carbs: ['탄수화물', '탄수화', 'carbohydrate', 'carb'],
      sugar: ['당류', '당유', 'sugar', 'sugars'],
      fat: ['지방', '총지방', 'fat'],
      satFat: ['포화지방', 'saturated'],
      protein: ['단백질', 'protein']
    };

    const validRange = {
      calories: [0, 1500], sodium: [0, 5000], carbs: [0, 300], sugar: [0, 200], fat: [0, 200], satFat: [0, 100], protein: [0, 200]
    };

    const addCandidate = (bucket, key, value, score = 1) => {
      const number = toNumber(value);
      if (number == null) return;
      const [min, max] = validRange[key] || [0, 9999];
      if (number < min || number > max) return;
      bucket[key] ||= [];
      bucket[key].push({ value: number, score });
    };

    const bestCandidate = (items = []) => {
      if (!items.length) return null;
      const grouped = new Map();
      for (const item of items) {
        const k = String(item.value);
        grouped.set(k, (grouped.get(k) || 0) + item.score);
      }
      return Number(Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])[0][0]);
    };

    const scanLineForCandidates = (line, bucket) => {
      const normalized = normalizeText(line);
      const compact = normalized.replace(/\s+/g, '').toLowerCase();
      const nums = Array.from(normalized.matchAll(/([0-9Ooㅇ○Il|]+(?:[.,][0-9Ooㅇ○Il|]+)?)\s*(kcal|mg|g|그램|밀리그램|칼로리)?/gi));
      if (!nums.length) return;
      Object.entries(labelAliases).forEach(([key, aliases]) => {
        const hasAlias = aliases.some((alias) => compact.includes(alias.replace(/\s+/g, '').toLowerCase()));
        if (!hasAlias) return;
        if (key === 'fat' && (compact.includes('포화지방') || compact.includes('트랜스지방'))) return;
        const preferredUnit = key === 'calories' ? /kcal|칼로리/i : key === 'sodium' ? /mg|밀리그램/i : /g|그램/i;
        for (const match of nums) {
          const unit = match[2] || '';
          const score = preferredUnit.test(unit) ? 3 : 1.4;
          addCandidate(bucket, key, match[1], score);
          if (preferredUnit.test(unit)) break;
        }
      });
    };

    const extractNutrition = (text) => {
      const raw = String(text || '');
      const normalized = normalizeText(raw);
      const bucket = {};
      const lines = raw.split(/\n|\r|(?=나트륨|탄수화물|당류|지방|포화지방|단백질|열량|칼로리)/).map((line) => line.trim()).filter(Boolean);
      const synthetic = normalized.split(/(?=나트륨|탄수화물|당류|지방|포화지방|단백질|열량|칼로리)/g).map((line) => line.trim()).filter(Boolean);
      [...lines, ...synthetic].forEach((line) => scanLineForCandidates(line, bucket));

      // Direct nearby pattern search across compact text
      const compact = normalized.replace(/\s+/g, '');
      Object.entries(labelAliases).forEach(([key, aliases]) => {
        const unit = key === 'calories' ? '(?:kcal|칼로리)?' : key === 'sodium' ? '(?:mg|밀리그램)?' : '(?:g|그램)?';
        aliases.forEach((alias) => {
          const rx = new RegExp(alias.replace(/\s+/g, '') + '[^0-9Ooㅇ○Il|]{0,18}([0-9Ooㅇ○Il|]+(?:[.,][0-9Ooㅇ○Il|]+)?)\\s*' + unit, 'i');
          const m = compact.match(rx);
          if (m) addCandidate(bucket, key, m[1], 2);
        });
      });

      // Fallback sequence around nutrition table. Useful when labels are partially broken.
      const tableText = compact.match(/(?:영양정보|영양성분)(.{0,260})/i)?.[1] || compact;
      const seq = Array.from(tableText.matchAll(/([0-9]+(?:[.,][0-9]+)?)(kcal|mg|g)?/gi)).map((m) => ({ value: toNumber(m[1]), unit: m[2] || '' })).filter((n) => n.value != null);
      if ((bucket.calories || []).length + (bucket.sodium || []).length + (bucket.sugar || []).length < 3 && seq.length >= 5) {
        const kcal = seq.find((n) => /kcal/i.test(n.unit) || (n.value >= 30 && n.value <= 900));
        if (kcal) addCandidate(bucket, 'calories', kcal.value, 0.9);
        const sodium = seq.find((n) => /mg/i.test(n.unit) || (n.value >= 10 && n.value <= 2500));
        if (sodium) addCandidate(bucket, 'sodium', sodium.value, 0.8);
        const grams = seq.filter((n) => !/kcal|mg/i.test(n.unit) && n.value >= 0 && n.value <= 200);
        if (grams.length >= 4) {
          addCandidate(bucket, 'carbs', grams[0].value, 0.5);
          addCandidate(bucket, 'sugar', grams[1].value, 0.5);
          addCandidate(bucket, 'fat', grams[2].value, 0.5);
          addCandidate(bucket, 'satFat', grams[4]?.value, 0.4);
          addCandidate(bucket, 'protein', grams[grams.length - 1].value, 0.5);
        }
      }

      const productLine = raw.split(/\n|\r/).find((line) => /제품명|상품명|식품명/i.test(line));
      const serving = normalized.match(/(?:총\s*내용량|내용량|1회\s*제공량|100\s*g)[^\n]{0,50}/i)?.[0] || '';
      const result = {
        product: productLine ? productLine.replace(/^(제품명|상품명|식품명)\s*[:：-]?\s*/i, '').slice(0, 80) : '',
        serving: serving.slice(0, 80)
      };
      ['calories', 'sodium', 'carbs', 'sugar', 'fat', 'satFat', 'protein'].forEach((key) => {
        result[key] = bestCandidate(bucket[key]);
      });
      result._candidateBucket = bucket;
      return result;
    };

    const fileToBitmap = async (file) => {
      if (file instanceof Blob) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
      return createImageBitmap(file);
    };

    const makeCanvasVariant = async (file, opts = {}) => {
      const bitmap = await fileToBitmap(file);
      const crop = opts.crop || { x: 0, y: 0, w: 1, h: 1 };
      const sx = Math.max(0, Math.floor(bitmap.width * crop.x));
      const sy = Math.max(0, Math.floor(bitmap.height * crop.y));
      const sw = Math.max(1, Math.floor(bitmap.width * crop.w));
      const sh = Math.max(1, Math.floor(bitmap.height * crop.h));
      const maxSide = opts.maxSide || 2600;
      const scale = Math.min(3.2, Math.max(1.2, maxSide / Math.max(sw, sh)));
      const width = Math.max(1, Math.round(sw * scale));
      const height = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);

      const image = ctx.getImageData(0, 0, width, height);
      const data = image.data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const mean = sum / (data.length / 4);
      const threshold = opts.threshold || mean;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        let v = gray;
        if (opts.mode === 'contrast') v = Math.max(0, Math.min(255, (gray - 118) * 1.95 + 138));
        if (opts.mode === 'threshold') v = gray > threshold ? 255 : 0;
        if (opts.mode === 'soft-threshold') v = gray > threshold - 18 ? 255 : 0;
        if (opts.mode === 'invert') v = 255 - gray;
        if (opts.mode === 'blue-package') v = Math.max(0, Math.min(255, (gray - 95) * 2.25 + 150));
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    };

    const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

    const recognizeSource = async (source, label) => {
      if (!window.Tesseract?.recognize) throw new Error('OCR 모듈을 불러오지 못했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.');
      const result = await window.Tesseract.recognize(source, 'kor+eng', {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        logger: (message) => {
          if (message.status === 'recognizing text') {
            setStatus(`${label} 인식 중... ${Math.round((message.progress || 0) * 100)}%`);
          }
        }
      });
      return result?.data?.text || '';
    };

    const recognizeImage = async (file) => {
      const variants = [
        { label: '원본 사진', source: file },
        { label: '전체 보정', canvas: { mode: 'contrast' } },
        { label: '전체 고대비', canvas: { mode: 'soft-threshold' } },
        { label: '왼쪽 영역', canvas: { mode: 'contrast', crop: { x: 0, y: 0.05, w: 0.55, h: 0.9 } } },
        { label: '하단 영역', canvas: { mode: 'contrast', crop: { x: 0.02, y: 0.55, w: 0.96, h: 0.43 } } },
        { label: '좌하단 영역', canvas: { mode: 'contrast', crop: { x: 0, y: 0.45, w: 0.55, h: 0.5 } } },
        { label: '중앙 하단', canvas: { mode: 'soft-threshold', crop: { x: 0.15, y: 0.55, w: 0.7, h: 0.42 } } },
        { label: '반전 후보', canvas: { mode: 'invert', crop: { x: 0, y: 0, w: 1, h: 1 } } }
      ];
      const texts = [];
      for (const variant of variants) {
        try {
          let source = variant.source;
          if (!source && variant.canvas) {
            const canvas = await makeCanvasVariant(file, variant.canvas);
            source = await canvasToBlob(canvas);
          }
          if (!source) continue;
          const text = await recognizeSource(source, variant.label);
          if (text) texts.push(`\n--- ${variant.label} ---\n${text}`);
          const extracted = extractNutrition(texts.join('\n'));
          const found = ['calories', 'sodium', 'carbs', 'sugar', 'fat', 'satFat', 'protein'].filter((k) => extracted[k] != null).length;
          if (found >= 5) break;
        } catch (error) {
          // Keep trying other variants.
          console.warn('[nutrition OCR]', variant.label, error);
        }
      }
      return texts.join('\n').trim();
    };

    const readPdfText = async (file) => {
      if (!window.pdfjsLib?.getDocument) throw new Error('PDF 분석 모듈을 불러오지 못했습니다.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const data = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data }).promise;
      const parts = [];
      for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 2); pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const textContent = await page.getTextContent();
        parts.push(textContent.items.map((item) => item.str || '').join(' '));
      }
      const text = parts.join('\n').trim();
      if (text.length > 20) return text;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await canvasToBlob(canvas);
      return blob ? recognizeImage(blob) : '';
    };

    const candidateInput = (key, label, unit, value) => `
      <label class="candidate-field"><span>${escapeHtml(label)}</span><input data-candidate="${key}" type="number" step="0.1" min="0" value="${value ?? ''}" placeholder="확인 필요"><em>${escapeHtml(unit)}</em></label>`;

    const buildCandidateModal = (values, rawText) => {
      const found = ['calories', 'sodium', 'carbs', 'sugar', 'fat', 'satFat', 'protein'].filter((key) => values[key] != null).length;
      const raw = rawText ? `<details class="faq-accordion-item nutrition-raw-text"><summary>OCR 원문 일부 보기</summary><div class="faq-answer"><p>${escapeHtml(rawText.slice(0, 900))}</p></div></details>` : '';
      return `
        <div class="pc-result-summary nutrition-summary">
          <div class="summary-callout">사진에서 <strong>${found}개</strong> 영양성분 후보를 찾았습니다. 실제 포장지 숫자와 비교해 수정한 뒤 아래 버튼을 눌러 해석하세요.</div>
          <div class="candidate-grid">
            <label class="candidate-field wide"><span>제품명</span><input data-candidate="product" type="text" value="${escapeHtml(values.product || '')}" placeholder="예: 초코파이, 컵라면"></label>
            <label class="candidate-field wide"><span>기준량</span><input data-candidate="serving" type="text" value="${escapeHtml(values.serving || '')}" placeholder="예: 1봉지, 100g"></label>
            ${candidateInput('calories', '열량', 'kcal', values.calories)}
            ${candidateInput('sodium', '나트륨', 'mg', values.sodium)}
            ${candidateInput('carbs', '탄수화물', 'g', values.carbs)}
            ${candidateInput('sugar', '당류', 'g', values.sugar)}
            ${candidateInput('fat', '지방', 'g', values.fat)}
            ${candidateInput('satFat', '포화지방', 'g', values.satFat)}
            ${candidateInput('protein', '단백질', 'g', values.protein)}
          </div>
          <button class="submit-button" type="button" id="nutrition-confirm-candidates">이 값으로 해석하기</button>
          ${raw}
          <p class="legal-note pc-note"><strong>안내:</strong> 실제 포장지 사진은 곡면, 반사, 작은 글씨 때문에 OCR이 틀릴 수 있습니다. 자동값은 후보일 뿐이며 숫자 확인 후 사용해야 합니다.</p>
        </div>`;
    };

    const attachCandidateConfirm = () => {
      $('#nutrition-confirm-candidates')?.addEventListener('click', () => {
        const values = {};
        modalBody?.querySelectorAll('[data-candidate]').forEach((input) => {
          const key = input.getAttribute('data-candidate');
          values[key] = input.type === 'number' ? toNumber(input.value) : input.value.trim();
        });
        fillFields(values);
        const item = readFormItem();
        const body = buildResultHtml(item);
        updateResultPanel(body);
        showModal({ eyebrow: '영양성분표 해석', title: `${item.product} 해석 결과`, body });
      }, { once: true });
    };

    const processFile = async (file, label = '선택한 이미지') => {
      if (!file) {
        showModal({ eyebrow: '영양성분표 인식', title: '파일을 먼저 선택하세요', body: '<p>영양성분표가 보이는 사진이나 PDF를 선택하거나 붙여넣어 주세요.</p>' });
        return;
      }
      if (isProcessing) return;
      isProcessing = true;
      setButtonBusy(true, '영양성분표 인식 중...');
      showModal({ eyebrow: '영양성분표 인식', title: '인식 중입니다', body: '<p>사진을 보정하고 여러 방식으로 텍스트를 읽는 중입니다. 실제 포장지 사진은 20초 이상 걸릴 수 있습니다.</p>' });
      try {
        setStatus(`${label} 분석을 시작합니다.`);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        const text = isPdf ? await readPdfText(file) : await recognizeImage(file);
        const values = extractNutrition(text);
        fillFields(values);
        const candidateHtml = buildCandidateModal(values, text);
        updateResultPanel(candidateHtml);
        showModal({ eyebrow: 'OCR 후보 확인', title: '영양성분표 후보값을 확인하세요', body: candidateHtml });
        attachCandidateConfirm();
        const found = ['calories', 'sodium', 'carbs', 'sugar', 'fat', 'satFat', 'protein'].filter((key) => values[key] != null).length;
        setStatus(found ? `인식 완료: 후보값 ${found}개를 찾았습니다. 팝업에서 숫자를 확인해 주세요.` : '인식 완료: 자동 후보가 적습니다. OCR 원문을 보고 직접 입력해 주세요.');
      } catch (error) {
        showModal({ eyebrow: 'OCR 인식 실패', title: '사진 인식에 실패했습니다', body: `<p>사진 인식 중 오류가 발생했습니다. 더 밝고 평평하게 찍은 사진을 사용하거나 직접 입력해 주세요.</p><p class="legal-note pc-note">${escapeHtml(error?.message || '')}</p>` });
        setStatus('OCR 인식에 실패했습니다. 직접 입력 또는 더 선명한 사진을 사용해 주세요.');
      } finally {
        isProcessing = false;
        setButtonBusy(false);
      }
    };

    const selectFile = (file, label = '선택한 파일') => {
      if (!file) return;
      selectedFile = file;
      setStatus(`${label}: ${file.name || '붙여넣은 이미지'} 준비 완료. PC에서는 인식·해석 버튼을 눌러 주세요.`);
      if (ocrButton) ocrButton.disabled = false;
    };

    imageInput?.addEventListener('change', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const file = event.target.files?.[0];
      if (!file) return;
      selectFile(file, '파일 선택');
      const isSmall = window.matchMedia?.('(max-width: 720px)').matches;
      if (isSmall) processFile(file, '모바일 선택 이미지');
    }, true);

    ocrButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      processFile(selectedFile, selectedFile?.name || '선택한 파일');
    }, true);

    const handlePaste = (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const file = imageItem.getAsFile();
      if (!file) return;
      selectFile(file, '붙여넣은 이미지');
      pasteZone?.classList.add('is-ready');
      const isSmall = window.matchMedia?.('(max-width: 720px)').matches;
      if (isSmall) processFile(file, '붙여넣은 이미지');
    };

    pasteZone?.addEventListener('click', () => pasteZone.focus());
    pasteZone?.addEventListener('paste', handlePaste, true);
    document.addEventListener('paste', (event) => {
      if (!document.querySelector('#nutrition-tool')) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      handlePaste(event);
    }, true);

    nutritionForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFormResult();
    }, true);

    // Explicit click fallback for browsers that do not dispatch submit reliably after layout changes.
    nutritionForm?.querySelector('button[type="submit"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFormResult();
    }, true);
  });
})();
