import { beforeAll, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

vi.mock("server-only", () => ({}));

import {
  extractTextFromHwpx,
  extractTextFromHwp,
  extractRawTextFromHwpBinary,
  harvestUtf16leText,
  parseHwpFileToText,
  HwpParseError,
  MAX_HWP_FILE_BYTES,
} from "@/lib/admin/bandImport/hwpParser";

const SECTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:t>연태 골프 3박4일</hp:t>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run>
      <hp:tbl>
        <hp:tr>
          <hp:tc><hp:p><hp:run><hp:t>출발일</hp:t></hp:run></hp:p></hp:tc>
          <hp:tc><hp:p><hp:run><hp:t>가격</hp:t></hp:run></hp:p></hp:tc>
        </hp:tr>
        <hp:tr>
          <hp:tc><hp:p><hp:run><hp:t>7/23</hp:t></hp:run></hp:p></hp:tc>
          <hp:tc><hp:p><hp:run><hp:t>890,000원</hp:t></hp:run></hp:p></hp:tc>
        </hp:tr>
      </hp:tbl>
    </hp:run>
  </hp:p>
</hs:sec>
`;

async function buildHwpxBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file("Contents/section0.xml", SECTION_XML);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("extractTextFromHwpx", () => {
  let hwpx: Buffer;

  beforeAll(async () => {
    hwpx = await buildHwpxBuffer();
  });

  it("extracts paragraph text and tab-separated table rows", async () => {
    const text = await extractTextFromHwpx(hwpx);
    expect(text).toContain("연태 골프 3박4일");
    expect(text).toContain("출발일\t가격");
    expect(text).toContain("7/23\t890,000원");
  });

  it("rejects a buffer that is not a zip", async () => {
    await expect(extractTextFromHwpx(Buffer.from("not-a-zip"))).rejects.toBeInstanceOf(HwpParseError);
  });
});

describe("parseHwpFileToText", () => {
  it("routes .hwpx zip buffers to HWPX extraction", async () => {
    const hwpx = await buildHwpxBuffer();
    const text = await parseHwpFileToText(hwpx, "sample.hwpx");
    expect(text).toContain("연태 골프 3박4일");
  });

  it("rejects unsupported formats", async () => {
    await expect(parseHwpFileToText(Buffer.from("hello"), "notes.txt")).rejects.toThrow(
      /지원하지 않는 한글 파일 형식/,
    );
  });

  it("rejects oversized files", async () => {
    const huge = Buffer.alloc(MAX_HWP_FILE_BYTES + 1);
    huge[0] = 0x50;
    huge[1] = 0x4b;
    await expect(parseHwpFileToText(huge, "big.hwpx")).rejects.toThrow(/20MB/);
  });
});

describe("harvestUtf16leText", () => {
  it("extracts Korean UTF-16LE runs", () => {
    const buf = Buffer.from("연태골프", "utf16le");
    expect(harvestUtf16leText(buf)).toContain("연태골프");
  });
});

describe("extractRawTextFromHwpBinary", () => {
  it("returns empty text for non-OLE buffers without throwing", () => {
    expect(extractRawTextFromHwpBinary(Buffer.from("not-ole"))).toEqual({
      text: "",
      protected: false,
    });
  });
});

describe("extractTextFromHwp", () => {
  it("uses generic extract-failed message for invalid OLE without protection flags", async () => {
    const fakeOle = Buffer.alloc(512);
    fakeOle[0] = 0xd0;
    fakeOle[1] = 0xcf;
    fakeOle[2] = 0x11;
    fakeOle[3] = 0xe0;
    fakeOle[4] = 0xa1;
    fakeOle[5] = 0xb1;
    fakeOle[6] = 0x1a;
    fakeOle[7] = 0xe1;
    fakeOle.writeUInt16LE(0xfffe, 0x1c);
    fakeOle.writeUInt16LE(9, 0x1e);
    fakeOle.writeUInt16LE(6, 0x20);
    await expect(extractTextFromHwp(fakeOle)).rejects.toThrow(/텍스트를 추출하지 못했습니다/);
    await expect(extractTextFromHwp(fakeOle)).rejects.not.toThrow(/배포용/);
  });
});
