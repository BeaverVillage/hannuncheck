# 한눈체크

한눈체크는 생활 속에서 확인이 필요한 정보를 한 화면에서 정리해 보여주는 정적 사이트 + Cloudflare Pages Functions 프로젝트입니다.

## 주요 기능

- 전기차 충전소 지도
- 주차비 확인 지도
- 외출 위험 종합 체크
- 응급실·야간 병원·약국 확인
- 장보기 물가 확인
- 사업자등록 상태 조회
- 사업자 진위확인
- 통신판매업 신고 조회
- 쇼핑몰 정보 비교
- 거래 전 체크리스트
- 컴퓨터 사양 확인

## v95-emergency-map-card-performance-fix

이번 버전은 운영 UI 최종 점검본입니다. 메인, sitemap, 데이터 출처, 환경변수 예시, 응급실 지도형 UI, 외출 위험 오류 문구, 의료기관 카카오맵 로컬 캐시 연결 상태를 다시 확인했습니다.

적용 내용:

- 홈페이지 자주 쓰는 기능 5개 유지 확인
- 공개 메뉴와 sitemap에서 운영 제외 기능 노출 없음 확인
- 응급실·야간 병원·약국 페이지의 지도, 목록, 선택 상세 카드 흐름 최종 점검
- 의료기관 카카오맵 버튼이 로컬 캐시를 우선 확인하고, 없으면 카카오맵 검색으로 fallback되도록 유지
- 기상특보 보조 조회 실패가 외출 위험 핵심 결과를 가리지 않도록 문구 유지
- 데이터 출처와 환경변수 예시를 현재 운영 기능 기준으로 정리
- `.env`, `.env.local`이 배포 ZIP에 포함되지 않도록 확인

## 환경변수 예시

실제 키는 이 파일에 넣지 말고 Cloudflare Pages Production 환경변수에 등록합니다.

```env
DATA_GO_KR_SERVICE_KEY=
PUBLIC_DATA_SERVICE_KEY=
PUBLIC_DATA_API_KEY=

KAKAO_MAP_JS_KEY=
KAKAO_JS_KEY=
KAKAO_REST_API_KEY=

SEOUL_OPEN_API_KEY=
HOLIDAY_API_KEY=

KAMIS_API_KEY=
KAMIS_CERT_ID=
PRICE_GO_KR_API_KEY=

AIRKOREA_API_KEY=
KMA_FORECAST_API_KEY=
KMA_LIVING_INDEX_API_KEY=

NMC_EMERGENCY_API_KEY=
NMC_HOSPITAL_API_KEY=
NMC_PHARMACY_API_KEY=
HIRA_API_KEY=
```

## 배포 확인

배포 후 `/api/config`의 `serverVersion`이 `v95-emergency-map-card-performance-fix`로 보이면 이번 최종 점검본이 반영된 것입니다.

## 의료기관 카카오맵 캐시 생성

로컬에서만 실행합니다. `.env.local`은 배포 ZIP이나 GitHub에 포함하지 않습니다.

```powershell
cd "프로젝트_폴더"
notepad .env.local
# KAKAO_REST_API_KEY=카카오_REST_API_KEY
# NMC_EMERGENCY_API_KEY=응급의료기관_KEY
# NMC_HOSPITAL_API_KEY=병의원_KEY
# NMC_PHARMACY_API_KEY=약국_KEY

node scripts/enrich-medical-kakao-places.js --mode=emergency --region=대전 --limit=100
node scripts/enrich-medical-kakao-places.js --mode=hospital --region=대전 --district=서구 --limit=100
node scripts/enrich-medical-kakao-places.js --mode=pharmacy --region=대전 --district=서구 --limit=100
node scripts/enrich-medical-kakao-places.js --mode=all --region=대전 --limit=300
del .env.local
```

## v95-emergency-map-card-performance-fix

- 응급실·야간 병원·약국 확인 페이지를 전기차 충전소 지도 계열의 상단 조건 카드 + 지도 중심 + 결과 목록 구조로 다시 정리했습니다.
- 왼쪽에 고립되어 보이던 조회 전/선택 카드 구조를 제거하고, 선택 상세 카드는 실제 항목 선택 후에만 결과 흐름 아래 표시되도록 변경했습니다.
- 모바일에서는 조건 카드, 지도, 결과 목록, 선택 상세 카드가 단일 컬럼으로 내려가도록 CSS를 보강했습니다.
- 의료기관 카카오맵 로컬 캐시 구조는 유지하며, 캐시가 없거나 신뢰도가 낮으면 카카오맵 검색으로 fallback됩니다.
