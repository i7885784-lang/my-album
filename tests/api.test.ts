import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
const storage = fs.mkdtempSync(path.join(os.tmpdir(), "album-test-"));
const base = "http://127.0.0.1:3199";
let server: ChildProcess;
let cookie = "",
  other = "",
  fileId = "",
  album = "",
  place = "",
  person = "",
  tag = "";
async function request(
  route: string,
  method = "GET",
  body?: unknown,
  auth = cookie,
) {
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Cookie: auth,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json() };
}
async function start() {
  server = spawn(process.execPath, ["--import", "tsx", "backend/server.ts"], {
    env: {
      ...process.env,
      STORAGE_DIR: storage,
      PORT: "3199",
      NODE_ENV: "production",
    },
    stdio: "pipe",
  });
  let log = "";
  server.stderr?.on("data", (x) => {
    log += x;
  });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base + "/api/me");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Server startup failed " + log);
}
async function stop() {
  await new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
    server.kill("SIGTERM");
  });
}
before(start);
after(async () => {
  await stop();
  fs.rmSync(storage, { recursive: true, force: true });
});
test("registration, session security, creation, uploads, access, persistence and trash lifecycle", async () => {
  let result = await request("/auth/register", "POST", {
    name: "Тестовая семья",
    email: "family@example.test",
    password: "testing-password",
  });
  assert.equal(result.response.status, 201);
  cookie = result.response.headers.get("set-cookie")!.split(";")[0];
  assert.match(result.response.headers.get("set-cookie")!, /HttpOnly/);
  result = await request("/state");
  assert.equal(result.data.media.length, 0);
  for (const kind of ["albums", "people", "places", "tags"]) {
    const r = await request("/entities/" + kind, "POST", {
      name: "Проверка " + kind,
      latitude: 55.75,
      longitude: 37.61,
    });
    assert.equal(r.response.status, 201);
    if (kind === "albums") album = r.data.id;
    if (kind === "places") place = r.data.id;
    if (kind === "people") person = r.data.id;
    if (kind === "tags") tag = r.data.id;
  }
  const fixture = path.join(storage, "fixture.png");
  const generatedImage = spawnSync(ffmpeg.path, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x7043c7:s=50x50:d=1",
    "-frames:v",
    "1",
    "-threads",
    "1",
    fixture,
  ]);
  assert.equal(generatedImage.status, 0);
  const buffer = fs.readFileSync(fixture);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "image/png" }),
    "../../Семейное фото.png",
  );
  form.append("entities", JSON.stringify([album, person, place, tag]));
  let response = await fetch(base + "/api/media/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(response.status, 201);
  fileId = (await response.json()).id;
  assert.equal(
    (await request("/state")).data.media[0].name,
    "Семейное фото.png",
  );
  assert.equal(
    (
      await fetch(base + "/api/files/" + fileId + "/thumb", {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(base + "/api/files/" + fileId + "/original")).status,
    401,
  );
  const malicious = new FormData();
  malicious.append(
    "file",
    new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }),
    "fake.jpg",
  );
  response = await fetch(base + "/api/media/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: malicious,
  });
  assert.equal(response.status, 415);
  result = await request("/media/" + fileId, "PATCH", {
    favorite: true,
    name: "Семейная фотография",
  });
  assert.equal(result.response.status, 200);
  result = await request("/auth/register", "POST", {
    name: "Другой пользователь",
    email: "other@example.test",
    password: "testing-password",
  });
  other = result.response.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await request("/state", "GET", undefined, other)).data.media.length,
    0,
  );
  assert.equal(
    (
      await fetch(base + "/api/files/" + fileId + "/original", {
        headers: { Cookie: other },
      })
    ).status,
    403,
  );
  const invite = (await request("/invites", "POST", { role: "member" })).data
    .token;
  assert.equal(
    (await request("/invites/join", "POST", { token: invite }, other)).response
      .status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/files/" + fileId + "/original", {
        headers: { Cookie: other },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/media/batch",
        "POST",
        { ids: [fileId], action: "trash" },
        other,
      )
    ).response.status,
    403,
  );
  await request("/entities/" + album, "PATCH", { visibility: "private" });
  assert.equal(
    (
      await fetch(base + "/api/files/" + fileId + "/original", {
        headers: { Cookie: other },
      })
    ).status,
    403,
  );
  await request("/entities/" + album, "PATCH", { visibility: "family" });
  await request(
    "/media/" + fileId + "/comments",
    "POST",
    { text: "Наш любимый момент" },
    other,
  );
  assert.equal((await request("/state")).data.notifications.length, 1);
  await request("/settings", "PATCH", {
    theme: "dark",
    visibility: "private",
    geolocation: false,
    commentNotifications: false,
    sharedNotifications: true,
  });
  await stop();
  await start();
  result = await request("/state");
  assert.equal(result.data.media[0].name, "Семейная фотография");
  assert.equal(result.data.media[0].favorite, true);
  assert.equal(result.data.user.settings.theme, "dark");
  assert.equal(result.data.media[0].entities.length, 4);
  const videoPath = path.join(storage, "sample.mp4");
  const generated = spawnSync(ffmpeg.path, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=purple:s=160x120:d=1",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    videoPath,
  ]);
  assert.equal(generated.status, 0);
  const video = new FormData();
  video.append(
    "file",
    new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }),
    "sample.mp4",
  );
  const videoResponse = await fetch(base + "/api/media/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: video,
  });
  assert.equal(videoResponse.status, 201, await videoResponse.clone().text());
  const videoId = (await videoResponse.json()).id;
  assert.equal(
    (
      await fetch(base + "/api/files/" + videoId + "/thumb", {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  const preview = await fetch(base + "/api/files/" + videoId + "/preview", {
    headers: { Cookie: cookie, Range: "bytes=0-127" },
  });
  assert.equal(preview.status, 206);
  const archive = await fetch(base + "/api/export", {
    headers: { Cookie: cookie },
  });
  assert.equal(archive.status, 200);
  const backup = await archive.arrayBuffer();
  const restore = new FormData();
  restore.append("file", new Blob([backup]), "backup.zip");
  const restored = await fetch(base + "/api/restore", {
    method: "POST",
    headers: { Cookie: cookie },
    body: restore,
  });
  assert.equal(restored.status, 200, await restored.text());
  await request("/media/batch", "POST", { ids: [fileId], action: "trash" });
  assert.ok(
    (await request("/state")).data.media.find((m: any) => m.id === fileId)
      .deleted,
  );
  await request("/media/batch", "POST", { ids: [fileId], action: "restore" });
  assert.equal(
    (await request("/state")).data.media.find((m: any) => m.id === fileId)
      .entities.length,
    4,
  );
  await request("/media/batch", "POST", { ids: [fileId], action: "trash" });
  assert.equal(
    (
      await request("/media/batch", "POST", {
        ids: [fileId],
        action: "permanent",
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/files/" + fileId + "/original", {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  assert.equal(fs.readdirSync(path.join(storage, "temp")).length, 0);
});
test("guest access is read-only and other users' trash stays hidden", async () => {
  const ownerState = (await request("/state")).data;
  const m = ownerState.media.find((item: any) => item.entities.length > 0);
  assert.ok(m);
  const a = ownerState.entities.find(
    (e: any) => e.kind === "albums" && m.entities.includes(e.id),
  );
  await request("/entities/" + a.id, "PATCH", { visibility: "family" });
  const registered = await request("/auth/register", "POST", {
    name: "Гость",
    email: "guest@example.test",
    password: "guest-testing-password",
  });
  const guest = registered.response.headers.get("set-cookie")!.split(";")[0];
  const invitation = (await request("/invites", "POST", { role: "guest" })).data
    .token;
  assert.equal(
    (await request("/invites/join", "POST", { token: invitation }, guest))
      .response.status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/files/" + m.id + "/original", {
        headers: { Cookie: guest },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/media/" + m.id + "/comments",
        "POST",
        { text: "Запрещённая запись" },
        guest,
      )
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(
        "/entities/tags",
        "POST",
        { name: "Нет права", space: m.space },
        guest,
      )
    ).response.status,
    403,
  );
  await request("/media/batch", "POST", { ids: [m.id], action: "trash" });
  assert.ok(
    !(await request("/state", "GET", undefined, guest)).data.media.some(
      (item: any) => item.id === m.id,
    ),
  );
});

test("profile cover is persistent, private and preserved by legacy settings updates", async () => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([fs.readFileSync(path.join(storage, "fixture.png"))], {
      type: "image/png",
    }),
    "Обложка.png",
  );
  const uploaded = await fetch(base + "/api/media/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(uploaded.status, 201);
  const image = (await uploaded.json()).id;
  assert.equal(
    (
      await request("/profile/appearance", "PATCH", {
        heroImage: image,
        heroPosition: 73,
        avatar: image,
      })
    ).response.status,
    200,
  );
  const albumWithCover = (
    await request("/entities/albums", "POST", {
      name: "Обложка альбома",
      cover: image,
    })
  ).data.id;
  const state = (await request("/state")).data;
  assert.equal(state.user.settings.heroPosition, 73);
  assert.equal(state.user.settings.heroImage, image);
  const cover = await fetch(base + "/api/files/" + image + "/hero", {
    headers: { Cookie: cookie },
  });
  assert.equal(cover.status, 200);
  assert.match(cover.headers.get("content-type") || "", /image\/webp/);
  assert.equal(
    (await fetch(base + "/api/files/" + image + "/hero")).status,
    401,
  );
  assert.equal(
    (await request("/profile/appearance", "PATCH", { heroImage: image }, other))
      .response.status,
    403,
  );
  assert.equal(
    (await request("/profile/appearance", "PATCH", { heroPosition: 101 }))
      .response.status,
    400,
  );
  await request("/settings", "PATCH", {
    theme: "light",
    visibility: "private",
    geolocation: false,
    commentNotifications: true,
    sharedNotifications: false,
  });
  const settings = (await request("/me")).data.settings;
  assert.equal(settings.heroImage, image);
  assert.equal(settings.avatar, image);
  assert.equal(settings.heroPosition, 73);
  await request("/media/batch", "POST", { ids: [image], action: "trash" });
  await request("/media/batch", "POST", { ids: [image], action: "permanent" });
  const cleared = (await request("/me")).data.settings;
  assert.equal(cleared.heroImage, "");
  assert.equal(cleared.avatar, undefined);
  assert.equal(
    (await request("/state")).data.entities.find(
      (e: any) => e.id === albumWithCover,
    ).cover,
    "",
  );
  assert.equal(
    fs.existsSync(path.join(storage, "previews", image + "-hero.webp")),
    false,
  );
});
test("invites target the selected family and duplicate joins preserve the invitation", async () => {
  const ownerState = (await request("/state")).data;
  const space = ownerState.spaces.find((s: any) => s.role === "owner").id;
  const token = (await request("/invites", "POST", { role: "member", space }))
    .data.token;
  assert.equal(
    (await request("/invites/join", "POST", { token })).response.status,
    409,
  );
  const registered = await request("/auth/register", "POST", {
    name: "Новый родственник",
    email: "new-relative@example.test",
    password: "relative-testing-password",
  });
  const relative = registered.response.headers.get("set-cookie")!.split(";")[0];
  const joined = await request("/invites/join", "POST", { token }, relative);
  assert.equal(joined.response.status, 200);
  assert.equal(joined.data.space, space);
  assert.equal(
    (await request("/invites", "POST", { role: "member", space }, relative))
      .response.status,
    403,
  );
  const state = (await request("/state", "GET", undefined, relative)).data;
  assert.equal(
    state.members.filter(
      (m: any) => m.space === space && m.id === state.user.id,
    ).length,
    1,
  );
});
