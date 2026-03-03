# 라이트 중심 컬러 시스템 — focus-ring / text-muted / text-subtle 적용

## 1. 추가된 토큰 코드

### :root (라이트)

```css
--text-muted: var(--theall-text-muted);   /* 기존: #64748b, 본문 보조 */
--text-subtle: #94a3b8;                    /* 캡션/placeholder/보조 설명 */
/* Focus ring: primary 기반, 라이트 배경에서 WCAG AA 대비 */
--focus-ring: var(--primary);
```

### .dark

```css
--text-muted: #94a3b8;
--text-subtle: #64748b;
/* 다크 배경에서 잘 보이도록 */
--focus-ring: #60a5fa;
```

---

## 2. @theme inline 매핑

```css
@theme inline {
  --color-text-muted: var(--text-muted);
  --color-text-subtle: var(--text-subtle);
  --color-focus-ring: var(--focus-ring);
  /* ... */
}
```

- `text-muted` → 본문 보조 텍스트
- `text-subtle` → placeholder, 캡션, 보조 문구
- `focus-ring` → input/textarea/select/button/a 의 focus-visible 링 색상

---

## 3. 대표 컴포넌트 Before/After

### (1) Input.tsx

**Before**

```tsx
"transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
"text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
```

**After**

```tsx
"transition focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
"text-[var(--text-primary)] placeholder:text-[var(--text-subtle)]"
```

---

### (2) Button.tsx

**Before**

```tsx
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
```

**After**

```tsx
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
```

---

### (3) ConsultModal.tsx (인라인 input)

**Before**

```tsx
focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_25%,transparent)]
placeholder:text-[var(--text-muted)]
```

**After**

```tsx
focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]
placeholder:text-[var(--text-subtle)]
```

---

### (4) AdminReviewTable.tsx

**Before**

```tsx
focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]
border-slate-300
text-slate-500 / text-slate-400 / text-slate-600
```

**After**

```tsx
focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]
border-[var(--border)] bg-[var(--surface)]
text-[var(--text-muted)] / text-[var(--text-subtle)]
```

---

### (5) AdminInquiryTable.tsx

**Before**

```tsx
text-slate-600, text-slate-500, text-slate-400 (라벨/캡션/빈값)
```

**After**

```tsx
text-[var(--text-muted)], text-[var(--text-subtle)]
```

---

## 4. 하드코딩 색상 제거 목록

| 파일 | 제거된 패턴 | 대체 토큰 |
|------|-------------|-----------|
| Input.tsx | focus-visible:ring-[color-mix(…primary…)], placeholder:text-muted | --focus-ring, --text-subtle |
| Textarea.tsx | 동일 | 동일 |
| Select.tsx | focus-visible:ring-[color-mix(…)] | --focus-ring |
| Button.tsx | focus-visible:ring-primary/30 | --focus-ring |
| ConsultModal.tsx | focus:border-[var(--primary)] + ring color-mix, placeholder:text-muted | --focus-ring, --text-subtle |
| HeaderQuickConsultCtas.tsx | 동일 | 동일 |
| HeroQuickConsultButton.tsx | 동일 | 동일 |
| admin/SubHeader.tsx | focus:ring color-mix, Search 아이콘 text-slate-400 | --focus-ring, --text-subtle |
| AdminMemberTable.tsx | focus:ring color-mix | --focus-ring |
| AdminReviewTable.tsx | focus:#2563eb/#bfdbfe, border-slate-300, text-slate-500/400/600 | --focus-ring, --border, --surface, --text-muted, --text-subtle |
| AdminInquiryTable.tsx | text-slate-600/500/400 | --text-muted, --text-subtle |
| AdminNoticeManager.tsx | text-slate-500/600/700, border-slate-200, bg-slate-50/100 | --text-muted, --border, --surface-muted |
| AdminBannerManager.tsx | focus:#2563eb/#bfdbfe, border-slate-200, text-slate-500 | --focus-ring, --border, --surface-muted, --text-muted |
| AdminGuideManager.tsx | focus:#2563eb/#bfdbfe | --focus-ring |
| SignupForm.tsx | focus:#2563eb/#bfdbfe | --focus-ring |
| MemberLoginForm.tsx | focus:#2563eb/#bfdbfe | --focus-ring |
| HeroInquiryForm.tsx | focus:#2563eb/#bfdbfe | --focus-ring |
| ReviewItemActions.tsx | focus:#2563eb/#bfdbfe | --focus-ring |
| GuidesListClient.tsx | focus:ring-[#1E3A8A] | --focus-ring |
| AdminRecommendedSearchManager.tsx | focus:border/ring-[var(--brand)] | --focus-ring |

---

## 5. 접근성

- **라이트**: `--focus-ring: var(--primary)` (#1e3a8a)로 라이트 배경 대비 WCAG AA 이상 유지.
- **다크**: `--focus-ring: #60a5fa`로 다크 배경에서 포커스 링 가시성 확보.
- 포커스 링 두께는 기존과 동일(ring-2), 색상만 `var(--focus-ring)`으로 통일.

---

*문서 생성: 컬러 토큰 적용 작업 기준*
