/**
 * UTF-8 보존하며 @/components/* 루트 import → 도메인 경로로 치환.
 * 실행: node scripts/fix-component-imports.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

const REPLACEMENTS = [
  ["@/components/ConsultModal", "@/components/inquiry/ConsultModal"],
  ["@/components/SiteHeaderUI", "@/components/site-chrome/SiteHeaderUI"],
  ["@/components/SiteHeader", "@/components/site-chrome/SiteHeader"],
  ["@/components/GlobalSiteFooter", "@/components/site-chrome/GlobalSiteFooter"],
  ["@/components/KakaoFloatingButton", "@/components/site-chrome/KakaoFloatingButton"],
  ["@/components/WebVitalsReporter", "@/components/site-chrome/WebVitalsReporter"],
  ["@/components/FirstTouchInit", "@/components/site-chrome/FirstTouchInit"],
  ["@/components/MobileFloatingMenu", "@/components/site-chrome/MobileFloatingMenu"],
  ["@/components/HeaderSearchDropdown", "@/components/header/HeaderSearchDropdown"],
  ["@/components/HeaderProductSearch", "@/components/header/HeaderProductSearch"],
  ["@/components/HeaderQuickConsultCtas", "@/components/header/HeaderQuickConsultCtas"],
  ["@/components/HeaderExpandSearch", "@/components/header/HeaderExpandSearch"],
  ["@/components/HeaderMobileShell", "@/components/header/HeaderMobileShell"],
  ["@/components/InquiryForm", "@/components/inquiry/InquiryForm"],
  ["@/components/HeroInquiryForm", "@/components/inquiry/HeroInquiryForm"],
  ["@/components/HeroQuickConsultButton", "@/components/inquiry/HeroQuickConsultButton"],
  ["@/components/SignupForm", "@/components/auth/SignupForm"],
  ["@/components/MemberLoginForm", "@/components/auth/MemberLoginForm"],
  ["@/components/MemberLogoutButton", "@/components/auth/MemberLogoutButton"],
  ["@/components/ProductCatalogSection", "@/components/product-detail/ProductCatalogSection"],
  ["@/components/ProductsHero", "@/components/product-detail/ProductsHero"],
  ["@/components/ProductDetailTabs", "@/components/product-detail/ProductDetailTabs"],
  ["@/components/HomeProductSlider", "@/components/product-detail/HomeProductSlider"],
  ["@/components/HomeTopBanner", "@/components/product-detail/HomeTopBanner"],
  ["@/components/ReviewWriteForm", "@/components/reviews/ReviewWriteForm"],
  ["@/components/ReviewItemActions", "@/components/reviews/ReviewItemActions"],
  ["@/components/GuidePdfModal", "@/components/guides/GuidePdfModal"],
  ["@/components/PdfViewer", "@/components/pdf/PdfViewer"],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx|ts|mjs)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(root);
let changed = 0;
for (const file of files) {
  let c = fs.readFileSync(file, "utf8");
  const orig = c;
  for (const [a, b] of REPLACEMENTS) {
    if (c.includes(a)) c = c.split(a).join(b);
  }
  if (c !== orig) {
    fs.writeFileSync(file, c, "utf8");
    changed++;
    console.log("updated:", path.relative(root, file));
  }
}
console.log("done, files changed:", changed);
