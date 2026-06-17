// 한눈체크 디자인 시안용 스크립트입니다.
// 실제 사업자등록정보/통신판매업 API 연동은 다음 구현 단계에서 추가하세요.

(() => {
  const previewButton = document.querySelector('.disabled-submit');
  if (!previewButton) return;

  previewButton.setAttribute('aria-disabled', 'true');
})();
