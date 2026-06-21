import { featureEnvStatus, getEnv, jsonResponse } from './_lib/check-core.js';

export async function onRequestGet({ env }) {
  const kakaoMapJsKey = getEnv(env, ['KAKAO_MAP_JS_KEY', 'KAKAO_JS_KEY']);
  return jsonResponse({
    serverVersion: 'v96-emergency-ev-map-parity-home-compact',
    kakaoMapJsKey,
    hasKakaoMapJsKey: Boolean(kakaoMapJsKey),
    hasKakaoRestApiKey: Boolean(getEnv(env, ['KAKAO_REST_API_KEY'])),
    hasPublicDataApiKey: Boolean(getEnv(env, ['PUBLIC_DATA_API_KEY', 'DATA_GO_KR_SERVICE_KEY', 'PUBLIC_DATA_SERVICE_KEY'])),
    hasSeoulOpenApiKey: Boolean(getEnv(env, ['SEOUL_OPEN_API_KEY'])),
    hasHolidayApiKey: Boolean(getEnv(env, ['HOLIDAY_API_KEY', 'PUBLIC_DATA_API_KEY', 'DATA_GO_KR_SERVICE_KEY'])),
    featureEnvStatus: featureEnvStatus(env),
    plannedFeatures: {
      outdoorRisk: '외출 위험 종합 체크',
      emergencyHospital: '응급실·야간 병원·약국 확인',
    },
    localCaches: {
      medicalKakaoPlaceCache: '/assets/data/medical/kakao-place-cache.json',
      emergencyNationalCache: '/assets/data/medical/emergency-national-cache.json',
    },
    message: kakaoMapJsKey
      ? 'Kakao Maps JavaScript key is configured. If the map still fails, check Kakao Developers Web platform domains.'
      : '카카오맵 키가 없어 기본 지도 안내 모드로 표시합니다.',
  });
}
