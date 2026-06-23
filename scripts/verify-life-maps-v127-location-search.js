const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const tools = [
  ['fishing', 'tools/fishing-spot-map.html', 'assets/js/fishing-spot-map.js'],
  ['wifi', 'tools/free-wifi-map.html', 'assets/js/free-wifi-map.js'],
  ['toilet', 'tools/public-toilet-map.html', 'assets/js/public-toilet-map.js'],
];
for (const [name, htmlPath, jsPath] of tools) {
  const html = read(htmlPath);
  const js = read(jsPath);
  assert(html.includes('v127-location-search-current-ui'), `${name}: html v127 query missing`);
  assert(js.includes('v127-location-search-current-ui'), `${name}: js v127 version missing`);
  assert(js.includes('useCurrentLocation'), `${name}: current location handler missing`);
  assert(js.includes('applyReferencePoint'), `${name}: reference point loader missing`);
  assert(js.includes('nearestRegion'), `${name}: nearest admin resolver missing`);
  assert(js.includes('life-reference-marker'), `${name}: current/search marker renderer missing`);
  assert(js.includes('handlePlaceSearch'), `${name}: place search handler missing`);
  assert(js.includes('showSearchResults'), `${name}: search result UI missing`);
  assert(js.includes('카카오맵 바로가기'), `${name}: kakao map button missing`);
  assert(!js.includes('카카오맵 검색'), `${name}: duplicate kakao search button remains`);
}
const wifiHtml = read('tools/free-wifi-map.html');
const wifiJs = read('assets/js/free-wifi-map.js');
assert(!wifiHtml.includes('SSID'), 'wifi html: SSID text remains');
assert(!wifiJs.includes('SSID'), 'wifi js: SSID text remains');
assert(!wifiHtml.includes('와이파이 이름 있는 곳만'), 'wifi html: name-exists filter remains');
assert(!wifiJs.includes('와이파이 이름 있음'), 'wifi js: name-exists badge remains');
const css = read('assets/css/life-map.css');
assert(css.includes('life-list-card--compact'), 'css: compact list style missing');
assert(css.includes('life-reference-marker'), 'css: current location marker style missing');
assert(css.includes('life-search-results-panel'), 'css: search results panel style missing');
assert(css.includes('translateY(calc(100% - 70px))'), 'css: closed mobile bottom bar state missing');
assert(css.includes('background: #101820'), 'css: navy footer restored');
assert(css.includes('box-shadow: none !important'), 'css: marker shadow removal missing');
const fishing = JSON.parse(read('assets/data/life/fishing-spots/chungnam.json'));
const fixed = fishing.items.filter((item) => String(item.address || '').includes('서산시 대산읍 화곡리 1891'));
assert(fixed.length >= 1, 'fishing: 서산 화곡리 item not found');
for (const item of fixed) {
  assert(Math.abs(Number(item.lat) - 37.0044351477144) < 0.00001, `fishing: ${item.name} lat not fixed`);
  assert(Math.abs(Number(item.lng) - 126.452296151466) < 0.00001, `fishing: ${item.name} lng not fixed`);
}
for (const idx of ['assets/data/life/fishing-spots/index.json','assets/data/life/free-wifi/index.json','assets/data/life/public-toilets/index.json']) {
  const data = JSON.parse(read(idx));
  assert((data.regions || []).some((r) => r.center), `${idx}: region centers missing`);
}
console.log('[verify-life-maps-v127-location-search] passed');
