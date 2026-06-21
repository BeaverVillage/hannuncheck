# 한눈체크

전기차 충전소, 주차비, 최저가 주유소, 외출 위험, 응급실·야간 병원·약국, 장보기 물가, 사업자 정보 등 생활 속 확인 정보를 정리하는 정적 사이트 + Cloudflare Pages Functions 프로젝트입니다.

## 구성

- 홈: `index.html`
  - 한눈계산과 유사한 카드형 주요 기능 선택 UI
  - 우측 사업자 정보 미리보기 화면 제거
- 기능 페이지
  - `tools/business-status.html`: 사업자등록 상태 조회
  - `tools/business-validate.html`: 사업자 진위확인
  - `tools/mail-order.html`: 통신판매업 신고 조회
  - `tools/store-compare.html`: 쇼핑몰 하단 정보 비교
  - `tools/pre-payment-checklist.html`: 거래 전 체크리스트
- 기본 페이지: `about.html`, `privacy.html`, `disclaimer.html`, `data-sources.html`, `contact.html`, `404.html`
- 스타일: `assets/css/base.css`, `assets/css/layout.css`, `assets/css/components.css`
- 프론트 기능: `assets/js/app.js`
- API 라우트: `functions/api/check.js`

## 배포 설정

Cloudflare Pages에서 GitHub 저장소를 연결한 뒤 아래처럼 설정합니다.

| 항목 | 값 |
| --- | --- |
| Framework preset | None / No framework |
| Build command | 비워두기 또는 `exit 0` |
| Build output directory | `/` 또는 `.` |

## 환경변수

Cloudflare Pages 프로젝트의 Settings > Environment variables에 아래 값을 등록합니다.

```text
DATA_GO_KR_SERVICE_KEY=공공데이터포털 일반 인증키
```

API별로 키를 나누려면 아래도 사용할 수 있습니다.

```text
NTS_SERVICE_KEY=국세청 API 키
FTC_SERVICE_KEY=공정위 API 키
```

## 사용하는 API

1. 국세청 사업자등록정보 진위확인 및 상태조회 서비스
   - 상태조회: `https://api.odcloud.kr/api/nts-businessman/v1/status`
   - 진위확인: `https://api.odcloud.kr/api/nts-businessman/v1/validate`
2. 공정거래위원회 통신판매사업자 등록상세 제공 서비스
   - 등록상세 조회: `https://apis.data.go.kr/1130000/MllBsDtl_3Service/getMllBsInfoDetail_3`

## 법적/운영 원칙

- 사기 여부를 판정하지 않습니다.
- 거래 안전성을 보장하지 않습니다.
- 계좌번호, 전화번호, 피해사례 DB를 다루지 않습니다.
- 조회 입력값을 별도 DB에 저장하지 않는 구조입니다.
- 결과 공유 링크에 사업자번호 원문을 넣지 않습니다.


## v4 보완 사항

- 애드센스 심사 대비용 가이드 콘텐츠 6개 추가
- 메인/기능/결과 화면에 “사기 여부·거래 안전성 판정 아님” 문구 강화
- 개인정보처리방침에 광고 쿠키 및 맞춤 광고 안내 추가
- 데이터 출처, 면책 안내, 문의·정정 요청 페이지 강화
- sitemap.xml에 기능 페이지와 가이드 페이지 반영
- 조회 폼 하단에 입력정보 미저장 안내 추가


## 추가 기능

- `/tools/pc-spec.html`: 브라우저에서 확인 가능한 컴퓨터 사양, 직접 입력 사양 해석, CPU 간단 테스트를 제공합니다.


## 전기차 충전소 전국 로컬 캐시 생성 안내 (v32)

이 버전은 Windows에서 실제로 성공한 `Invoke-RestMethod` 방식에 맞춰 **PowerShell 전용 캐시 생성 스크립트**를 사용합니다. Node.js가 없어도 실행할 수 있으며, `.cmd` 파일이 PowerShell 실행정책을 우회해서 실행합니다. 기본 요청 크기는 `numOfRows=9000`입니다.

### 1. PowerShell에서 API 키 설정

```powershell
$env:DATA_GO_KR_SERVICE_KEY="공공데이터포털_일반인증키"
```

### 2. 서울 10건 테스트

가장 먼저 이 명령으로 API 연결을 확인합니다.

```powershell
.\scripts\build-ev-charger-cache-windows.cmd -Region 11 -Test
```

정상이라면 `resultCode=00`, `NORMAL SERVICE`, `itemCount=10`이 표시됩니다.

### 3. 서울 캐시 생성

```powershell
.\scripts\build-ev-charger-cache-windows.cmd -Region 11
```

생성 결과는 아래 파일에 저장됩니다.

```text
assets/data/ev-chargers/chunks/11.json
```

### 4. 전국 캐시 생성

서울 테스트가 성공하면 전국을 생성합니다.

```powershell
.\scripts\build-ev-charger-cache-windows.cmd
```

전국 생성 결과는 지역별 JSON 파일로 저장됩니다.

```text
assets/data/ev-chargers/chunks/11.json
assets/data/ev-chargers/chunks/26.json
...
assets/data/ev-chargers/index.json
assets/data/ev-chargers/regions.json
```

### 5. 실패 시 조정 옵션

기본값은 `-Rows 9000 -DelayMs 2500 -Retries 5`입니다. 공공데이터 서버가 불안정하면 아래처럼 낮춰서 재시도합니다.

```powershell
.\scripts\build-ev-charger-cache-windows.cmd -Region 11 -Rows 5000 -DelayMs 5000 -Retries 8 -Resume
```

그래도 실패하면 다음 단계로 낮춥니다.

```powershell
.\scripts\build-ev-charger-cache-windows.cmd -Region 11 -Rows 3000 -DelayMs 7000 -Retries 10 -Resume
```

`-Resume`은 이전에 성공한 페이지 진행 파일이 있으면 이어서 수집합니다.

### 6. PowerShell 스크립트를 직접 실행해야 할 때

`.cmd`가 아닌 `.ps1`을 직접 실행할 때는 실행정책 때문에 막힐 수 있습니다. 이 경우 아래처럼 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ev-charger-cache.ps1 -Region 11 -Test
```

### 7. 데이터 성격

로컬 캐시는 충전소명, 주소, 좌표, 충전기 타입 같은 기본정보를 빠르게 표시하기 위한 정적 캐시입니다. 사용 가능, 충전 중, 고장 같은 상태값은 제공기관 데이터 기준으로 짧게 다시 확인하며 실제 현장 상황과 다를 수 있습니다.


## v32 PowerShell encoding fix

Windows PowerShell 5.1에서 Korean strings in `.ps1` can be misread when the file is UTF-8 without BOM. This package saves `scripts/build-ev-charger-cache.ps1` as UTF-8 with BOM and sets the console code page in `build-ev-charger-cache-windows.cmd`.

Recommended command:

```powershell
$env:DATA_GO_KR_SERVICE_KEY="YOUR_KEY"
.\scripts\build-ev-charger-cache-windows.cmd -Region 11 -Test
.\scripts\build-ev-charger-cache-windows.cmd -Region 11
```


## 장보기 물가 확인 기능 안내 (v55 1차)

`/tools/grocery-price-check.html`은 Cloudflare Pages Functions의 `/api/kamis-prices`를 통해 KAMIS 가격정보 Open API를 호출합니다. v64부터는 `dailySalesList` 최근일자 상품 기준 가격정보를 가격 있는 1차 검색 인덱스로 먼저 사용하고, `productInfo` 코드표는 품목 후보 보정과 애매한 입력 처리에 보조로 사용합니다. 키 값은 하이픈을 제거하지 말고 발급받은 원문 그대로 입력합니다.


## 장보기 물가 확인 기능 안내 (v56 2차)

`/tools/grocery-price-check.html`은 Cloudflare Pages Functions의 `/api/kamis-prices`를 통해 KAMIS 가격정보 Open API를 호출합니다.

필수 환경변수:

```env
KAMIS_API_KEY=발급받은 인증 key 원문 그대로 입력
KAMIS_CERT_ID=KAMIS 요청자 ID
```

키 값에 하이픈이 포함되어 있으면 제거하지 말고 그대로 입력합니다. 환경변수 이름에는 하이픈 대신 언더스코어를 사용합니다.

현재 구현은 `dailySalesList` 상품 기준 가격정보를 우선 사용하고, `productInfo` 코드표 및 후보 선택 로직으로 품목명을 해석합니다. 부류별 API는 보조 fallback으로만 사용합니다.


### 장보기 물가 확인 v64

- `functions/api/kamis-prices.js`는 `dailyPriceByCategoryList` 부류 추정 방식을 메인에서 내리고, `dailySalesList` 상품 기준 가격정보와 `productInfo` 코드표 기반 매칭을 우선 사용합니다.
- `배`/`배추`, `무`/`무화과`, `파`/`대파`/`쪽파`처럼 혼동 가능성이 있는 품목은 단순 포함 검색을 막고 후보 선택 상태를 반환합니다.
- 프론트는 `ambiguous_item` 응답을 받으면 후보 카드로 품목을 다시 선택하게 합니다.
- 지역을 선택한 경우에는 코드표 후보에 품목·품종·등급 코드가 있을 때 `periodRetailProductList` 또는 `periodWholesaleProductList`로 보조 조회합니다.


### 장보기 물가 확인 v65

`/api/kamis-prices`는 v65부터 KAMIS 농축수산물 가격을 우선 조회하고, KAMIS에서 강한 매칭이 없거나 가격값이 없을 때 한국소비자원 참가격 생필품 가격 정보 API를 보조 조회합니다.

Cloudflare Pages Production 환경변수에 아래 값을 추가합니다.

```env
KAMIS_API_KEY=발급받은 KAMIS 인증 key 원문 그대로 입력
KAMIS_CERT_ID=KAMIS 요청자 ID
PRICE_GO_KR_API_KEY=한국소비자원_생필품 가격 정보 일반 인증키 원문 그대로 입력
```

v65 핵심 변경:

- 낮은 점수의 KAMIS 후보를 자동 확정하지 않도록 오탐 차단 기준을 추가했습니다. 예: `밀가루`가 `쌀/20kg`으로 표시되는 문제 방지.
- KAMIS에서 강한 매칭이 없으면 `openapi.price.go.kr/openApiImpl/ProductPriceInfoService`의 상품정보/생필품 가격정보를 사용합니다.
- 참가격 API의 HTTPS 응답이 525/526으로 실패하면 HTTP endpoint를 자동으로 한 번 더 시도하고, 키 미설정/연결 오류/자료 없음 메시지를 분리합니다.
- 참가격 보조 조회 결과는 `참가격 생필품 가격` 출처로 표시합니다.
- 참가격 가격정보는 조사일과 판매점 기준 자료이므로 실제 매장 가격, 행사 가격, 판매 가능 여부와 차이가 있을 수 있습니다.

## v66 주차비 확인 지도: 공공데이터 주차장 카카오맵 링크 로컬 캐시

공공데이터 기반 주차장은 카카오 장소 ID가 없기 때문에, 사이트 런타임에서 카카오 Local API를 매번 호출하지 않고 로컬 캐시 JSON으로 장소 링크를 보강합니다.

### 기본 동작

- `kakaoPlaceUrl`이 있는 주차장: `카카오맵 장소 바로가기` 버튼을 표시합니다.
- 정확 매칭 캐시가 없는 공공데이터 주차장: `카카오맵에서 검색하기` 버튼을 표시합니다.
- 런타임에서는 `assets/data/parking/kakao-place-cache.json`만 읽고, 장소 링크 보강용 카카오 API 호출은 하지 않습니다.

### 로컬 매칭 캐시 생성

루트에 `.env.local`을 만들고 카카오 REST API 키를 넣습니다.

```env
KAKAO_REST_API_KEY=카카오_REST_API_키
```

처음에는 적은 개수로 테스트합니다.

```bash
node scripts/enrich-parking-kakao-places.js --limit=10
node scripts/enrich-parking-kakao-places.js --region=대전 --limit=100
```

전체 매칭은 아래처럼 실행합니다.

```bash
node scripts/enrich-parking-kakao-places.js
```

실행 결과는 아래 파일에 저장됩니다.

```txt
assets/data/parking/kakao-place-cache.json
```

이 파일을 포함해서 배포하면, 정확 매칭된 공공데이터 주차장은 `카카오맵 장소 바로가기`로 표시되고, 매칭 실패 또는 불확실한 항목은 `카카오맵에서 검색하기`로 표시됩니다.

### 옵션

```bash
node scripts/enrich-parking-kakao-places.js --limit=500
node scripts/enrich-parking-kakao-places.js --region=서울 --limit=500
node scripts/enrich-parking-kakao-places.js --force --limit=50
node scripts/enrich-parking-kakao-places.js --dry-run --limit=10
```

- `--limit=N`: 이번 실행에서 새로 조회할 최대 주차장 수
- `--region=대전`: 주소/지역 문자열에 해당 단어가 포함된 주차장만 처리
- `--force`: 기존 매칭 캐시가 있어도 다시 조회
- `--dry-run`: 결과 파일을 쓰지 않고 테스트



## v67 주차비 확인 지도: 카카오맵 버튼 문구/PC 팝업 레이아웃 정리

- 주차비 확인 지도 카카오맵 버튼 문구를 `카카오맵 바로가기`, `카카오맵 검색`으로 짧게 정리했습니다.
- PC 지도 팝업에서는 `지도에서 선택한 주차장입니다.` 배지 옆에 카카오맵 버튼이 같은 줄로 배치되도록 보정했습니다.
- 모바일 팝업은 기존 하단 액션 영역 배치를 유지합니다.

## v71 신규 기능 0차: 공통 기반 정리

이번 버전은 `주유비·최저가 주유소 확인`, `응급실·야간 병원·약국 확인`, `외출 위험 종합 체크`를 실제 구현하기 전에 공통 기반을 먼저 정리한 버전입니다. 기존 기능의 UI와 API 동작은 유지하면서, 이후 차수에서 바로 재사용할 수 있는 공통 유틸과 환경변수 문서를 추가했습니다.

### 추가된 파일

```txt
functions/api/_lib/check-core.js
assets/js/check-toolkit.js
assets/css/tool-foundation.css
assets/data/common/korea-sido.json
docs/new-feature-implementation-plan.md
.env.example
```

### 공통 API 응답 원칙

신규 API는 아래 구조를 우선 사용합니다.

```json
{
  "ok": true,
  "code": "success",
  "source": "PUBLIC_API",
  "checkedAt": "ISO_DATE",
  "summary": {},
  "count": 0,
  "items": [],
  "warnings": []
}
```

오류는 `api_key_missing`, `api_auth_error`, `api_connection_error`, `no_data`, `invalid_request`처럼 원인을 분리합니다. 화면에서는 원인을 그대로 노출하기보다 사용자가 다음 행동을 알 수 있는 문구로 바꿔 표시합니다.

### 신규 기능 환경변수 준비

```env
# 주유비·최저가 주유소 확인
OPINET_API_KEY=

# 외출 위험 종합 체크
AIRKOREA_API_KEY=
KMA_FORECAST_API_KEY=
KMA_LIVING_INDEX_API_KEY=
KMA_API_KEY=

# 응급실·야간 병원·약국 확인
NMC_EMERGENCY_API_KEY=
NMC_HOSPITAL_API_KEY=
NMC_PHARMACY_API_KEY=
HIRA_API_KEY=
```

`/api/config`는 v71부터 `featureEnvStatus`를 함께 반환합니다. 이 값은 신규 기능 개발 중 환경변수가 Production에 들어갔는지 빠르게 확인하는 용도로 사용합니다.

### 이후 구현 순서

```txt
v72 외출 위험 UI 개편
v73 기상청 단기예보 연동
v74 생활기상지수 연동 완료
v75 주유소 지도 UI
v76 오피넷 API 연동
v77 주유비 계산 고도화
v78 응급실 MVP
v79 응급실 상태 고도화
v80 야간 병원·약국 확장 및 메인 통합
```


## v73-outdoor-risk-weather

- `functions/api/outdoor-air.js`에 기상청 단기예보 조회서비스 연동을 추가했습니다.
- 장소 검색 또는 현재 위치 좌표가 있으면 해당 좌표를 기상청 격자 좌표로 변환하고, 좌표가 없으면 시도 대표 좌표를 사용합니다.
- 외출 위험도 점수에 강수확률, 강수형태, 예상 기온, 습도, 풍속을 반영합니다.
- 결과 카드에 강수확률, 예상 기온, 습도, 풍속, 하늘상태 지표를 추가했습니다.
- 자외선지수와 대기정체지수는 생활기상지수 API로 반영됩니다.


### v74 생활기상지수 연동 상세

- `functions/api/outdoor-air.js`에 기상청 생활기상지수 조회서비스(3.0) 연동을 추가했습니다.
- `KMA_LIVING_INDEX_API_KEY`가 있으면 자외선지수와 대기정체지수를 조회해 외출 위험 점수에 반영합니다.
- 자외선지수는 높음 이상에서 차단제·모자 준비, 매우 높음 이상에서 한낮 장시간 외출 주의 문구를 제공합니다.
- 대기정체지수는 대기 확산이 낮은 경우 오염물질이 머무를 수 있다는 안내를 추가합니다.
- 기상청 단기예보와 생활기상지수는 모두 공개 API 기준의 참고 정보이며 실제 체감 환경과 차이가 있을 수 있습니다.


## v75 최저가 주유소 확인 UI 골격

- `tools/fuel-station-check.html` 페이지를 추가했습니다.
- `assets/js/fuel-station-check.js`는 오피넷 API 연동 전 샘플 데이터로 필터, 지도 마커, 주유소 카드, 상세 패널 UI를 확인합니다.
- `functions/api/fuel-stations.js`는 향후 오피넷 연동을 위한 API 엔드포인트 골격입니다.
- 실제 주유소 가격 연동은 다음 차수에서 `OPINET_API_KEY`를 사용해 구현합니다.
- 배포 ZIP에는 `.env`, `.env.local` 같은 키 파일을 포함하지 않습니다.


### v77-fuel-cost-calc
- 최저가 주유소 확인에 주유량·연비·추가 이동거리 입력을 추가했습니다.
- 오피넷 가격 기준 예상 주유비, 평균가 대비 절약액, 거리 고려 참고 절약액을 계산합니다.


## v78-emergency-room-mvp

- `tools/emergency-hospital-check.html` 응급실·야간 병원·약국 확인 페이지를 추가했습니다.
- `functions/api/emergency-hospitals.js`에서 `NMC_EMERGENCY_API_KEY` 기준 국립중앙의료원 응급의료기관 정보를 조회합니다.
- 응급실 목록, 전화번호, 가용 병상, 현재 위치 기반 조회, 카카오맵 검색 버튼을 제공합니다.
- 응급 상황에서는 119 연락이 우선이라는 안내와 방문 전 전화 확인 문구를 UI 전반에 반영했습니다.


## v79-emergency-room-status

- `functions/api/emergency-hospitals.js`에 중증질환 수용가능정보 조회와 응급실·중증질환 메시지 조회를 비파괴 보강 방식으로 추가했습니다.
- 응급실 카드에 중증질환 참고 정보, 장비·시설 상태 칩, 상태 메시지 영역을 추가했습니다.
- `보기 기준`에 중증 정보 우선 정렬을 추가했습니다.
- 가용 병상, 중증질환 수용가능정보, 장비 상태는 모두 공공데이터 제공 시점 기준 참고 정보이며 실제 수용 가능 여부는 병원 전화 또는 119 안내로 확인해야 한다는 문구를 강화했습니다.


## v80-night-hospital-pharmacy

- `tools/emergency-hospital-check.html`에 `[응급실] [야간 병원] [야간 약국]` 탭을 추가했습니다.
- `functions/api/emergency-hospitals.js`에서 `mode=hospital`, `mode=pharmacy` 조회를 지원합니다.
- 국립중앙의료원 전국 병·의원 찾기 서비스와 전국 약국 정보 조회 서비스 기준으로 기관명, 전화번호, 주소, 운영시간을 정규화합니다.
- 운영시간은 공공데이터 기준 참고 정보이므로 실제 접수 마감과 방문 가능 여부는 전화 확인이 필요하다는 안내를 유지합니다.


## v81-main-seo-integration

10차 작업으로 신규 기능 3종을 메인 구조와 SEO 기준에 최종 통합했습니다.

- 메인 기능 영역을 `차량 생활 확인`, `생활 안전 확인`, `생활 물가 확인`, `사업자·거래 확인`, `기기 확인` 카테고리로 재배치했습니다.
- 주요 기능 drawer의 중복 항목을 정리하고 신규 기능을 카테고리별로 묶었습니다.
- `index.html`에 WebSite/ItemList JSON-LD를 추가했습니다.
- 외출 위험, 최저가 주유소, 응급실·야간 병원·약국 페이지의 메타 설명, FAQ 구조화 데이터, 오래된 예정 문구를 정리했습니다.
- `data-sources.html`에서 신규 기능을 추가 예정이 아닌 적용 상태로 갱신했습니다.
- `sitemap.xml`에 2026-06-21 lastmod와 신규 핵심 기능 우선순위를 반영했습니다.
- `.env.example`을 전체 기능 기준 환경변수 목록으로 정리했습니다.

배포 후 `/api/config`의 `serverVersion`이 `v81-main-seo-integration`으로 보이면 10차 통합본이 반영된 것입니다.
