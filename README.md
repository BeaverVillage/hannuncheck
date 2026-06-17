# 한눈체크

구매 전, 입금 전 사업자 정보를 한눈에 확인하는 정적 사이트 + Cloudflare Pages Functions 프로젝트입니다.

## 구성

- 정적 페이지: `index.html`, `about.html`, `privacy.html`, `disclaimer.html`, `data-sources.html`, `contact.html`
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
DATA_GO_KR_SERVICE_KEY=공공데이터포털 일반 인증키 Encoding 값
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
