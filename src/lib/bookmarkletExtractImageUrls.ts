/**
 * 이미지 URL 대량 추출 북마클릿 (단일 라인)
 * - 현재 페이지 DOM에서 img/srcset/background-image/a[href] 이미지 확장자 수집
 * - 정규화·중복 제거 후 줄바꿈으로 join → 클립보드 복사, 실패 시 prompt
 */

// prettier-ignore
export const BOOKMARKLET_EXTRACT_IMAGE_URLS =
  "javascript:(function(){var u=[];function n(s){if(!s)return'';s=(''+s).trim().replace(/^[\"'\\s()]+|[\"'\\s()]+$/g,'');if(/^\\/\\//.test(s))s='https:'+s;return(/^https?:\\/\\//i.test(s)?s:'');}function add(v){var t=n(v);if(t)u.push(t);}document.querySelectorAll('img').forEach(function(el){add(el.src);add(el.getAttribute('data-src'));add(el.getAttribute('data-original'));add(el.getAttribute('data-lazy'));var ss=el.getAttribute('data-srcset')||el.srcset;if(ss){var parts=ss.split(',').map(function(p){return p.trim().split(/\\s+/);});var best='';var maxW=0;parts.forEach(function(p){var url=n(p[0]);if(!url)return;var w=parseInt(p[1],10)||0;if(w>maxW){maxW=w;best=url;}else if(!best)best=url;});if(best)u.push(best);}});document.querySelectorAll('*').forEach(function(el){var st=window.getComputedStyle(el).backgroundImage||el.style.backgroundImage||'';var m=st.match(/url\\(\\s*[\"']?([^\"')]+)[\"']?\\s*\\)/);if(m&&m[1])add(m[1]);});document.querySelectorAll('a[href]').forEach(function(a){var h=(a.getAttribute('href')||'').trim();if(/^https?:\\/\\//i.test(h)&&/\\.(jpe?g|png|webp|gif)(\\?|$)/i.test(h))add(h);});var seen={};u=u.filter(function(x){var k=n(x);if(!k||seen[k])return false;seen[k]=1;return true;});var text=u.join('\\n');var N=u.length;navigator.clipboard.writeText(text).then(function(){alert('총 '+N+'개 복사 완료');}).catch(function(){var w=prompt('총 '+N+'개 (복사할 URL 목록)\\nCtrl+A 후 복사하세요:',text);alert(w!==null?'총 '+N+'개 복사 완료 (창에서 복사해 주세요)':'취소됨');});})();";
