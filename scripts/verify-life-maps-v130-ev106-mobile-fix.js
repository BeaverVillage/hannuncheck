#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (cond, message) => {
  if (!cond) {
    console.error(`[verify-life-maps-v130-ev106-mobile-fix] ${message}`);
    process.exit(1);
  }
};
const version = '20260623-v130-ev106-life-map-mobile-fix';
const runtime = 'v130-ev106-life-map-mobile-fix';
const tools = [
  ['fishing', 'tools/fishing-spot-map.html', 'assets/js/fishing-spot-map.js'],
  ['wifi', 'tools/free-wifi-map.html', 'assets/js/free-wifi-map.js'],
  ['toilet', 'tools/public-toilet-map.html', 'assets/js/public-toilet-map.js'],
];
for (const [name, htmlFile, jsFile] of tools) {
  const html = read(htmlFile);
  const js = read(jsFile);
  assert(html.includes(version), `${name}: html cache version missing`);
  assert(js.includes(`const VERSION = '${runtime}'`), `${name}: runtime version missing`);
  assert(js.includes('ensureMobileLocationButton'), `${name}: mobile location button creator missing`);
  assert(js.includes('life-map-current-floating'), `${name}: mobile map-inside current location button class missing`);
  assert(js.includes('kakaomap://look?p='), `${name}: mobile Kakao app scheme missing`);
  assert(js.includes('data-life-kakao-link'), `${name}: Kakao shortcut click bridge missing`);
  assert(js.includes("target.closest('.parking-mobile-sheet-head')"), `${name}: bottom sheet header drag hook missing`);
  assert(js.includes('collapseMobileSheet') && js.includes('expandMobileSheet'), `${name}: sheet snap states missing`);
}
const css = read('assets/css/life-map.css');
assert(css.includes('.life-map-current-floating'), 'css: map-inside current location button missing');
assert(css.includes('position: absolute') && css.includes('bottom: 82px'), 'css: current location button must be absolute inside map');
assert(css.includes('.life-map-toolbar .ghost[id$="-map-location"]') && css.includes('display: none'), 'css: toolbar current button hidden on mobile');
assert(css.includes('background: #101820'), 'css: navy footer missing');
assert(css.includes('minmax(230px, 1fr) minmax(130px, 155px)'), 'css: wifi/toilet toolbar compact columns missing');
const evHtml = read('tools/ev-charger-map.html');
const evJs = read('assets/js/ev-charger-map.js');
assert(evHtml.includes('20260620-v55-grocery-skeleton'), 'ev charger html should be restored to v106 asset query');
assert(!evHtml.includes('v130-ev106-life-map-mobile-fix'), 'ev charger html must not load life-map v130 assets');
assert(evJs.includes("const CLIENT_CACHE_PREFIX = 'hannuncheck:ev-charger:v2:'") && evJs.includes("EV_MAP_LIMIT_BY_RADIUS"), 'ev charger js should be restored to v106 static-cache runtime');
for (const kind of ['free-wifi', 'public-toilets']) {
  const index = JSON.parse(read(`assets/data/life/${kind}/index.json`));
  const seoul = index.regions.find((region) => region.key === 'seoul');
  assert(seoul?.center?.lat && seoul?.center?.lng, `${kind}: region center metadata missing`);
  const gwangjin = seoul.districts.find((district) => district.label === '광진구');
  assert(gwangjin?.center?.lat && gwangjin?.center?.lng, `${kind}: 광진구 center metadata missing`);
}
console.log('[verify-life-maps-v130-ev106-mobile-fix] passed');
