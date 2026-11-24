import { ZipFile } from "yazl";
import fs from "node:fs";
import path from "node:path";
const out = path.resolve("artifacts/FamilyAlbums-Windows.zip");
fs.mkdirSync(path.dirname(out), { recursive: true });
const zip = new ZipFile(),
  file = fs.createWriteStream(out);
zip.outputStream.pipe(file);
const excluded = new Set([
  "node_modules",
  "storage",
  ".git",
  "artifacts",
  ".env",
]);
function addDirectory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith(".log")) continue;
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) addDirectory(name);
    else if (entry.isFile())
      zip.addFile(
        name,
        "FamilyAlbums/" + path.relative(".", name).split(path.sep).join("/"),
      );
  }
}
addDirectory(".");
zip.end();
await new Promise((resolve, reject) => {
  file.on("close", resolve);
  file.on("error", reject);
  zip.on("error", reject);
});
console.log(out);
