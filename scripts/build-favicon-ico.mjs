/**
 * public/favicon.ico 재생성 (32·16 PNG → 멀티 해상도 ICO).
 * 사용: node scripts/build-favicon-ico.mjs
 */
import fs from "fs";
import pngToIco from "png-to-ico";

const out = await pngToIco(["public/favicon-32-v2.png", "public/favicon-16-v2.png"]);
fs.writeFileSync("public/favicon.ico", out);
console.log("Wrote public/favicon.ico", out.length, "bytes");
