/**
 * One-off generator for corporate B2B review PDFs (Korean via Malgun Gothic).
 * Output: public/downloads/corporate/*.pdf
 */
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "downloads", "corporate");
const FONT = "C:/Windows/Fonts/malgun.ttf";
const FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf";

mkdirSync(OUT, { recursive: true });

const hub = {
  title: "기업·기관 단체 프로그램 공통 안내서",
  subtitle: "포상여행부터 직무연수·정책시찰까지",
  intro:
    "기업·공기업·공공기관·의회 등 조직 성격에 맞는 단체여행을 상담합니다. 확정되지 않은 면담·방문은 후보로만 안내하며, 실제 일정은 협의 후 확정합니다.",
  support: [
    "목적·인원·예산에 맞춘 일정 초안 제안",
    "숙소·이동·현지 동선 조율",
    "행사·시상·만찬 등 부대 프로그램 협의",
    "참가자 안내문·일정표 초안 지원",
  ],
  process: [
    ["상담 접수", "목적·일정·인원·예산을 먼저 확인합니다."],
    ["일정 초안", "고객군별 예시와 후보지를 바탕으로 초안을 제안합니다."],
    ["협의·조정", "면담·견학·행사 등 협의 대상을 함께 좁혀 갑니다."],
    ["견적·확정", "합의된 범위로 견적을 정리하고 진행 여부를 결정합니다."],
  ],
  segments: [
    {
      name: "기업",
      sample: "3박 4일 포상여행 예시",
      steps: [
        ["팀 프로그램", "예시"],
        ["시상·만찬", "협의 대상"],
        ["선택 관광", "선택 가능"],
      ],
    },
    {
      name: "공기업",
      sample: "직무연수 일정 예시",
      steps: [
        ["운영사 브리핑", "면담 후보"],
        ["시설 견학", "협의 대상"],
        ["참가자 토론", "예시"],
      ],
    },
    {
      name: "공공기관",
      sample: "정책연수·답사 예시",
      steps: [
        ["관계기관 면담 후보", "면담 후보"],
        ["정책 현장 답사", "협의 대상"],
        ["참가자 정리", "예시"],
      ],
    },
    {
      name: "의회",
      sample: "위원회 시찰 예시",
      steps: [
        ["지방의회 면담 후보", "면담 후보"],
        ["교통 운영 현장", "협의 대상"],
        ["도시정책 사례지", "협의 대상"],
      ],
    },
  ],
};

const segments = [
  {
    file: "business-proposal-summary-1p.pdf",
    title: "기업 행사 제안 요약서",
    audience: "기업 단체여행",
    programs: ["인센티브·포상", "워크숍·팀빌딩", "기업 골프", "비즈니스 출장"],
    sampleTitle: "3박 4일 포상여행 예시",
    sampleSummary: "팀 프로그램 → 시상·만찬 → 선택 관광 흐름의 예시 일정입니다.",
    steps: [
      ["팀 프로그램", "도착 후 팀 소개·아이스브레이크 등 가벼운 팀 활동", "예시"],
      ["시상·만찬", "포상 시상과 만찬 자리 구성(장소·형식은 협의)", "협의 대상"],
      ["선택 관광", "자유 시간 또는 선택 관광 코스", "선택 가능"],
    ],
    support: [
      "포상·워크숍·골프·출장형 일정 초안",
      "숙소·이동·행사 장소 후보 조율",
      "시상·만찬 등 부대 프로그램 협의",
    ],
    notes: [
      "행사 장소와 시상 형식은 확정 전이면 협의 대상으로 표기합니다.",
      "방문·면담이 필요한 경우에도 후보 단계로만 안내합니다.",
    ],
  },
  {
    file: "public-enterprises-training-brief-1p.pdf",
    title: "직무연수 검토자료",
    audience: "공기업 직무연수 여행",
    programs: ["에너지·환경 연수", "교통·시설 운영 연수"],
    sampleTitle: "직무연수 일정 예시",
    sampleSummary: "운영사 브리핑 → 시설 견학 → 참가자 토론 흐름의 예시입니다.",
    steps: [
      ["운영사 브리핑", "관련 운영사·기관 브리핑 후보", "면담 후보"],
      ["시설 견학", "시설·현장 견학 후보 동선", "협의 대상"],
      ["참가자 토론", "견학 내용을 바탕으로 한 참가자 토론·정리", "예시"],
    ],
    support: [
      "직무연수 목적에 맞춘 일정 초안",
      "브리핑·견학 후보지 조율 지원",
      "참가자 토론·정리 시간 배치",
    ],
    notes: [
      "기관·운영사 면담과 시설 견학은 확정 일정이 아닙니다.",
      "가능 여부는 상담 후 협의하며, 화면에는 후보·협의 대상으로만 표기합니다.",
    ],
  },
  {
    file: "public-institutions-policy-brief-1p.pdf",
    title: "정책연수·답사 검토자료",
    audience: "공공기관 정책연수·답사",
    programs: ["도시재생·지역관광", "복지·교육 정책연수"],
    sampleTitle: "정책연수·답사 예시",
    sampleSummary: "관계기관 면담 후보 → 정책 현장 답사 → 참가자 정리 흐름입니다.",
    steps: [
      ["관계기관 면담 후보", "관련 기관·부서 면담 후보 일정", "면담 후보"],
      ["정책 현장 답사", "정책이 적용된 현장·사례지 답사", "협의 대상"],
      ["참가자 정리", "답사 내용 공유와 참가자 정리 시간", "예시"],
    ],
    support: [
      "정책연수·답사 목적에 맞춘 일정 초안",
      "면담·답사 후보지 조율 지원",
      "참가자 정리·공유 시간 배치",
    ],
    notes: [
      "관계기관 면담은 확정된 일정이 아니며 면담 후보로만 표기합니다.",
      "현장 답사 범위는 협의 후 확정합니다.",
    ],
  },
  {
    file: "councils-inspection-brief-1p.pdf",
    title: "의회 정책시찰 검토자료",
    audience: "의회 위원회 시찰",
    programs: ["교통·도시 시찰", "복지 등 위원회 주제 시찰"],
    sampleTitle: "위원회 시찰 예시",
    sampleSummary: "지방의회 면담 후보 → 교통 운영 현장 → 도시정책 사례지 흐름입니다.",
    steps: [
      ["지방의회 면담 후보", "관련 지방의회·위원회 면담 후보", "면담 후보"],
      ["교통 운영 현장", "교통 운영 관련 현장 방문 후보", "협의 대상"],
      ["도시정책 사례지", "도시정책 사례지 탐방", "협의 대상"],
    ],
    support: [
      "위원회 주제별 시찰 일정 초안",
      "면담·현장 후보지 조율 지원",
      "사례지 동선·이동 계획 협의",
    ],
    notes: [
      "지방의회 면담과 현장 방문은 수행 실적을 보장하지 않으며 후보로만 표기합니다.",
      "실제 면담·견학 가능 여부는 상담 후 협의합니다.",
    ],
  },
];

function wrap(text, font, size, maxWidth) {
  const chars = [...text];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function makeDoc() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(readFileSync(FONT), { subset: true });
  const bold = await doc.embedFont(readFileSync(FONT_BOLD), { subset: true });
  return { doc, regular, bold };
}

function drawHeader(page, bold, title, subtitle) {
  page.drawText("더올투어 · 기업·기관 단체여행", {
    x: 48,
    y: 800,
    size: 10,
    font: bold,
    color: rgb(0.25, 0.35, 0.45),
  });
  page.drawText(title, { x: 48, y: 772, size: 18, font: bold, color: rgb(0.1, 0.12, 0.16) });
  if (subtitle) {
    page.drawText(subtitle, { x: 48, y: 748, size: 11, font: bold, color: rgb(0.3, 0.35, 0.4) });
  }
  page.drawLine({
    start: { x: 48, y: 736 },
    end: { x: 547, y: 736 },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.85),
  });
}

function drawFooter(page, regular, label) {
  page.drawText(label, {
    x: 48,
    y: 36,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.48, 0.52),
  });
  page.drawText("예시 일정·방문 후보·협의 대상은 확정 일정이 아닙니다.", {
    x: 48,
    y: 24,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.48, 0.52),
  });
}

async function writeGuide() {
  const { doc, regular, bold } = await makeDoc();
  const pages = [
    () => {
      const page = doc.addPage([595, 842]);
      drawHeader(page, bold, hub.title, hub.subtitle);
      let y = 710;
      page.drawText("소개", { x: 48, y, size: 13, font: bold });
      y -= 18;
      for (const line of wrap(hub.intro, regular, 10, 500)) {
        page.drawText(line, { x: 48, y, size: 10, font: regular });
        y -= 14;
      }
      y -= 10;
      page.drawText("지원 범위", { x: 48, y, size: 13, font: bold });
      y -= 18;
      for (const item of hub.support) {
        page.drawText(`• ${item}`, { x: 48, y, size: 10, font: regular });
        y -= 16;
      }
      drawFooter(page, regular, "1 / 4");
    },
    () => {
      const page = doc.addPage([595, 842]);
      drawHeader(page, bold, hub.title, "진행 절차");
      let y = 710;
      hub.process.forEach(([t, d], i) => {
        page.drawText(`${i + 1}. ${t}`, { x: 48, y, size: 12, font: bold });
        y -= 16;
        for (const line of wrap(d, regular, 10, 500)) {
          page.drawText(line, { x: 60, y, size: 10, font: regular });
          y -= 14;
        }
        y -= 12;
      });
      drawFooter(page, regular, "2 / 4");
    },
    () => {
      const page = doc.addPage([595, 842]);
      drawHeader(page, bold, hub.title, "고객군별 일정 예시 (1)");
      let y = 710;
      for (const seg of hub.segments.slice(0, 2)) {
        page.drawText(seg.name, { x: 48, y, size: 13, font: bold });
        y -= 16;
        page.drawText(seg.sample, { x: 48, y, size: 10, font: regular });
        y -= 16;
        for (const [step, status] of seg.steps) {
          page.drawText(`• ${step}  [${status}]`, { x: 60, y, size: 10, font: regular });
          y -= 14;
        }
        y -= 18;
      }
      drawFooter(page, regular, "3 / 4");
    },
    () => {
      const page = doc.addPage([595, 842]);
      drawHeader(page, bold, hub.title, "고객군별 일정 예시 (2)");
      let y = 710;
      for (const seg of hub.segments.slice(2)) {
        page.drawText(seg.name, { x: 48, y, size: 13, font: bold });
        y -= 16;
        page.drawText(seg.sample, { x: 48, y, size: 10, font: regular });
        y -= 16;
        for (const [step, status] of seg.steps) {
          page.drawText(`• ${step}  [${status}]`, { x: 60, y, size: 10, font: regular });
          y -= 14;
        }
        y -= 18;
      }
      page.drawText("표기 안내", { x: 48, y, size: 12, font: bold });
      y -= 16;
      for (const note of [
        "예시: 구성 참고용 흐름",
        "면담 후보: 확정되지 않은 면담·방문 후보",
        "협의 대상: 가능 여부를 상담 후 조율",
        "선택 가능: 참가자·예산에 따라 선택",
      ]) {
        page.drawText(`• ${note}`, { x: 48, y, size: 10, font: regular });
        y -= 14;
      }
      drawFooter(page, regular, "4 / 4");
    },
  ];
  pages.forEach((fn) => fn());
  const bytes = await doc.save();
  const path = join(OUT, "corporate-program-guide-4p.pdf");
  writeFileSync(path, bytes);
  return path;
}

async function writeSegmentPdf(spec) {
  const { doc, regular, bold } = await makeDoc();
  const page = doc.addPage([595, 842]);
  drawHeader(page, bold, spec.title, spec.audience);
  let y = 710;
  page.drawText("프로그램", { x: 48, y, size: 12, font: bold });
  y -= 16;
  page.drawText(spec.programs.join(" · "), { x: 48, y, size: 10, font: regular });
  y -= 22;
  page.drawText("예시 일정", { x: 48, y, size: 12, font: bold });
  y -= 16;
  page.drawText(spec.sampleTitle, { x: 48, y, size: 11, font: bold });
  y -= 15;
  for (const line of wrap(spec.sampleSummary, regular, 10, 500)) {
    page.drawText(line, { x: 48, y, size: 10, font: regular });
    y -= 14;
  }
  y -= 8;
  for (const [title, detail, status] of spec.steps) {
    page.drawText(`${title}  [${status}]`, { x: 48, y, size: 10, font: bold });
    y -= 14;
    for (const line of wrap(detail, regular, 9, 500)) {
      page.drawText(line, { x: 60, y, size: 9, font: regular });
      y -= 12;
    }
    y -= 8;
  }
  y -= 4;
  page.drawText("지원 범위", { x: 48, y, size: 12, font: bold });
  y -= 16;
  for (const item of spec.support) {
    page.drawText(`• ${item}`, { x: 48, y, size: 10, font: regular });
    y -= 14;
  }
  y -= 8;
  page.drawText("협의 사항", { x: 48, y, size: 12, font: bold });
  y -= 16;
  for (const item of spec.notes) {
    for (const line of wrap(`• ${item}`, regular, 10, 500)) {
      page.drawText(line, { x: 48, y, size: 10, font: regular });
      y -= 14;
    }
  }
  drawFooter(page, regular, "A4 검토자료 · 1쪽");
  const path = join(OUT, spec.file);
  writeFileSync(path, await doc.save());
  return path;
}

const written = [await writeGuide()];
for (const spec of segments) written.push(await writeSegmentPdf(spec));
for (const path of written) {
  const st = statSync(path);
  console.log(`${path.replace(/\\/g, "/")} bytes=${st.size}`);
}
