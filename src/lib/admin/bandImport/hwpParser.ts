import "server-only";

import { inflateRawSync, inflateSync } from "node:zlib";
import JSZip from "jszip";
import { read, type Paragraph, type Table } from "hwpx-js";

export const MAX_HWP_FILE_BYTES = 20 * 1024 * 1024;

export class HwpParseError extends Error {
  readonly httpStatus: 400;

  constructor(message: string) {
    super(message);
    this.name = "HwpParseError";
    this.httpStatus = 400;
  }
}

const ZIP_MAGIC = [0x50, 0x4b];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function hasPrefix(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, "&");
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function localNameTagRe(localName: string, flags = "gi"): RegExp {
  return new RegExp(`<(?:[A-Za-z0-9._-]+:)?${localName}(?=[\\s/>])`, flags);
}

function localNameCloseRe(localName: string, flags = "gi"): RegExp {
  return new RegExp(`</(?:[A-Za-z0-9._-]+:)?${localName}\\s*>`, flags);
}

function findTag(xml: string, from: number, localName: string): number {
  const re = localNameTagRe(localName);
  re.lastIndex = from;
  const match = re.exec(xml);
  return match ? match.index : -1;
}

function sliceElement(
  xml: string,
  start: number,
  localName: string,
): { inner: string; end: number } | null {
  const openEnd = xml.indexOf(">", start);
  if (openEnd < 0) return null;
  if (xml[openEnd - 1] === "/") {
    return { inner: "", end: openEnd + 1 };
  }

  const openRe = localNameTagRe(localName);
  const closeRe = localNameCloseRe(localName);
  let depth = 1;
  let pos = openEnd + 1;

  while (depth > 0 && pos < xml.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const openMatch = openRe.exec(xml);
    const closeMatch = closeRe.exec(xml);
    if (!closeMatch) return null;

    if (openMatch && openMatch.index < closeMatch.index) {
      const oe = xml.indexOf(">", openMatch.index);
      if (oe > 0 && xml[oe - 1] === "/") {
        pos = oe + 1;
        continue;
      }
      depth += 1;
      pos = openMatch.index + openMatch[0].length;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return {
        inner: xml.slice(openEnd + 1, closeMatch.index),
        end: closeMatch.index + closeMatch[0].length,
      };
    }
    pos = closeMatch.index + closeMatch[0].length;
  }

  return null;
}

function extractTable(tblInner: string): string {
  const rows: string[] = [];
  let i = 0;
  while (i < tblInner.length) {
    const trStart = findTag(tblInner, i, "tr");
    if (trStart < 0) break;
    const tr = sliceElement(tblInner, trStart, "tr");
    if (!tr) break;

    const cells: string[] = [];
    let j = 0;
    while (j < tr.inner.length) {
      const tcStart = findTag(tr.inner, j, "tc");
      if (tcStart < 0) break;
      const tc = sliceElement(tr.inner, tcStart, "tc");
      if (!tc) break;
      cells.push(extractMixedXml(tc.inner).replace(/\n+/g, " ").trim());
      j = tc.end;
    }
    rows.push(cells.join("\t"));
    i = tr.end;
  }
  return rows.join("\n");
}

function extractMixedXml(xml: string): string {
  const lines: string[] = [];
  let pending = "";
  let i = 0;

  const flushPending = () => {
    const trimmed = pending.replace(/\s+/g, " ").trim();
    if (trimmed) lines.push(trimmed);
    pending = "";
  };

  while (i < xml.length) {
    const tblAt = findTag(xml, i, "tbl");
    const tAt = findTag(xml, i, "t");
    const rest = xml.slice(i);
    const pCloseRel = rest.search(/<\/(?:[A-Za-z0-9._-]+:)?p\s*>/i);
    const pCloseAt = pCloseRel >= 0 ? i + pCloseRel : -1;

    const next = [
      { at: tblAt, kind: "tbl" as const },
      { at: tAt, kind: "t" as const },
      { at: pCloseAt, kind: "pclose" as const },
    ]
      .filter((item) => item.at >= 0)
      .sort((a, b) => a.at - b.at)[0];

    if (!next) break;

    if (next.kind === "pclose") {
      flushPending();
      const gt = xml.indexOf(">", next.at);
      i = gt >= 0 ? gt + 1 : next.at + 1;
      continue;
    }

    if (next.kind === "tbl") {
      flushPending();
      const el = sliceElement(xml, next.at, "tbl");
      if (!el) break;
      const tableText = extractTable(el.inner);
      if (tableText.trim()) lines.push(tableText);
      i = el.end;
      continue;
    }

    const el = sliceElement(xml, next.at, "t");
    if (!el) break;
    pending += decodeXmlEntities(el.inner.replace(/<[^>]+>/g, ""));
    i = el.end;
  }

  flushPending();
  return lines.join("\n");
}

function listHwpxSectionPaths(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => {
      const normalized = name.replace(/\\/g, "/");
      return /contents\/section\d+\.xml$/i.test(normalized);
    })
    .sort((a, b) => {
      const na = Number(a.match(/section(\d+)/i)?.[1] ?? 0);
      const nb = Number(b.match(/section(\d+)/i)?.[1] ?? 0);
      return na - nb;
    });
}

export async function extractTextFromHwpx(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new HwpParseError(
      "HWPX 파일을 열 수 없습니다. 손상되지 않은 .hwpx 파일인지 확인해 주세요.",
    );
  }

  const sectionPaths = listHwpxSectionPaths(zip);
  if (sectionPaths.length === 0) {
    throw new HwpParseError(
      "HWPX 안에서 본문(section XML)을 찾지 못했습니다. 한글에서 .hwpx로 다시 저장해 주세요.",
    );
  }

  const parts: string[] = [];
  for (const path of sectionPaths) {
    const xml = await zip.file(path)?.async("string");
    if (!xml?.trim()) continue;
    const text = extractMixedXml(xml);
    if (text.trim()) parts.push(text);
  }

  const combined = normalizeExtractedText(parts.join("\n\n"));
  if (!combined) {
    throw new HwpParseError(
      "텍스트를 추출하지 못했습니다. 한글에서 .hwpx로 저장한 뒤 다시 올려주세요.",
    );
  }
  return combined;
}

function paragraphsToText(paragraphs: Paragraph[]): string {
  const lines: string[] = [];
  for (const para of paragraphs) {
    const textParts: string[] = [];
    for (const run of para.runs ?? []) {
      if (run.t === "text") {
        textParts.push(run.text ?? "");
        continue;
      }
      if (run.t === "table") {
        const pending = textParts.join("").trim();
        if (pending) {
          lines.push(pending);
          textParts.length = 0;
        }
        const tableText = tableToText(run.table);
        if (tableText.trim()) lines.push(tableText);
        continue;
      }
      if (run.t === "break" && run.breakType === "LINE") {
        textParts.push("\n");
      }
    }
    const line = textParts.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function tableToText(table: Table): string {
  return (table.rows ?? [])
    .map((row) =>
      (row.cells ?? [])
        .map((cell) => paragraphsToText(cell.paragraphs ?? []).replace(/\n+/g, " ").trim())
        .join("\t"),
    )
    .join("\n");
}

const CFB_ENDOFCHAIN = 0xfffffffe;
const CFB_FREESECT = 0xffffffff;
const HWPTAG_PARA_TEXT = 0x43;

type CfbHeader = {
  sectorSize: number;
  miniSectorSize: number;
  miniStreamCutoff: number;
  firstDirSector: number;
  numFatSectors: number;
  firstDifatSector: number;
  numDifatSectors: number;
  firstMiniFatSector: number;
  numMiniFatSectors: number;
};

type CfbDirEntry = {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  startSector: number;
  streamSize: number;
};

export type HwpBinaryFallbackResult = {
  text: string;
  protected: boolean;
};

function readCfbHeader(buffer: Buffer): CfbHeader | null {
  if (buffer.length < 512 || !hasPrefix(buffer, OLE_MAGIC)) return null;
  if (buffer.readUInt16LE(0x1c) !== 0xfffe) return null;
  const sectorShift = buffer.readUInt16LE(0x1e);
  const miniSectorShift = buffer.readUInt16LE(0x20);
  if (sectorShift !== 9 && sectorShift !== 12) return null;
  return {
    sectorSize: 1 << sectorShift,
    miniSectorSize: 1 << miniSectorShift,
    miniStreamCutoff: buffer.readUInt32LE(0x38) || 4096,
    firstDirSector: buffer.readUInt32LE(0x30),
    numFatSectors: buffer.readUInt32LE(0x2c),
    firstDifatSector: buffer.readUInt32LE(0x44),
    numDifatSectors: buffer.readUInt32LE(0x48),
    firstMiniFatSector: buffer.readUInt32LE(0x3c),
    numMiniFatSectors: buffer.readUInt32LE(0x40),
  };
}

function cfbSectorOffset(sectorId: number, sectorSize: number): number {
  return (sectorId + 1) * sectorSize;
}

function readCfbSector(buffer: Buffer, header: CfbHeader, sectorId: number): Buffer | null {
  const offset = cfbSectorOffset(sectorId, header.sectorSize);
  if (offset < 0 || offset >= buffer.length) return null;
  return buffer.subarray(offset, Math.min(offset + header.sectorSize, buffer.length));
}

function buildCfbFat(buffer: Buffer, header: CfbHeader): number[] {
  const difat: number[] = [];
  for (let i = 0; i < 109; i += 1) {
    difat.push(buffer.readUInt32LE(0x4c + i * 4));
  }
  let difatSect = header.firstDifatSector;
  for (let n = 0; n < header.numDifatSectors && difatSect < CFB_ENDOFCHAIN; n += 1) {
    const sector = readCfbSector(buffer, header, difatSect);
    if (!sector) break;
    const entries = Math.floor(sector.length / 4);
    for (let i = 0; i < entries - 1; i += 1) {
      difat.push(sector.readUInt32LE(i * 4));
    }
    difatSect = sector.readUInt32LE((entries - 1) * 4);
  }

  const fat: number[] = [];
  for (const fatSecId of difat) {
    if (fatSecId >= CFB_ENDOFCHAIN) continue;
    const sector = readCfbSector(buffer, header, fatSecId);
    if (!sector) continue;
    for (let i = 0; i < Math.floor(sector.length / 4); i += 1) {
      fat.push(sector.readUInt32LE(i * 4));
    }
  }
  return fat;
}

function readCfbChain(
  buffer: Buffer,
  fat: number[],
  startSector: number,
  sectorSize: number,
  byteCount: number,
): Buffer {
  const chunks: Buffer[] = [];
  let sid = startSector;
  let remaining = Math.max(0, byteCount);
  const seen = new Set<number>();
  while (sid < CFB_ENDOFCHAIN && remaining > 0 && !seen.has(sid)) {
    seen.add(sid);
    const offset = cfbSectorOffset(sid, sectorSize);
    if (offset >= buffer.length) break;
    const take = Math.min(sectorSize, remaining, buffer.length - offset);
    chunks.push(buffer.subarray(offset, offset + take));
    remaining -= take;
    sid = fat[sid] ?? CFB_ENDOFCHAIN;
  }
  return Buffer.concat(chunks);
}

function parseCfbDirEntries(dirData: Buffer): CfbDirEntry[] {
  const entries: CfbDirEntry[] = [];
  for (let offset = 0; offset + 128 <= dirData.length; offset += 128) {
    const nameLen = dirData.readUInt16LE(offset + 0x40);
    const nameBytes = Math.max(0, Math.min(64, nameLen - 2));
    const name = nameBytes > 0 ? dirData.toString("utf16le", offset, offset + nameBytes) : "";
    entries.push({
      name,
      type: dirData.readUInt8(offset + 0x42),
      left: dirData.readUInt32LE(offset + 0x44),
      right: dirData.readUInt32LE(offset + 0x48),
      child: dirData.readUInt32LE(offset + 0x4c),
      startSector: dirData.readUInt32LE(offset + 0x74),
      streamSize: Number(dirData.readBigUInt64LE(offset + 0x78)),
    });
  }
  return entries;
}

function walkCfbTree(
  entries: CfbDirEntry[],
  index: number,
  prefix: string,
  out: Array<CfbDirEntry & { path: string }>,
  seen: Set<number>,
) {
  if (index < 0 || index >= entries.length || seen.has(index)) return;
  seen.add(index);
  const entry = entries[index];
  if (entry.left !== CFB_FREESECT) walkCfbTree(entries, entry.left, prefix, out, seen);
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.name) out.push({ ...entry, path });
  if (entry.child !== CFB_FREESECT) walkCfbTree(entries, entry.child, path, out, seen);
  if (entry.right !== CFB_FREESECT) walkCfbTree(entries, entry.right, prefix, out, seen);
}

function readMiniFat(buffer: Buffer, header: CfbHeader, fat: number[]): number[] {
  const miniFatData = readCfbChain(
    buffer,
    fat,
    header.firstMiniFatSector,
    header.sectorSize,
    header.numMiniFatSectors * header.sectorSize,
  );
  const miniFat: number[] = [];
  for (let i = 0; i + 4 <= miniFatData.length; i += 4) {
    miniFat.push(miniFatData.readUInt32LE(i));
  }
  return miniFat;
}

function readMiniChain(
  miniStream: Buffer,
  miniFat: number[],
  startSector: number,
  miniSectorSize: number,
  byteCount: number,
): Buffer {
  const chunks: Buffer[] = [];
  let sid = startSector;
  let remaining = Math.max(0, byteCount);
  const seen = new Set<number>();
  while (sid < CFB_ENDOFCHAIN && remaining > 0 && !seen.has(sid)) {
    seen.add(sid);
    const offset = sid * miniSectorSize;
    if (offset >= miniStream.length) break;
    const take = Math.min(miniSectorSize, remaining, miniStream.length - offset);
    chunks.push(miniStream.subarray(offset, offset + take));
    remaining -= take;
    sid = miniFat[sid] ?? CFB_ENDOFCHAIN;
  }
  return Buffer.concat(chunks);
}

function readCfbStreams(buffer: Buffer): Map<string, Buffer> {
  const streams = new Map<string, Buffer>();
  const header = readCfbHeader(buffer);
  if (!header) return streams;

  const fat = buildCfbFat(buffer, header);
  const dirAll = readCfbChain(
    buffer,
    fat,
    header.firstDirSector,
    header.sectorSize,
    1024 * 128,
  );
  const entries = parseCfbDirEntries(dirAll);
  const rooted = entries.find((e) => e.type === 5) ?? entries[0];
  if (!rooted) return streams;

  const flat: Array<CfbDirEntry & { path: string }> = [];
  if (rooted.child !== CFB_FREESECT) {
    walkCfbTree(entries, rooted.child, "", flat, new Set());
  }

  const miniStream =
    rooted.streamSize > 0
      ? readCfbChain(buffer, fat, rooted.startSector, header.sectorSize, Number(rooted.streamSize))
      : Buffer.alloc(0);
  const miniFat = header.numMiniFatSectors > 0 ? readMiniFat(buffer, header, fat) : [];

  for (const entry of flat) {
    if (entry.type !== 2 || !entry.path) continue;
    try {
      const data =
        entry.streamSize < header.miniStreamCutoff && miniStream.length > 0
          ? readMiniChain(miniStream, miniFat, entry.startSector, header.miniSectorSize, entry.streamSize)
          : readCfbChain(buffer, fat, entry.startSector, header.sectorSize, entry.streamSize);
      streams.set(entry.path, data.subarray(0, Math.min(data.length, entry.streamSize)));
    } catch (error) {
      console.warn("[hwpParser] failed to read OLE stream", entry.path, error);
    }
  }
  return streams;
}

function parseFileHeaderFlags(fileHeader: Buffer | undefined): {
  compressed: boolean;
  password: boolean;
  distributable: boolean;
  drm: boolean;
} {
  if (!fileHeader || fileHeader.length < 40) {
    return { compressed: true, password: false, distributable: false, drm: false };
  }
  const flags = fileHeader.readUInt32LE(36);
  return {
    compressed: (flags & 0x1) !== 0,
    password: (flags & 0x2) !== 0,
    distributable: (flags & 0x4) !== 0,
    drm: (flags & 0x10) !== 0,
  };
}

function maybeDecompressHwpStream(data: Buffer, compressed: boolean): Buffer {
  if (!compressed || data.length === 0) return data;
  try {
    return inflateSync(data);
  } catch {
    // HWP 5 BodyText is often raw DEFLATE (no zlib header)
  }
  try {
    return inflateRawSync(data);
  } catch {
    return data;
  }
}

function isHarvestableCodePoint(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d || code === 0x20) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xac00 && code <= 0xd7a3) return true;
  if (code >= 0x3131 && code <= 0x318e) return true;
  if (code >= 0x4e00 && code <= 0x9fff) return true;
  if (code >= 0x3040 && code <= 0x30ff) return true;
  if (code >= 0xff01 && code <= 0xff5e) return true;
  if (code >= 0x2010 && code <= 0x2027) return true;
  return code === 0x3000;
}

/** UTF-16LE 버퍼에서 한글/ASCII 런을 최대한 긁어낸다. */
export function harvestUtf16leText(buf: Buffer): string {
  if (buf.length < 4) return "";
  const start = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe ? 2 : 0;
  const chunks: string[] = [];
  let run: number[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const text = String.fromCharCode(...run).replace(/\r/g, "\n");
    const hasHangul = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    if (hasHangul || run.length >= 4) chunks.push(text.trim());
    run = [];
  };

  for (let i = start; i + 1 < buf.length; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8);
    if (code === 0x000d || code === 0x000a) {
      run.push(10);
      continue;
    }
    if (isHarvestableCodePoint(code)) {
      run.push(code === 0x0009 ? 9 : code);
    } else {
      flush();
    }
  }
  flush();
  return chunks.filter(Boolean).join("\n");
}

function extractParaTextFromSection(data: Buffer): string {
  const parts: string[] = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const header = data.readUInt32LE(offset);
    offset += 4;
    const tag = header & 0x3ff;
    const sizeField = (header >>> 20) & 0xfff;
    let size = sizeField;
    if (sizeField === 0xfff) {
      if (offset + 4 > data.length) break;
      size = data.readUInt32LE(offset);
      offset += 4;
    }
    if (size < 0 || offset + size > data.length) break;
    const payload = data.subarray(offset, offset + size);
    offset += size;
    if (tag === HWPTAG_PARA_TEXT) {
      const text = harvestUtf16leText(payload);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}

function streamName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function extractRawTextFromHwpBinary(buffer: Buffer): HwpBinaryFallbackResult {
  if (!hasPrefix(buffer, OLE_MAGIC)) {
    return { text: "", protected: false };
  }

  let streams: Map<string, Buffer>;
  try {
    streams = readCfbStreams(buffer);
  } catch (error) {
    console.warn("[hwpParser] OLE CFB parse failed:", error);
    return { text: "", protected: false };
  }

  const streamNames = [...streams.keys()];
  console.info("[hwpParser] OLE streams", streamNames);

  const fileHeader =
    streams.get("FileHeader") ??
    [...streams.entries()].find(([name]) => streamName(name) === "FileHeader")?.[1];
  const flags = parseFileHeaderFlags(fileHeader);
  console.info("[hwpParser] FileHeader flags", flags);
  const protectedDoc = flags.password || flags.distributable || flags.drm;

  const parts: string[] = [];
  const prvText =
    streams.get("PrvText") ??
    [...streams.entries()].find(([name]) => streamName(name) === "PrvText")?.[1];
  if (prvText?.length) {
    const preview = harvestUtf16leText(maybeDecompressHwpStream(prvText, false)) || harvestUtf16leText(prvText);
    if (preview) parts.push(preview);
  }

  const sectionEntries = [...streams.entries()]
    .filter(([name]) => /(?:^|\/)BodyText\/Section\d+$/i.test(name) || /^Section\d+$/i.test(streamName(name)))
    .sort((a, b) => {
      const na = Number(streamName(a[0]).match(/(\d+)/)?.[1] ?? 0);
      const nb = Number(streamName(b[0]).match(/(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  for (const [, data] of sectionEntries) {
    const inflated = maybeDecompressHwpStream(data, flags.compressed);
    const fromRecords = extractParaTextFromSection(inflated);
    const harvested = harvestUtf16leText(inflated);
    const best = fromRecords.length >= harvested.length ? fromRecords : harvested;
    if (best.trim()) parts.push(best);
  }

  const text = normalizeExtractedText(parts.join("\n\n"));
  console.info("[hwpParser] fallback extracted chars", text.length);
  return { text, protected: protectedDoc };
}

export async function extractTextFromHwp(buffer: Buffer): Promise<string> {
  try {
    const doc = read(new Uint8Array(buffer));
    const parts = (doc.sections ?? []).map((section) => paragraphsToText(section.paragraphs ?? []));
    const combined = normalizeExtractedText(parts.join("\n\n"));
    if (combined) return combined;
    console.warn("[hwpParser] hwpx-js returned empty text, trying OLE fallback");
  } catch (error) {
    console.warn("[hwpParser] hwpx-js parse failed, trying OLE fallback:", error);
  }

  const fallback = extractRawTextFromHwpBinary(buffer);
  if (fallback.text) return fallback.text;

  if (fallback.protected) {
    throw new HwpParseError(
      "HWP 파일을 읽지 못했습니다. 배포용(DRM) 문서이거나 구버전일 수 있습니다. 한글에서 .hwpx로 저장한 뒤 다시 올려주세요.",
    );
  }
  throw new HwpParseError(
    "텍스트를 추출하지 못했습니다. 한글에서 .hwpx로 저장한 뒤 다시 올려주세요.",
  );
}

async function toBuffer(file: File | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(file)) return file;
  if (typeof (file as File).arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }
  throw new HwpParseError("지원하지 않는 파일 입력입니다.");
}

export async function parseHwpFileToText(
  file: File | Buffer,
  filename: string,
): Promise<string> {
  const buffer = await toBuffer(file);
  if (buffer.length > MAX_HWP_FILE_BYTES) {
    throw new HwpParseError("HWP 파일은 20MB 이하만 업로드할 수 있습니다.");
  }
  if (buffer.length === 0) {
    throw new HwpParseError("빈 파일입니다. .hwp 또는 .hwpx 파일을 올려주세요.");
  }

  const ext = filename.trim().toLowerCase();
  const zip = hasPrefix(buffer, ZIP_MAGIC);
  const ole = hasPrefix(buffer, OLE_MAGIC);

  if (zip || ext.endsWith(".hwpx")) {
    return extractTextFromHwpx(buffer);
  }
  if (ole || ext.endsWith(".hwp")) {
    return extractTextFromHwp(buffer);
  }

  throw new HwpParseError(
    "지원하지 않는 한글 파일 형식입니다. .hwp 또는 .hwpx 파일을 올려주세요.",
  );
}
