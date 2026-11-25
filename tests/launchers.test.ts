import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const name of ["start.bat", "install.bat"]) {
  test(name + " preserves ASCII and CRLF for Windows CMD and source archives", () => {
    const bytes = fs.readFileSync(name);
    assert.ok(bytes.every((byte) => byte < 128), "BAT must use ASCII without a BOM");
    const text = bytes.toString("ascii");
    assert.ok(text.startsWith("@echo off\r\n"));
    assert.ok(text.endsWith("\r\n"));
    assert.equal(text.replaceAll("\r\n", "").includes("\n"), false, "Bare LF breaks CMD on affected Windows installations");
    assert.match(text, /cd \/d "%~dp0"/);
    assert.match(text, /call npm /);
    assert.match(text, /pause\r\nexit \/b 1/);
  });
}
