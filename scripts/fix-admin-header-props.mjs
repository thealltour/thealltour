import fs from "fs";
import { execSync } from "child_process";

const files = execSync('rg -l "AdminHeader" src --glob "*.tsx"', { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

for (const file of files) {
  if (file.endsWith("AdminHeader.tsx")) continue;
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  content = content.replace(/<AdminHeader[\s\S]*?\/>/g, (block) => {
    const title = block.match(/title="([^"]*)"/)?.[1] ?? block.match(/title=\{"([^"]*)"\}/)?.[1];
    const description =
      block.match(/description="([^"]*)"/)?.[1] ?? block.match(/description=\{"([^"]*)"\}/)?.[1];
    const unread = block.match(/unreadNotificationCount=\{([^}]+)\}/)?.[1];
    if (!title || !description || !unread) return block;
    return `<AdminHeader
          title="${title}"
          description="${description}"
          unreadNotificationCount={${unread}}
        />`;
  });
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("updated", file);
  }
}
