import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

for (const name of ["start.bat", "install.bat"]) {
  test(
    name + " preserves ASCII and CRLF for Windows CMD and source archives",
    () => {
      const bytes = fs.readFileSync(name);
      assert.ok(
        bytes.every((byte) => byte < 128),
        "BAT must use ASCII without a BOM",
      );
      const text = bytes.toString("ascii");
      assert.ok(text.startsWith("@echo off\r\n"));
      assert.ok(text.endsWith("\r\n"));
      assert.equal(
        text.replaceAll("\r\n", "").includes("\n"),
        false,
        "Bare LF breaks CMD on affected Windows installations",
      );
      assert.match(text, /cd \/d "%~dp0"/);
      assert.match(text, /call npm /);
      assert.match(text, /pause\r\nexit \/b 1/);
    },
  );
}

test("Windows launchers accept Node 22.13+ and reject older runtimes", () => {
  for (const name of ["start.bat", "install.bat"]) {
    const text = fs.readFileSync(name, "ascii");
    const guard = text.match(/^node -e "(.+)"\r?$/m)?.[1];
    assert.ok(guard);
    for (const [version, expected] of [
      ["20.19.0", 1],
      ["22.12.0", 1],
      ["22.13.0", 0],
      ["22.23.5", 0],
      ["24.0.0", 0],
    ] as const) {
      const status: number | null = spawnSync(process.execPath, [
        "-e",
        guard.replace("process.versions.node", JSON.stringify(version)),
      ]).status;
      assert.equal(status, expected, name + " with Node " + version);
    }
  }
});
