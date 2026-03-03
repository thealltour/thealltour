# 이미지 URL 대량 추출 북마클릿

외부 페이지(예: 모두투어 상품 페이지)에서 이미지 URL을 한 번에 추출해 클립보드에 복사합니다.

## 설치 방법 (3줄)

1. 아래 **북마클릿 한 줄** 전체를 복사합니다.
2. 브라우저에서 새 북마크를 추가하고, **URL** 입력란에 붙여넣습니다.
3. 이름은 예: **이미지 URL 추출** 로 저장한 뒤, 이미지가 많은 페이지에서 북마크를 클릭해 실행합니다.

## 북마클릿 한 줄 (복사용)

```
javascript:(function(){var u=[];function n(s){if(!s)return'';s=(''+s).trim().replace(/^[\"'\\s()]+|[\"'\\s()]+$/g,'');if(/^\\/\\//.test(s))s='https:'+s;return(/^https?:\\/\\//i.test(s)?s:'');}function add(v){var t=n(v);if(t)u.push(t);}document.querySelectorAll('img').forEach(function(el){add(el.src);add(el.getAttribute('data-src'));add(el.getAttribute('data-original'));add(el.getAttribute('data-lazy'));var ss=el.getAttribute('data-srcset')||el.srcset;if(ss){var parts=ss.split(',').map(function(p){return p.trim().split(/\\s+/);});var best='';var maxW=0;parts.forEach(function(p){var url=n(p[0]);if(!url)return;var w=parseInt(p[1],10)||0;if(w>maxW){maxW=w;best=url;}else if(!best)best=url;});if(best)u.push(best);}});document.querySelectorAll('*').forEach(function(el){var st=window.getComputedStyle(el).backgroundImage||el.style.backgroundImage||'';var m=st.match(/url\\(\\s*[\"']?([^\"')]+)[\"']?\\s*\\)/);if(m&&m[1])add(m[1]);});document.querySelectorAll('a[href]').forEach(function(a){var h=(a.getAttribute('href')||'').trim();if(/^https?:\\/\\//i.test(h)&&/\\.(jpe?g|png|webp|gif)(\\?|$)/i.test(h))add(h);});var seen={};u=u.filter(function(x){var k=n(x);if(!k||seen[k])return false;seen[k]=1;return true;});var text=u.join('\\n');var N=u.length;navigator.clipboard.writeText(text).then(function(){alert('총 '+N+'개 복사 완료');}).catch(function(){var w=prompt('총 '+N+'개 (복사할 URL 목록)\\nCtrl+A 후 복사하세요:',text);alert(w!==null?'총 '+N+'개 복사 완료 (창에서 복사해 주세요)':'취소됨');});})();
```

## 수집 로직

- **img**: `src`, `data-src`, `data-original`, `data-lazy`, `data-srcset` / `srcset` (srcset은 **가장 큰 해상도 1개**만 사용)
- **배경 이미지**: 모든 요소의 인라인 `style` 또는 **computed** `background-image` 에서 `url(...)` 추출
- **링크**: `a[href]` 중 `.jpg` / `.jpeg` / `.png` / `.webp` / `.gif` 로 끝나는 주소

수집 후 **정규화**(앞뒤 따옴표·괄호·공백 제거, `http`/`https`만 유지) 및 **중복 제거**한 뒤, 줄바꿈(`\n`)으로 이어 붙여 클립보드에 복사합니다.

## 클립보드 실패 시 (fallback)

- `navigator.clipboard.writeText` 가 실패하면(권한 거부, 비 HTTPS 등) **prompt** 창에 전체 결과 텍스트를 띄웁니다.
- 사용자가 **Ctrl+A** 후 **복사**할 수 있습니다.
- 이어서 `alert("총 N개 복사 완료 (창에서 복사해 주세요)")` 로 안내합니다.
