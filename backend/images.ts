import { spawn } from "node:child_process";
import fs from "node:fs";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import exifr from "exifr";

export class ImageProcessingError extends Error {}

const orientationFilters: Record<number, string[]> = {
  2: ["hflip"],
  3: ["hflip", "vflip"],
  4: ["vflip"],
  5: ["transpose=0"],
  6: ["transpose=1"],
  7: ["transpose=3"],
  8: ["transpose=2"],
};

/** Native FFmpeg works on Windows x86 without WebAssembly SIMD. */
export async function createImageThumbnail(
  input: string,
  output: string,
  banner = false,
) {
  const orientation = await exifr.orientation(input).catch(() => undefined);
  const filters = [
    ...(orientationFilters[orientation || 1] || []),
    ...(banner
      ? [
          "scale=w='min(1920,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease",
        ]
      : [
          "scale=w='min(600,iw)':h='min(450,ih)':force_original_aspect_ratio=increase",
          "crop=w='min(600,iw)':h='min(450,ih)'",
        ]),
  ];
  try {
    const log = await new Promise<string>((resolve, reject) => {
      const child = spawn(ffmpeg.path, [
        "-nostdin",
        "-y",
        "-max_alloc",
        "268435456",
        "-max_pixels",
        "100000000",
        "-threads",
        "1",
        "-noautorotate",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-vf",
        filters.join(","),
        "-filter_threads",
        "1",
        "-threads",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "82",
        output,
      ]);
      let log = "";
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 60000);
      child.stderr.on("data", (chunk) => {
        log = (log + chunk.toString()).slice(-32000);
      });
      child.on("error", () => {
        clearTimeout(timeout);
        reject(
          new ImageProcessingError("Не удалось запустить обработку фотографии"),
        );
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (timedOut)
          reject(
            new ImageProcessingError(
              "Обработка фотографии превысила 60 секунд",
            ),
          );
        else if (code === 0) resolve(log);
        else
          reject(
            new ImageProcessingError(
              "Изображение повреждено, слишком велико или не поддерживается",
            ),
          );
      });
    });
    const inputLog = log.split("Output #0")[0];
    const dimensions = inputLog.match(/Video:[^\r\n]*?\b(\d+)x(\d+)\b/);
    if (!dimensions)
      throw new ImageProcessingError("Не удалось определить размер фотографии");
    return { width: Number(dimensions[1]), height: Number(dimensions[2]) };
  } catch (error) {
    fs.rmSync(output, { force: true });
    throw error;
  }
}
