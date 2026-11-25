import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { fileTypeFromFile } from "file-type";
import { createImageThumbnail, ImageProcessingError } from "../backend/images";

function fixture(output: string, width = 80, height = 40) {
  const result = spawnSync(ffmpeg.path, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=" + width + "x" + height + ":d=1",
    "-frames:v",
    "1",
    "-filter_threads",
    "1",
    "-threads",
    "1",
    output,
  ]);
  assert.equal(result.status, 0, result.stderr?.toString());
}
function inspect(input: string) {
  const result = spawnSync(ffmpeg.path, [
    "-i",
    input,
    "-frames:v",
    "1",
    "-threads",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  assert.equal(result.status, 0, result.stderr?.toString());
  return result;
}
for (const extension of ["jpg", "png", "webp", "gif"]) {
  test(
    "native image processing supports " + extension + " without Sharp or WASM",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "album-image-"));
      try {
        const input = path.join(dir, "input." + extension),
          output = path.join(dir, "thumbnail.webp");
        fixture(input);
        assert.deepEqual(await createImageThumbnail(input, output), {
          width: 80,
          height: 40,
        });
        assert.equal((await fileTypeFromFile(output))?.mime, "image/webp");
        assert.equal(inspect(output).stdout.length, 80 * 40 * 3);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
}
test("image thumbnails preserve EXIF orientation and existing original bytes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "album-orientation-"));
  try {
    const input = path.join(dir, "input.jpg"),
      output = path.join(dir, "thumbnail.webp");
    fixture(input);
    const original = fs.readFileSync(input);
    // JPEG APP1 with an EXIF orientation value of 6 (rotate clockwise).
    const exif = Buffer.from(
      "ffe1002245786966000049492a0008000000010012010300010000000600000000000000",
      "hex",
    );
    const withExif = Buffer.concat([
      original.subarray(0, 2),
      exif,
      original.subarray(2),
    ]);
    fs.writeFileSync(input, withExif);
    await createImageThumbnail(input, output);
    assert.match(inspect(output).stderr.toString(), /40x80/);
    assert.deepEqual(fs.readFileSync(input), withExif);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("large images are cropped to thumbnail dimensions and invalid images are rejected", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "album-thumbnail-"));
  try {
    const input = path.join(dir, "input.png"),
      output = path.join(dir, "thumbnail.webp");
    fixture(input, 1200, 800);
    assert.deepEqual(await createImageThumbnail(input, output), {
      width: 1200,
      height: 800,
    });
    assert.equal(inspect(output).stdout.length, 600 * 450 * 3);
    fs.writeFileSync(input, "invalid image");
    await assert.rejects(
      createImageThumbnail(input, output),
      ImageProcessingError,
    );
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("installation does not include Sharp or its WASM package", () => {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.ok(
    !Object.keys(lock.packages).some(
      (name) => name === "node_modules/sharp" || name.includes("@img/sharp"),
    ),
  );
});
