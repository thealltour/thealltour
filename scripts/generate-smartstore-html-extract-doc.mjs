/**
 * UTF-8로 docs/smartstore-html-architecture-extract.md 생성.
 * PowerShell Set-Content 등으로 한글이 깨지지 않도록 Node만 사용.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "docs", "smartstore-html-architecture-extract.md");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fence(lang, code) {
  return "```" + lang + "\n" + code + "\n```\n\n";
}

function section(title, body) {
  return "\n\n---\n\n" + title + "\n\n" + body;
}

const noticeExcerpt = read("src/lib/noticeTemplates.ts").split("\n").slice(123, 244).join("\n");

const getProductByIdFreshExcerpt = read("src/lib/products.ts").split("\n").slice(1037, 1055).join("\n");

let md = "";

md += `# 스마트스토어 HTML 자동생성 — 구조 발췌 문서

이 문서는 \`scripts/generate-smartstore-html-extract-doc.mjs\`로 소스 파일을 UTF-8 그대로 읽어 생성했습니다.

## 목표 요약

- **입력 → 가공 → 출력**: 관리자 UI → \`GET .../smartstore-html\` → \`buildSmartstoreDetailHtmlFromProduct\` → JSON \`{ html, meta }\` → 모달(iframe/textarea/클립보드).
- **블로그 확장**: \`src/lib/smartstore/*\` ViewModel·섹션 빌더 패턴을 복제·분기하면 됨. 다만 \`smartstoreHtml.safety\`는 네이버 정책에 맞춘 검사.
- **키워드 검색**: 코드베이스에 \`generateHtml\` / \`buildHtml\` / \`createHtml\` / \`productHtml\` / \`exportHtml\` 명칭은 없음. 실제 엔트리는 \`buildSmartstoreDetailHtml\`, \`buildSmartstoreDetailHtmlFromProduct\`, \`buildAllSectionsHtml\` 등.

`;

md += section(
  "## [1] HTML 생성 진입 지점",
  `### 1.1 버튼 onClick (목록 행 · Quick Actions)

**파일:** \`src/components/admin/products/AdminProductsQuickActions.tsx\`

- **핸들러:** \`onClick={() => onSmartstoreHtml(product)}\`
- **콜백 시그니처:** \`onSmartstoreHtml?: (product: Product) => void\` — 실제 구현은 \`AdminProductManager\`에서 모달 오픈.

${fence("tsx", read("src/components/admin/products/AdminProductsQuickActions.tsx"))}

### 1.2 목록 뷰에서 콜백 전달

**파일:** \`src/components/admin/products/AdminProductsListView.tsx\` (전체)

${fence("tsx", read("src/components/admin/products/AdminProductsListView.tsx"))}

### 1.3 AdminProductListSection

**파일:** \`src/components/admin/products/AdminProductListSection.tsx\` (전체)

${fence("tsx", read("src/components/admin/products/AdminProductListSection.tsx"))}

### 1.4 상태 · 모달 연결 (AdminProductManager 전체)

**파일:** \`src/components/admin/products/AdminProductManager.tsx\`

- \`smartstoreHtmlModalOpen\`, \`smartstoreHtmlProduct\` state
- \`onOpenSmartstoreHtml\` → 모달 오픈
- \`<SmartstoreHtmlGenerateModal ... />\`

${fence("tsx", read("src/components/admin/products/AdminProductManager.tsx"))}

### 1.5 모달 타입

**파일:** \`src/components/admin/products/modals/smartstoreHtmlModal.types.ts\`

${fence("tsx", read("src/components/admin/products/modals/smartstoreHtmlModal.types.ts"))}

### 1.6 모달 (fetch · 미리보기 · 원문 · 복사)

**파일:** \`src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx\`

- 열리면 \`useEffect\`에서 \`load()\` → \`GET /api/admin/products/:id/smartstore-html\`

${fence("tsx", read("src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx"))}`,
);

md += section(
  "## [2] HTML 생성 핵심 로직",
  `### 2.1 API 라우트

**파일:** \`src/app/api/admin/products/[id]/smartstore-html/route.ts\`

- \`getProductByIdFresh\` → \`resolveProductNoticesForDetailPage\` → \`buildSmartstoreDetailHtmlFromProduct\`

${fence("ts", read("src/app/api/admin/products/[id]/smartstore-html/route.ts"))}

### 2.2 상품 단건 로드 (API 체인 연결)

**파일:** \`src/lib/products.ts\` (발췌: \`getProductByIdFresh\` 전체)

${fence("ts", getProductByIdFreshExcerpt)}

### 2.3 래퍼 · 메타 · 최종 div

**파일:** \`src/lib/smartstore/buildSmartstoreDetailHtml.ts\` (전체)

${fence("ts", read("src/lib/smartstore/buildSmartstoreDetailHtml.ts"))}

### 2.4 섹션별 HTML 조각 (템플릿 리터럴)

**파일:** \`src/lib/smartstore/buildSmartstoreDetailSections.ts\` (전체)

${fence("ts", read("src/lib/smartstore/buildSmartstoreDetailSections.ts"))}`,
);

md += section(
  "## [3] 데이터 매핑 구조",
  `### 3.1 Product → SmartstoreHtmlViewModel

**파일:** \`src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts\` (전체)

${fence("ts", read("src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts"))}

### 3.2 ViewModel · API 응답 타입

**파일:** \`src/lib/smartstore/smartstoreHtml.types.ts\` (전체)

${fence("ts", read("src/lib/smartstore/smartstoreHtml.types.ts"))}

### 3.3 일정 타임라인 (itinerary → timeline)

**파일:** \`src/lib/products/mapProductToTimelineModel.ts\` (전체)

${fence("ts", read("src/lib/products/mapProductToTimelineModel.ts"))}

### 3.4 본문 필드 해석 (포함/불포함/선택 등)

**파일:** \`src/lib/products/resolveProductDetailBodyFields.ts\` (전체)

${fence("ts", read("src/lib/products/resolveProductDetailBodyFields.ts"))}

### 3.5 Product 타입 정의 (DB/UI 공통)

**파일:** \`src/types/product.ts\` (전체)

${fence("ts", read("src/types/product.ts"))}

### 3.6 공지 해석 (예약·여행·조건·환불 텍스트)

**파일:** \`src/lib/noticeTemplates.ts\` (발췌: \`ResolvedProductNoticesForDetail\` 및 \`resolve*ForDetail*\` 관련 export 블록)

${fence("ts", noticeExcerpt)}`,
);

md += section(
  "## [4] 템플릿 분리 여부",

  `- **별도 .html / .ejs 파일 없음.**
- HTML은 \`buildSmartstoreDetailSections.ts\` 등에서 **템플릿 리터럴**로 조립.
- 스타일은 \`styleAttr({ ... })\`로 인라인 객체 → 속성 문자열화.

위 [2.4] 파일 전체가 해당 “함수 내부(및 모듈 스코프) 문자열 템플릿”에 해당합니다.`,
);

md += section(
  "## [5] 유틸 · 기본값 · 안전성",

  `### 5.1 escapeHtml · styleAttr · 파서 등

**파일:** \`src/lib/smartstore/smartstoreHtml.helpers.ts\` (전체)

${fence("ts", read("src/lib/smartstore/smartstoreHtml.helpers.ts"))}

### 5.2 섹션 제목 · 고정 문구 · 예약 조건 기본값

**파일:** \`src/lib/smartstore/smartstoreHtml.defaults.ts\` (전체)

${fence("ts", read("src/lib/smartstore/smartstoreHtml.defaults.ts"))}

### 5.3 네이버 업로드 안전성 분석

**파일:** \`src/lib/smartstore/smartstoreHtml.safety.ts\` (전체)

${fence("ts", read("src/lib/smartstore/smartstoreHtml.safety.ts"))}

### 5.4 이미지 URL 정규화 (상품)

**파일:** \`src/lib/media/normalizeProductImageUrl.ts\` (전체)

${fence("ts", read("src/lib/media/normalizeProductImageUrl.ts"))}

### 5.5 이미지 목록 정규화

**파일:** \`src/lib/products/images.ts\` (전체)

${fence("ts", read("src/lib/products/images.ts"))}`,
);

md += section(
  "## [6] 최종 출력 방식",

  `1. **서버**: \`NextResponse.json({ ok: true, html, meta })\` — [2.1] 참고.
2. **클라이언트**: \`SmartstoreHtmlGenerateModal\` — \`state.html\`을
   - **iframe** \`srcDoc\` 미리보기
   - **readOnly textarea** 원문 표시
   - **\`navigator.clipboard.writeText(state.html)\`** 복사 ([1.6] 전체 코드에 포함).

아래는 출력 처리 핵심만 중복 발췌(동일 파일의 일부).

**파일:** \`src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx\`

${fence(
  "tsx",
  `  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    setCopyHint(null);
    try {
      const res = await fetch(\`/api/admin/products/\${encodeURIComponent(productId.trim())}/smartstore-html\`, {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as SmartstoreHtmlApiResponse;
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : \`요청 실패 (\${res.status})\`,
        });
        return;
      }
      setState({ status: "ok", html: data.html, meta: data.meta });
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  const handleCopy = async () => {
    if (state.status !== "ok") return;
    try {
      await navigator.clipboard.writeText(state.html);
      setCopyHint("HTML이 클립보드에 복사되었습니다.");
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 원문 탭에서 직접 선택해 복사해 주세요.");
    }
  };

  // 미리보기: srcDoc={state.html}
  // 원문: <textarea readOnly value={state.html} />
`,
)}`,
);

fs.writeFileSync(outPath, md, "utf8");
console.log("Wrote", outPath, "bytes:", Buffer.byteLength(md, "utf8"));
