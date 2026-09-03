import { inflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

import { CARDNEWS_FONT_FAMILY } from "@/lib/marketing/assets/cardnews/brand";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";

const require = createRequire(import.meta.url);

export type CardNewsFontFiles = {
  family: typeof CARDNEWS_FONT_FAMILY;
  directory: string;
  regularPath: string;
  boldPath: string;
  configPath: string;
};

function woffToSfnt(woff: Buffer): Buffer {
  const signature = woff.toString("ascii", 0, 4);
  if (signature !== "wOFF") {
    throw new Error(`Unsupported font container: ${signature}`);
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables: Array<{ tag: string; origChecksum: number; data: Buffer }> = [];
  let directoryOffset = 44;
  for (let index = 0; index < numTables; index += 1) {
    const tag = woff.toString("ascii", directoryOffset, directoryOffset + 4);
    const tableOffset = woff.readUInt32BE(directoryOffset + 4);
    const compactLength = woff.readUInt32BE(directoryOffset + 8);
    const originalLength = woff.readUInt32BE(directoryOffset + 12);
    const origChecksum = woff.readUInt32BE(directoryOffset + 16);
    directoryOffset += 20;
    let data = Buffer.from(woff.subarray(tableOffset, tableOffset + compactLength));
    if (compactLength < originalLength) {
      data = inflateSync(data);
    }
    if (data.length !== originalLength) {
      const padded = Buffer.alloc(originalLength);
      data.copy(padded);
      data = padded;
    }
    tables.push({ tag, origChecksum, data });
  }
  tables.sort((left, right) => left.tag.localeCompare(right.tag));

  const headerSize = 12 + numTables * 16;
  let offset = headerSize;
  const placed = tables.map((table) => {
    const pad = (4 - (table.data.length % 4)) % 4;
    const entry = { ...table, offset, pad };
    offset += table.data.length + pad;
    return entry;
  });

  const output = Buffer.alloc(offset);
  output.writeUInt32BE(flavor, 0);
  output.writeUInt16BE(numTables, 4);
  let entrySelector = 0;
  let searchRange = 1;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector += 1;
  }
  searchRange *= 16;
  output.writeUInt16BE(searchRange, 6);
  output.writeUInt16BE(entrySelector, 8);
  output.writeUInt16BE(numTables * 16 - searchRange, 10);
  placed.forEach((table, index) => {
    const pointer = 12 + index * 16;
    output.write(table.tag, pointer, 4, "ascii");
    output.writeUInt32BE(table.origChecksum, pointer + 4);
    output.writeUInt32BE(table.offset, pointer + 8);
    output.writeUInt32BE(table.data.length, pointer + 12);
    table.data.copy(output, table.offset);
  });
  return output;
}

let cached: CardNewsFontFiles | null = null;

function pretendardWoff(fileName: string): string {
  return require.resolve(`pretendard/dist/web/static/woff/${fileName}`);
}

export function ensureCardNewsFonts(): CardNewsFontFiles {
  if (cached && existsSync(cached.regularPath) && existsSync(cached.boldPath) && existsSync(cached.configPath)) {
    return cached;
  }
  const regularSfnt = woffToSfnt(readFileSync(pretendardWoff("Pretendard-Regular.woff")));
  const boldSfnt = woffToSfnt(readFileSync(pretendardWoff("Pretendard-Bold.woff")));
  const digest = sha256Buffer(Buffer.concat([regularSfnt, boldSfnt])).slice(0, 12);
  const directory = join(tmpdir(), `thealltour-cardnews-fonts-${digest}`);
  mkdirSync(directory, { recursive: true });
  const regularPath = join(directory, "Pretendard-Regular.ttf");
  const boldPath = join(directory, "Pretendard-Bold.ttf");
  const configPath = join(directory, "fonts.conf");
  if (!existsSync(regularPath)) writeFileSync(regularPath, regularSfnt);
  if (!existsSync(boldPath)) writeFileSync(boldPath, boldSfnt);
  writeFileSync(
    configPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${directory}</dir>
  <cachedir>${join(directory, "cache")}</cachedir>
  <config></config>
</fontconfig>
`,
  );
  cached = {
    family: CARDNEWS_FONT_FAMILY,
    directory,
    regularPath,
    boldPath,
    configPath,
  };
  return cached;
}

export async function withCardNewsFonts<T>(run: () => Promise<T>): Promise<T> {
  const fonts = ensureCardNewsFonts();
  const previousFile = process.env.FONTCONFIG_FILE;
  const previousPath = process.env.FONTCONFIG_PATH;
  process.env.FONTCONFIG_FILE = fonts.configPath;
  process.env.FONTCONFIG_PATH = fonts.directory;
  try {
    return await run();
  } finally {
    if (previousFile === undefined) delete process.env.FONTCONFIG_FILE;
    else process.env.FONTCONFIG_FILE = previousFile;
    if (previousPath === undefined) delete process.env.FONTCONFIG_PATH;
    else process.env.FONTCONFIG_PATH = previousPath;
  }
}
