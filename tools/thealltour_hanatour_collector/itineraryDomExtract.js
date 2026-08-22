/**
 * 하나투어 여행일정 DOM → itineraryBlocks 추출.
 * 관광지 카드 + 출입국/안내 notice + 호텔/식사/항공 섹션 + 조식 라인 + 타임라인 location.
 * 일차 탭/아코디언 순회 후 패널별 파싱 — day 없는 전역 재파싱 없음.
 */
(function (global) {
  // 데이터 완전성 우선: 일정 카드(관광지/공지)별 이미지 캡을 대폭 상향
  // (기존 5장 캡으로 인해 다수 이벤트 이미지가 누락되던 문제 해결).
  const MAX_EVENT_IMAGES = 30;
  const MAX_DESCRIPTION_LEN = 8000;
  const SECTION_LABEL = /^(예정호텔|호텔|식사|항공)$/;
  const MEAL_LINE = /^(조식|중식|석식|기내|기내식|중식\s*또는\s*석식|석식\s*또는\s*중식)/;
  const UI_SKIP =
    /일정\s*전체\s*펼침|이전일차|다음일차|여행일정\s*변경|상세내용을\s*확인|일정\s*상세보기/i;
  const DATE_IN_HEADER = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;
  const JUNK_URL_RE =
    /logo|icon|banner|spinner|arrow|badge|avatar|favicon|\/schedule\/caution_/i;

  function getUiPrep() {
    return global.HanatourItineraryUiPrep;
  }

  function getElementText(el) {
    return (el?.innerText ?? el?.textContent ?? "").trim();
  }

  function isJunkImageUrl(url) {
    if (!url || url.startsWith("data:")) return true;
    return JUNK_URL_RE.test(url);
  }

  function resolveImageUrl(img, baseUrl) {
    const attrs = [
      img.getAttribute("src"),
      img.getAttribute("data-src"),
      img.getAttribute("data-original"),
      img.getAttribute("data-lazy-src"),
    ];
    for (const raw of attrs) {
      if (!raw || raw.startsWith("data:")) continue;
      try {
        return new URL(raw, baseUrl).href;
      } catch {
        if (raw.startsWith("http")) return raw;
      }
    }
    const srcset = img.getAttribute("data-srcset") ?? img.getAttribute("srcset");
    if (srcset) {
      const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      const url = last?.split(/\s+/)[0];
      if (url) {
        try {
          return new URL(url, baseUrl).href;
        } catch {
          if (url.startsWith("http")) return url;
        }
      }
    }
    return null;
  }

  function normalizeWhitespace(text) {
    return (text ?? "").replace(/\s+/g, " ").trim();
  }

  function resolveBackgroundImageUrl(el, baseUrl) {
    if (!el) return null;
    const style = el.getAttribute("style") ?? "";
    let raw = null;
    const quoted = style.match(/url\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (quoted?.[1]) raw = quoted[1];
    else {
      const plain = style.match(/url\(\s*([^)]+)\s*\)/i);
      if (plain?.[1]) raw = plain[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (!raw) return null;
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return raw.startsWith("http") ? raw : null;
    }
  }

  function collectLinkListImages(scope, baseUrl) {
    const seen = new Set();
    const out = [];
    const push = (url) => {
      if (!url || seen.has(url) || isJunkImageUrl(url)) return;
      seen.add(url);
      out.push(url);
    };
    const processEl = (el) => {
      push(resolveBackgroundImageUrl(el, baseUrl));
      el.querySelectorAll("img").forEach((img) => push(resolveImageUrl(img, baseUrl)));
    };
    const linkSelector = ".link_list.img, .link_list, [class*='link_list']";
    const elements = [];
    if (typeof scope.matches === "function" && scope.matches(linkSelector)) {
      elements.push(scope);
    }
    scope.querySelectorAll(linkSelector).forEach((el) => elements.push(el));
    elements.forEach(processEl);
    return out;
  }

  /**
   * 본문에서 heading을 replace로 제거하면 「로마 수도교는…」→「는…」처럼 주어가 끊긴다.
   * 제목/부제는 앞에 붙이고, 조사로 시작하는 본문만 제목을 접두한다.
   */
  function finalizeScheduleDescription(heading, subtitle, body) {
    let text = normalizeWhitespace(body);
    const head = normalizeWhitespace(heading);
    const sub = normalizeWhitespace(subtitle);
    if (!text && sub) text = sub;
    if (!text) return head;
    if (head && /^[은는이가을를도와과의]/.test(text)) {
      text = `${head}${text}`;
    } else if (head && !text.includes(head)) {
      const lead = sub && sub !== head ? `${head} — ${sub}` : head;
      text = `${lead}. ${text}`;
    } else if (sub && sub !== head && !text.includes(sub)) {
      text = `${head ? `${head}. ` : ""}${sub}. ${text}`;
    }
    if (text.length > MAX_DESCRIPTION_LEN) text = text.slice(0, MAX_DESCRIPTION_LEN);
    return text;
  }

  function collectScheduleUnitSubtitle(unit) {
    const titSub = unit.querySelector("._tit_comt_sub, [class*='_tit_comt_sub']");
    if (titSub) {
      const parts = [];
      const main = titSub.querySelector("strong.tit, .tit")?.textContent?.trim();
      const spa = titSub.querySelector("p.spa, .spa, p")?.textContent?.trim();
      if (main) parts.push(main);
      if (spa && spa !== main) parts.push(spa);
      if (parts.length) return parts.join(" — ");
    }
    const divTitle = unit.querySelector(".div_title strong.tit, .div_title .tit");
    if (divTitle) {
      const t = divTitle.textContent?.trim();
      if (t) return t;
    }
    return "";
  }

  /**
   * 하나투어 일정 상세(schedule_detail) 실측 마크업:
   * info_section.cont_box > thumb_thumb > ul.img_list > li > img
   * 및 photo_area / img_list 변형.
   */
  function collectScheduleUnitImages(unit, baseUrl) {
    const contBox =
      unit.querySelector(".info_section.cont_box, .info_section.cont_boxs, [class*='info_section'][class*='cont_box']") ??
      unit;
    const galleryRoots = contBox.querySelectorAll(
      ".thumb_thumb ul.img_list, ul.img_list, .thumb_thumb, .photo_area, .img_list, [class*='img_list'], [class*='photo_area']",
    );
    const seen = new Set();
    const out = [];
    const pushImg = (img) => {
      const url = resolveImageUrl(img, baseUrl);
      if (!url || seen.has(url) || isJunkImageUrl(url)) return;
      seen.add(url);
      out.push(url);
    };
    if (galleryRoots.length > 0) {
      galleryRoots.forEach((root) => {
        root.querySelectorAll("img").forEach(pushImg);
      });
    }
    if (out.length === 0) {
      return collectImagesFromScope(contBox, baseUrl);
    }
    return out.slice(0, MAX_EVENT_IMAGES);
  }

  /**
   * 일정 설명: txt_cont / unit_txt_area / p.info_txt (스크린샷 실측).
   */
  function collectScheduleUnitDescription(unit, heading, subtitle) {
    const contBox =
      unit.querySelector(".info_section.cont_box, .info_section.cont_boxs, [class*='info_section'][class*='cont_box']") ??
      unit;
    const descSelectors = [
      ".txt_cont.txt_conts",
      ".txt_cont.txt_cont2",
      ".txt_cont",
      ".unit_txt_area",
      ".txt_part.txt_area",
      "p.info_txt",
      "[class*='txt_cont']",
      "[class*='unit_txt']",
      "[class*='info_txt']",
    ];
    for (const sel of descSelectors) {
      const nodes = contBox.querySelectorAll(sel);
      for (const node of nodes) {
        if (node.closest?.(".thumb_thumb, .img_list, .photo_area, ul.img_list, ._tit_comt_sub")) continue;
        const raw = getElementText(node).replace(/상세보기/g, "").trim();
        const text = finalizeScheduleDescription(heading, subtitle, raw);
        if (text.length >= 20) {
          return text.length > MAX_DESCRIPTION_LEN ? text.slice(0, MAX_DESCRIPTION_LEN) : text;
        }
      }
    }
    return "";
  }

  function collectImagesFromScope(scope, baseUrl) {
    const seen = new Set();
    const out = [];
    scope.querySelectorAll("img").forEach((img) => {
      const url = resolveImageUrl(img, baseUrl);
      if (!url || seen.has(url) || isJunkImageUrl(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out.slice(0, MAX_EVENT_IMAGES);
  }

  function findScheduleUnitHeading(unit) {
    const divTitle = unit.querySelector(".div_title strong.tit, .div_title .tit, .unit_tit");
    if (divTitle) {
      const t = normalizeWhitespace(divTitle.textContent ?? "");
      if (t && t.length <= 80 && !isSkippableTitle(t) && !SECTION_LABEL.test(t)) return t.slice(0, 300);
    }
    const titSub = unit.querySelector("._tit_comt_sub strong.tit, [class*='_tit_comt_sub'] strong.tit");
    if (titSub) {
      const t = normalizeWhitespace(titSub.textContent ?? "");
      if (t && t.length <= 80 && !isSkippableTitle(t)) return t.slice(0, 300);
    }
    const titleSelectors = [
      "[class*='card_tit']",
      "h3",
      "h4",
      "h5",
      "[class*='font-semibold']",
      "strong.tit",
      "strong",
    ];
    for (const sel of titleSelectors) {
      for (const el of unit.querySelectorAll(sel)) {
        if (el.closest?.(".txt_cont, .unit_txt_area, .thumb_thumb, .img_list, .photo_area, ._tit_comt_sub")) continue;
        const title = normalizeWhitespace(el.textContent ?? "");
        if (!title || title.length > 80 || isSkippableTitle(title)) continue;
        if (SECTION_LABEL.test(title) || MEAL_LINE.test(title)) continue;
        if (/^중세의|유네스코|역사지구/.test(title) && title.length > 40) continue;
        return title.slice(0, 300);
      }
    }
    const firstLine = getElementText(unit)
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length >= 2 && l.length <= 40 && !UI_SKIP.test(l) && !SECTION_LABEL.test(l));
    return firstLine?.slice(0, 300) ?? "";
  }

  function findScheduleUnitElements(panel) {
    const selectors = [
      ".schedule_detail .detail_unit",
      ".detail_unit",
      ".card_unit_type5",
      ".card_unit.type3",
      "[class*='card_unit']",
      ".day_info",
    ];
    const raw = [];
    const seen = new Set();
    for (const sel of selectors) {
      panel.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        // 너무 큰 래퍼(일차 전체) 제외: 하위에 동일 단위가 많으면 스킵
        if (el.querySelectorAll(".detail_unit, [class*='card_unit']").length > 2) return;
        const hasGallery = Boolean(
          el.querySelector(
            "ul.img_list, .thumb_thumb, .photo_area, .img_list, [class*='img_list']",
          ),
        );
        const hasDesc = Boolean(
          el.querySelector(
            ".txt_cont, .unit_txt_area, p.info_txt, [class*='txt_cont'], [class*='unit_txt']",
          ),
        );
        if (!hasGallery && !hasDesc) return;
        seen.add(el);
        raw.push(el);
      });
    }
    return dedupeSmallestCards(raw);
  }

  function extractScheduleUnitBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    for (const unit of findScheduleUnitElements(panel)) {
      const subtitle = collectScheduleUnitSubtitle(unit);
      const heading = findScheduleUnitHeading(unit) || subtitle.split(" — ")[0] || "";
      if (!heading || isSkippableTitle(heading)) continue;
      const rawDesc = collectScheduleUnitDescription(unit, heading, subtitle);
      const description =
        rawDesc ||
        finalizeScheduleDescription(heading, subtitle, getCardDescriptionText(unit, heading, true));
      const imageUrls = collectScheduleUnitImages(unit, baseUrl);
      if (!description && imageUrls.length === 0) continue;
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading,
        description,
        imageUrls,
        kind: "sightseeing",
        displayRole: "activity",
      });
    }
    return out;
  }

  function blockRichnessScore(block) {
    return (block.description?.trim().length ?? 0) + (block.imageUrls?.length ?? 0) * 200;
  }

  function mergePreferRicherBlock(existing, incoming) {
    if (blockRichnessScore(incoming) <= blockRichnessScore(existing)) {
      return {
        ...existing,
        description:
          (incoming.description?.trim().length ?? 0) > (existing.description?.trim().length ?? 0)
            ? incoming.description
            : existing.description,
        imageUrls:
          (incoming.imageUrls?.length ?? 0) > (existing.imageUrls?.length ?? 0)
            ? incoming.imageUrls
            : existing.imageUrls,
      };
    }
    return {
      ...incoming,
      description:
        (existing.description?.trim().length ?? 0) > (incoming.description?.trim().length ?? 0)
          ? existing.description
          : incoming.description,
      imageUrls:
        (existing.imageUrls?.length ?? 0) > (incoming.imageUrls?.length ?? 0)
          ? existing.imageUrls
          : incoming.imageUrls,
    };
  }

  function hasBorderAndRounded(el) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    return cls.includes("border") && cls.includes("rounded");
  }

  function hasDetailViewLink(el) {
    return Array.from(el.querySelectorAll("a")).some((a) => /상세보기/.test(a.textContent ?? ""));
  }

  function isSkippableTitle(title) {
    if (!title) return true;
    if (UI_SKIP.test(title)) return true;
    if (title === "상세보기") return true;
    return false;
  }

  function dedupeSmallestCards(candidates) {
    return candidates.filter((el, i) => {
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        if (el.contains(candidates[j]) && el !== candidates[j]) return false;
      }
      return true;
    });
  }

  function getCardDescriptionText(card, title, skipTitleStrip) {
    const subtitle = collectScheduleUnitSubtitle(card);
    const structured = collectScheduleUnitDescription(card, title, subtitle);
    if (structured) return structured;
    let text = getElementText(card);
    if (title && !skipTitleStrip) text = text.replace(title, "");
    text = text.replace(/상세보기/g, "").trim();
    text = finalizeScheduleDescription(title, subtitle, text);
    if (text.length > MAX_DESCRIPTION_LEN) {
      text = text.slice(0, MAX_DESCRIPTION_LEN);
    }
    return text;
  }

  const HOTEL_LINK_SELECTOR =
    ".link_list.ing, .link_list.img, .link_list[class*='link_list'], .link_list";
  const HOTEL_ADVISORY_HEADING_RE = /총\s*\d+\s*개의[\s\S]*예정\s*호텔/;
  const HOTEL_MARKETING_HEADING_RE =
    /^(🏡|전\s*일정\s*\d+성\s*호텔|타사\s*예정\s*호텔|'더욱'\s*특별한\s*호텔)/;

  function sanitizeHotelText(text) {
    return normalizeWhitespace((text ?? "").replace(/상세보기/g, ""));
  }

  function getTextWithoutDetailLinks(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll("a").forEach((a) => {
      if (/상세보기/.test(a.textContent ?? "")) a.remove();
    });
    return sanitizeHotelText(clone.textContent ?? "");
  }

  function isHotelAdvisoryHeading(title) {
    const t = sanitizeHotelText(title);
    if (!t) return false;
    if (HOTEL_ADVISORY_HEADING_RE.test(t)) return true;
    if (HOTEL_MARKETING_HEADING_RE.test(t)) return true;
    if (/엄선된.*성\s*호텔/.test(t) && t.length < 80) return true;
    return false;
  }

  function isHotelMarketingBlurb(text) {
    const t = sanitizeHotelText(text);
    if (!t || t.length > 500) return false;
    if (/🏡/.test(t) && /성\s*호텔/.test(t)) return true;
    if (/타사\s*예정\s*호텔\s*비교/.test(t)) return true;
    if (/시내\s*호텔\s*숙박으로\s*일정이\s*끝난\s*후/.test(t)) return true;
    return false;
  }

  function parseStarRatingFromWidth(el) {
    if (!el) return null;
    const style = el.getAttribute("style") ?? "";
    const match = style.match(/width\s*:\s*([\d.]+)\s*%/i);
    if (!match) return null;
    const pct = Number(match[1]);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return Math.min(5, Math.max(1, Math.round(pct / 20)));
  }

  function parseHotelCardEntry(link) {
    const name = sanitizeHotelText(
      link.querySelector("strong.tit, strong.tit_bg, .tit_bg, .tit")?.textContent,
    );
    if (!name) return null;
    const english = getTextWithoutDetailLinks(link.querySelector("p.stxt2, .stxt2"));
    const stars = parseStarRatingFromWidth(link.querySelector("span.star_value, .star_value"));
    const starLabel = stars ? `${stars}성` : "";
    const parts = [name];
    if (starLabel) parts.push(starLabel);
    if (english && english !== name) parts.push(english);
    return { name, line: parts.join(" — "), english, stars };
  }

  function collectHotelAdvisoryLines(scope) {
    const lines = [];
    const titHotel = scope.querySelector(".tit_hotel");
    if (titHotel) {
      const advisory = getTextWithoutDetailLinks(titHotel);
      if (advisory) lines.push(advisory);
    }
    const scopeText = sanitizeHotelText(getElementText(scope));
    const introMatch = scopeText.match(/총\s*\d+\s*개의[\s\S]*?예정\s*호텔이\s*있습니다\.?/);
    if (introMatch) {
      const intro = normalizeWhitespace(introMatch[0]);
      if (!lines.some((l) => l.includes("총") && l.includes("예정 호텔"))) lines.push(intro);
    }
    const confirmMatch = scopeText.match(/출발\s*3일\s*전까지[\s\S]*?확인하실\s*수\s*있습니다\.?/);
    if (confirmMatch) {
      const confirm = normalizeWhitespace(confirmMatch[0]);
      if (!lines.some((l) => l.includes("출발 3일"))) lines.push(confirm);
    }
    return lines;
  }

  function findHotelSectionRoots(panel) {
    const roots = [];
    const seen = new Set();
    const push = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      roots.push(el);
    };
    panel.querySelectorAll('[data-title="호텔"]').forEach((el) => push(el.closest(".is_acc") ?? el));
    panel.querySelectorAll('[id*="add_hotel"]').forEach((el) => {
      const section =
        el.closest(".additional_area") ??
        el.closest(".is_acc") ??
        el.parentElement;
      push(section);
    });
    panel.querySelectorAll(".tit_hotel").forEach((tit) => {
      const section =
        tit.closest(".additional_area") ??
        tit.closest(".is_acc") ??
        tit.parentElement;
      push(section);
    });
    return roots;
  }

  function isInsideHotelSection(el) {
    if (!el) return false;
    if (
      el.closest?.(
        '[data-title="호텔"], [id*="add_hotel"], .tit_hotel, .additional_list, .additional_area',
      )
    ) {
      return true;
    }
    if (el.matches?.(HOTEL_LINK_SELECTOR) || el.closest?.(HOTEL_LINK_SELECTOR)) return true;
    return false;
  }

  /**
   * 호텔 섹션 실측:
   * .tit_hotel (안내 문구) + #add_hotel_*_view > .additional_list > .link_list.ing
   */
  function extractHanatourHotelBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const seenSections = new Set();

    for (const section of findHotelSectionRoots(panel)) {
      if (seenSections.has(section)) continue;
      const listRoot =
        section.querySelector('[id*="add_hotel"], .additional_list') ?? section;
      const links = listRoot.querySelectorAll(HOTEL_LINK_SELECTOR);
      if (!links.length) continue;
      seenSections.add(section);

      const imageUrls = [];
      const hotelLines = [];
      const hotelNames = [];
      links.forEach((link) => {
        const entry = parseHotelCardEntry(link);
        if (!entry) return;
        hotelNames.push(entry.name);
        hotelLines.push(entry.line);
        collectLinkListImages(link, baseUrl).forEach((url) => {
          if (!imageUrls.includes(url)) imageUrls.push(url);
        });
      });

      const advisoryScope = section.querySelector(".tit_hotel")?.parentElement ?? section;
      const lines = collectHotelAdvisoryLines(advisoryScope);
      for (const line of hotelLines) {
        if (!lines.includes(line)) lines.push(line);
      }

      const description = lines.join("\n").trim();
      if (!description && hotelNames.length === 0) continue;

      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading: "호텔",
        description: description || hotelNames.join(", "),
        imageUrls: imageUrls.slice(0, MAX_EVENT_IMAGES),
        kind: "other",
        displayRole: "summary",
      });
      break;
    }
    return out;
  }

  function findSightseeingCardElements(panel) {
    const raw = [];
    panel.querySelectorAll("div, section, article").forEach((el) => {
      if (isInsideHotelSection(el)) return;
      const hasDetail = hasDetailViewLink(el);
      const bordered = hasBorderAndRounded(el);
      if (!hasDetail && !bordered) return;

      const titleEl =
        el.querySelector('[class*="font-semibold"]') ??
        el.querySelector("strong, h3, h4, h5");
      if (!titleEl) return;
      const title = titleEl.textContent?.trim() ?? "";
      if (!title || title.length > 80 || isSkippableTitle(title)) return;
      if (SECTION_LABEL.test(title) || MEAL_LINE.test(title)) return;
      if (isHotelAdvisoryHeading(title)) return;
      const textLen = getElementText(el).length;
      if (!hasDetail && textLen < 20) return;
      raw.push(el);
    });
    return dedupeSmallestCards(raw);
  }

  function parseDayMetaFromPanel(panel, dayNumber) {
    const headerCandidates = panel.querySelectorAll("h2, h3, h4, h5, strong, [class*='title']");
    for (const el of headerCandidates) {
      const text = getElementText(el);
      if (!text.includes(`${dayNumber}일차`) && !text.includes("일차")) continue;
      const dateMatch = text.match(DATE_IN_HEADER);
      const title = text
        .replace(/\d+일차/g, "")
        .replace(DATE_IN_HEADER, "")
        .trim();
      return {
        day: dayNumber,
        dateText: dateMatch?.[1] ?? dateMatch?.[0],
        dayTitle: title || `${dayNumber}일차`,
      };
    }
    const bodyText = getElementText(panel).slice(0, 200);
    const dateMatch = bodyText.match(DATE_IN_HEADER);
    return {
      day: dayNumber,
      dateText: dateMatch?.[1] ?? dateMatch?.[0],
      dayTitle: `${dayNumber}일차`,
    };
  }

  function extractSightseeingBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const cards = findSightseeingCardElements(panel);
    for (const card of cards) {
      const titleEl =
        card.querySelector('[class*="font-semibold"]') ??
        card.querySelector("strong, h3, h4, h5");
      const heading = titleEl?.textContent?.trim()?.slice(0, 300) ?? "";
      if (!heading || isSkippableTitle(heading)) continue;
      if (isHotelAdvisoryHeading(heading)) continue;
      const description = getCardDescriptionText(card, heading);
      if (isHotelMarketingBlurb(description)) continue;
      const imageUrls = (() => {
        const structured = collectScheduleUnitImages(card, baseUrl);
        if (structured.length > 0) return structured;
        return collectImagesFromScope(card, baseUrl);
      })();
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading,
        description,
        imageUrls,
        kind: "sightseeing",
      });
    }
    return out;
  }

  function extractNoticeBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const noticeHeaders = ["출입국 정보", "예약 전 유의사항", "유의사항", "안내사항"];
    const seen = new Set();

    panel.querySelectorAll("div, section, article").forEach((block) => {
      const raw = getElementText(block);
      if (raw.length < 20 || raw.length > 12000) return;
      for (const header of noticeHeaders) {
        if (!raw.startsWith(header) && !raw.includes(header)) continue;
        const key = `${dayMeta.day}::${header}`;
        if (seen.has(key)) break;
        const rest = raw.replace(header, "").replace(/상세보기/g, "").trim();
        if (rest.length < 10) break;
        const imageUrls = collectImagesFromScope(block, baseUrl);
        out.push({
          day: dayMeta.day,
          dateText: dayMeta.dateText,
          dayTitle: dayMeta.dayTitle,
          heading: header,
          description: rest.length > MAX_DESCRIPTION_LEN ? rest.slice(0, MAX_DESCRIPTION_LEN) : rest,
          imageUrls,
          kind: "notice",
        });
        seen.add(key);
        break;
      }
    });
    return out;
  }

  function kindFromSectionLabel(label) {
    if (label === "식사") return "meal";
    if (label === "항공") return "move";
    return "other";
  }

  function displayRoleFromSectionLabel(label) {
    if (label === "항공") return "activity";
    return "summary";
  }

  function extractSectionLabelBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const sectionLabels = ["예정호텔", "호텔", "식사", "항공"];
    const seen = new Set();

    panel.querySelectorAll("div, section, article, li").forEach((block) => {
      if (isInsideHotelSection(block)) return;
      const raw = getElementText(block).trim();
      if (raw.length < 8 || raw.length > 3000) return;
      if (isHotelMarketingBlurb(raw)) return;
      for (const label of sectionLabels) {
        if (!raw.startsWith(label)) continue;
        const rest = raw.slice(label.length).replace(/상세보기/g, "").trim();
        if (rest.length < 3) continue;
        if (label === "호텔" && HOTEL_ADVISORY_HEADING_RE.test(rest)) continue;
        const key = `${dayMeta.day}::${label}::${rest.slice(0, 40)}`;
        if (seen.has(key)) break;
        seen.add(key);
        out.push({
          day: dayMeta.day,
          dateText: dayMeta.dateText,
          dayTitle: dayMeta.dayTitle,
          heading: label,
          description: rest.length > MAX_DESCRIPTION_LEN ? rest.slice(0, MAX_DESCRIPTION_LEN) : rest,
          imageUrls: collectImagesFromScope(block, baseUrl),
          kind: kindFromSectionLabel(label),
          displayRole: displayRoleFromSectionLabel(label),
        });
        break;
      }
    });
    return out;
  }

  function extractMealLineBlocks(panel, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const seen = new Set();
    const lines = getElementText(panel)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 2 && l.length <= 80);

    for (const line of lines) {
      if (UI_SKIP.test(line) || /^\d+일차/.test(line)) continue;
      if (!MEAL_LINE.test(line)) continue;
      const heading = line.slice(0, 300);
      if (seen.has(heading)) continue;
      seen.add(heading);
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading,
        description: "",
        imageUrls: [],
        kind: "meal",
        displayRole: /^기내/.test(heading) ? "activity" : "summary",
      });
    }
    return out;
  }

  function getTimelineTitleEl(contentRoot) {
    return (
      contentRoot.querySelector('div[class*="text-[17px]"][class*="font-semibold"]') ??
      contentRoot.querySelector('[class*="font-semibold"]') ??
      contentRoot.querySelector("strong, h3, h4, h5")
    );
  }

  function isLikelyLocationTitle(title) {
    const t = title.trim();
    if (t.length < 2 || t.length > 20) return false;
    if (SECTION_LABEL.test(t)) return false;
    if (MEAL_LINE.test(t)) return false;
    if (/^\d+일차/.test(t)) return false;
    if (/출입국|유의사항|예약\s*전/.test(t)) return false;
    if (isSkippableTitle(t)) return false;
    return true;
  }

  function collectTimelineRows(panel) {
    const out = [];
    const candidates = panel.querySelectorAll(
      'div[class*="flex"][class*="items-stretch"], div[class*="flex"][class*="items-start"]',
    );
    for (const el of candidates) {
      const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
      if (cls.includes("space-x-[6px]") || cls.includes("space-x-[12px]")) {
        out.push(el);
      }
    }
    return out;
  }

  function getTimelineRowText(contentRoot) {
    const titleEl = getTimelineTitleEl(contentRoot);
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();
    const text = getElementText(contentRoot).trim();
    const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
    return firstLine ?? "";
  }

  function extractLocationBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const rows = collectTimelineRows(panel);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const contentRoot =
        row.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
        row.querySelector('div[class*="calc(100%"]') ??
        row;
      const title = getTimelineRowText(contentRoot).slice(0, 300);
      if (!isLikelyLocationTitle(title)) continue;

      const descriptions = [];
      for (let j = i + 1; j < rows.length; j++) {
        const nextRow = rows[j];
        const nextRoot =
          nextRow.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
          nextRow.querySelector('div[class*="calc(100%"]') ??
          nextRow;
        const nextTitle = getTimelineRowText(nextRoot);
        if (isLikelyLocationTitle(nextTitle)) break;
        if (!nextTitle || nextTitle.length > 120) continue;
        if (UI_SKIP.test(nextTitle)) continue;
        descriptions.push(nextTitle);
      }

      // 타임라인 행 근처 schedule unit 마크업이 있으면 설명·이미지 보강
      const nearbyUnit =
        contentRoot.closest?.(".detail_unit, [class*='card_unit'], .day_info") ?? contentRoot;
      const subtitle = collectScheduleUnitSubtitle(nearbyUnit);
      const structuredDesc = collectScheduleUnitDescription(nearbyUnit, title, subtitle);
      const description =
        structuredDesc || finalizeScheduleDescription(title, subtitle, descriptions.join("\n"));
      const imageUrls = collectScheduleUnitImages(nearbyUnit, baseUrl);
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading: title,
        description: description.length > MAX_DESCRIPTION_LEN ? description.slice(0, MAX_DESCRIPTION_LEN) : description,
        imageUrls,
        kind: "other",
        displayRole: "activity",
      });
    }
    return out;
  }

  function parseBlocksFromPanel(panel, baseUrl, dayNumber) {
    const dayMeta = parseDayMetaFromPanel(panel, dayNumber);
    // schedule_detail / card_unit 실측 마크업을 최우선 (사진·설명 배치)
    const scheduleUnits = extractScheduleUnitBlocks(panel, baseUrl, dayMeta);
    const hotels = extractHanatourHotelBlocks(panel, baseUrl, dayMeta);
    const sightseeing = extractSightseeingBlocks(panel, baseUrl, dayMeta).filter(
      (b) => !isHotelAdvisoryHeading(b.heading) && !isHotelMarketingBlurb(b.description),
    );
    const notice = extractNoticeBlocks(panel, baseUrl, dayMeta);
    const section = extractSectionLabelBlocks(panel, baseUrl, dayMeta).filter(
      (b) => b.heading !== "호텔" || hotels.length === 0,
    );
    const meals = extractMealLineBlocks(panel, dayMeta);
    const locations = extractLocationBlocks(panel, baseUrl, dayMeta);

    const byHeading = new Map();
    for (const block of [...scheduleUnits, ...hotels, ...sightseeing, ...notice, ...section, ...meals, ...locations]) {
      const key = `${block.day}::${block.heading}`;
      const existing = byHeading.get(key);
      if (!existing) {
        byHeading.set(key, block);
        continue;
      }
      if (block.kind === "notice" && existing.kind !== "notice") {
        byHeading.set(key, block);
        continue;
      }
      byHeading.set(key, mergePreferRicherBlock(existing, block));
    }
    return Array.from(byHeading.values());
  }

  function countUniqueHeadings(blocks) {
    const set = new Set(blocks.map((b) => `${b.day}::${b.heading}`));
    return set.size;
  }

  function countUniqueDays(blocks) {
    return new Set(blocks.filter((b) => b.day && b.day > 0).map((b) => b.day)).size;
  }

  function scoreBlocks(blocks) {
    const withDay = blocks.filter((b) => b.day && b.day > 0);
    const uniqueDays = countUniqueDays(withDay);
    return uniqueDays * 100 + withDay.length * 10 + countUniqueHeadings(withDay);
  }

  function mergeBlocksPreferringTabs(accordionBlocks, tabBlocks) {
    const seen = new Set();
    const merged = [];
    for (const block of [...tabBlocks, ...accordionBlocks]) {
      if (!block.day || block.day < 1) continue;
      const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(block);
    }
    return merged;
  }

  function pickBetterBlocks(a, b) {
    const scoreA = scoreBlocks(a);
    const scoreB = scoreBlocks(b);
    if (scoreB > scoreA) return b;
    if (scoreA > scoreB) return a;
    return b.length >= a.length ? b : a;
  }

  function buildBlockCountByDay(blocks) {
    const counts = {};
    for (const block of blocks) {
      if (!block.day) continue;
      counts[block.day] = (counts[block.day] ?? 0) + 1;
    }
    return Object.keys(counts)
      .map(Number)
      .sort((x, y) => x - y)
      .map((day) => counts[day]);
  }

  async function extractFromAccordionPath(doc, baseUrl, ui, onProgress) {
    const entries = ui.findDayAccordionEntries(doc);
    const blocks = [];
    let accordionsExpanded = 0;

    for (const entry of entries) {
      onProgress?.(entry.dayNumber);
      accordionsExpanded += await ui.expandAccordionsIn(entry.panelEl);
      await ui.waitForPanelStable(entry.panelEl);
      await ui.scrollPanelToLoadLazy(entry.panelEl);
      blocks.push(...parseBlocksFromPanel(entry.panelEl, baseUrl, entry.dayNumber));
    }

    return {
      blocks,
      dayTabsFound: entries.length,
      dayTabsClicked: 0,
      accordionsExpanded,
      extractionPath: "accordions",
    };
  }

  async function extractFromTabPath(doc, baseUrl, ui, onProgress) {
    const dayTabs = ui.collectAllDaySubTabs
      ? await ui.collectAllDaySubTabs(doc)
      : ui.findDaySubTabs(doc);
    const blocks = [];
    let dayTabsClicked = 0;
    let accordionsExpanded = 0;

    for (const tab of dayTabs) {
      onProgress?.(tab.dayNumber);
      const panel = await ui.activateDayTab(tab, doc);
      if (!panel) continue;
      dayTabsClicked += 1;
      accordionsExpanded += await ui.expandAccordionsIn(panel);
      await ui.waitForPanelStable(panel);
      await ui.scrollPanelToLoadLazy(panel);
      blocks.push(...parseBlocksFromPanel(panel, baseUrl, tab.dayNumber));
    }

    return {
      blocks,
      dayTabsFound: dayTabs.length,
      dayTabsClicked,
      accordionsExpanded,
      extractionPath: "tabs",
    };
  }

  /**
   * @param {Document} doc
   * @param {{ onDayProgress?: (day: number) => void }} [options]
   */
  async function extractItineraryBlocksAsync(doc, options) {
    const ui = getUiPrep();
    if (!ui) {
      return { blocks: [], meta: { extractionPath: "none", error: "ui_prep_missing" } };
    }

    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const onProgress = options?.onDayProgress;

    const accordionResult = await extractFromAccordionPath(doc, baseUrl, ui, onProgress);
    const tabResult = await extractFromTabPath(doc, baseUrl, ui, onProgress);

    const merged = mergeBlocksPreferringTabs(accordionResult.blocks, tabResult.blocks);
    const accordionDays = countUniqueDays(accordionResult.blocks);
    const tabDays = countUniqueDays(tabResult.blocks);
    const chosen =
      merged.length > 0
        ? merged
        : pickBetterBlocks(accordionResult.blocks, tabResult.blocks);

    const usedTabPath = tabResult.blocks.length > 0;
    const usedAccordionPath = accordionResult.blocks.length > 0;
    let extractionPath = "none";
    if (usedTabPath && usedAccordionPath) extractionPath = "tabs+accordions";
    else if (usedTabPath) extractionPath = "tabs";
    else if (usedAccordionPath) extractionPath = "accordions";

    const resultMeta =
      tabDays >= accordionDays && tabResult.blocks.length > 0 ? tabResult : accordionResult;
    const seenKeys = new Set();
    const deduped = [];
    for (const block of chosen) {
      if (!block.day || block.day < 1) continue;
      const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(block);
    }

    const finalUniqueDays = new Set(deduped.filter((b) => b.day > 0).map((b) => b.day));
    const minDayFound = finalUniqueDays.size > 0 ? Math.min(...finalUniqueDays) : 0;
    if (minDayFound > 1) {
      // 진단용 경고: 1일차보다 큰 일차만 수집된 경우(예: 2,3일차만 수집되고 1일차 누락).
      console.warn(
        `[thealltour-import] 1일차가 누락된 것으로 보입니다. 수집된 최소 일차=${minDayFound}, ` +
          `발견된 일차=${[...finalUniqueDays].sort((a, b) => a - b).join(",")}`,
      );
    }

    return {
      blocks: deduped,
      meta: {
        extractionPath,
        dayTabsFound: Math.max(accordionResult.dayTabsFound, tabResult.dayTabsFound),
        dayTabsClicked: tabResult.dayTabsClicked,
        accordionsExpanded:
          accordionResult.accordionsExpanded + tabResult.accordionsExpanded,
        blockCountByDay: buildBlockCountByDay(deduped),
        uniqueDays: countUniqueDays(deduped),
        totalBlocks: deduped.length,
        minDayFound,
      },
    };
  }

  /** @deprecated sync — use extractItineraryBlocksAsync */
  function extractItineraryBlocks(doc) {
    const ui = getUiPrep();
    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const blocks = [];
    const seenKeys = new Set();

    const entries = ui?.findDayAccordionEntries?.(doc) ?? [];
    for (const entry of entries) {
      for (const block of parseBlocksFromPanel(entry.panelEl, baseUrl, entry.dayNumber)) {
        const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        blocks.push(block);
      }
    }
    return blocks;
  }

  global.ItineraryDomExtract = {
    extractItineraryBlocks,
    extractItineraryBlocksAsync,
    parseBlocksFromPanel,
    MAX_EVENT_IMAGES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
