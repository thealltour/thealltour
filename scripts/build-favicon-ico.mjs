/**
 * public/favicon.ico 재생성 (32·16 PNG → 멀티 해상도 ICO).
 * 브라우저 표준 경로용으로 favicon-16/32.png, apple-touch-icon.png 동기화 복사.
 * 사용: node scripts/build-favicon-ico.mjs
 */
import fs from "fs";
import pngToIco from "png-to-ico";

const out = await pngToIco(["public/favicon-32-v2.png", "public/favicon-16-v2.png"]);
fs.writeFileSync("public/favicon.ico", out);
fs.copyFileSync("public/favicon-16-v2.png", "public/favicon-16.png");
fs.copyFileSync("public/favicon-32-v2.png", "public/favicon-32.png");
fs.copyFileSync("public/apple-touch-icon-v2.png", "public/apple-touch-icon.png");
fs.copyFileSync("public/favicon.ico", "src/app/favicon.ico");
console.log("Wrote public/favicon.ico", out.length, "bytes");
console.log("Synced favicon-16.png, favicon-32.png, apple-touch-icon.png, src/app/favicon.ico");
