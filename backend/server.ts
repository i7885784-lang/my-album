import express from "express";
import multer from "multer";
import { createImageThumbnail, ImageProcessingError } from "./images";
import exifr from "exifr";
import { fileTypeFromFile } from "file-type";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  createHash,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import { isUtf8 } from "node:buffer";
import path from "node:path";
import { z } from "zod";
import yazl from "yazl";
import AdmZip from "adm-zip";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const store = path.resolve(
  process.env.STORAGE_DIR || path.join(root, "storage"),
);
for (const dir of ["originals", "thumbnails", "previews", "temp"])
  fs.mkdirSync(path.join(store, dir), { recursive: true });
const db = new DatabaseSync(path.join(store, "albums.sqlite"));
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,settings TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS members(space TEXT REFERENCES spaces(id),user TEXT REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(space,user));
CREATE TABLE IF NOT EXISTS member_preferences(space TEXT REFERENCES spaces(id),user TEXT REFERENCES users(id),label TEXT NOT NULL DEFAULT '',blockedAlbums TEXT NOT NULL DEFAULT '[]',PRIMARY KEY(space,user));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,space TEXT REFERENCES spaces(id),owner TEXT REFERENCES users(id),kind TEXT NOT NULL,name TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,space TEXT REFERENCES spaces(id),owner TEXT REFERENCES users(id),name TEXT NOT NULL,file TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,width INTEGER,height INTEGER,meta TEXT NOT NULL,created TEXT NOT NULL,deleted TEXT);
CREATE TABLE IF NOT EXISTS links(media TEXT REFERENCES media(id) ON DELETE CASCADE,entity TEXT REFERENCES entities(id) ON DELETE CASCADE,PRIMARY KEY(media,entity));
CREATE TABLE IF NOT EXISTS favorites(user TEXT REFERENCES users(id),media TEXT REFERENCES media(id) ON DELETE CASCADE,PRIMARY KEY(user,media));
CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,space TEXT REFERENCES spaces(id),role TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,media TEXT REFERENCES media(id) ON DELETE CASCADE,user TEXT REFERENCES users(id),text TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user TEXT REFERENCES users(id),media TEXT,text TEXT NOT NULL,created TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS media_space ON media(space,deleted,created);
CREATE INDEX IF NOT EXISTS entities_space ON entities(space,kind);
PRAGMA user_version=1;
`);
type Row = Record<string, any>;
const all = (sql: string, ...args: any[]) =>
  db.prepare(sql).all(...args) as Row[];
const one = (sql: string, ...args: any[]) =>
  db.prepare(sql).get(...args) as Row | undefined;
const run = (sql: string, ...args: any[]) => db.prepare(sql).run(...args);
const now = () => new Date().toISOString();
const defaults = {
  theme: "light",
  visibility: "family",
  geolocation: false,
  desktopNotifications: false,
  animations: true,
  commentNotifications: true,
  sharedNotifications: true,
  heroImage: "",
  heroPosition: 50,
};
const settings = (u: Row) => ({
  ...defaults,
  ...JSON.parse(u.settings),
  geolocation: false,
});
const hash = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
const matches = (password: string, value: string) => {
  const [salt, digest] = value.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(digest, "hex"),
  );
};
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== req.protocol + "://" + req.headers.host
  )
    return res.status(403).json({ error: "Недопустимый источник запроса" });
  next();
});
const current = (req: express.Request) => {
  const token = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("session="))
    ?.slice(8);
  const session =
    token &&
    one(
      "SELECT * FROM sessions WHERE token=? AND expires>?",
      token,
      Date.now(),
    );
  return session
    ? one("SELECT * FROM users WHERE id=?", session.user)
    : undefined;
};
const user = (req: express.Request) =>
  current(req) || fail(401, "Войдите в аккаунт");
const member = (uid: string, space: string) =>
  one("SELECT * FROM members WHERE user=? AND space=?", uid, space);
const ownSpace = (uid: string) =>
  one("SELECT * FROM spaces WHERE owner=?", uid)!;
const memberPreferences = (uid: string, space: string) => {
  const row = one(
    "SELECT * FROM member_preferences WHERE user=? AND space=?",
    uid,
    space,
  );
  return {
    label: row?.label || "",
    blockedAlbums: JSON.parse(row?.blockedAlbums || "[]") as string[],
  };
};
const canEntity = (uid: string, e: Row) =>
  member(uid, e.space) &&
  !memberPreferences(uid, e.space).blockedAlbums.includes(e.id) &&
  (e.kind !== "albums" ||
    e.owner === uid ||
    JSON.parse(e.data).visibility === "family" ||
    (JSON.parse(e.data).invited || []).includes(uid));
const entity = (uid: string, id: string, edit = false) => {
  const e =
    one("SELECT * FROM entities WHERE id=?", id) ||
    fail(404, "Объект не найден");
  if (!canEntity(uid, e)) fail(403, "Нет доступа");
  if (edit && (e.owner !== uid || member(uid, e.space)?.role === "guest"))
    fail(403, "Нет права изменять объект");
  return e;
};
const canMedia = (uid: string, m: Row) => {
  if (!member(uid, m.space)) return false;
  const blocked = memberPreferences(uid, m.space).blockedAlbums;
  if (
    blocked.length &&
    all("SELECT entity FROM links WHERE media=?", m.id).some((l) =>
      blocked.includes(l.entity),
    )
  )
    return false;
  if (m.owner === uid) return true;
  const albums = all(
    "SELECT e.* FROM entities e JOIN links l ON l.entity=e.id WHERE l.media=? AND e.kind='albums'",
    m.id,
  );
  return albums.length
    ? albums.some((e) => canEntity(uid, e))
    : settings(one("SELECT * FROM users WHERE id=?", m.owner)!).visibility ===
        "family";
};
const media = (uid: string, id: string, edit = false) => {
  const m =
    one("SELECT * FROM media WHERE id=?", id) || fail(404, "Файл не найден");
  if (!canMedia(uid, m)) fail(403, "Нет доступа");
  if (edit && (m.owner !== uid || member(uid, m.space)?.role === "guest"))
    fail(403, "Нет права изменять файл");
  return m;
};
function notifyShared(
  owner: string,
  space: string,
  text: string,
  mediaId: string | null = null,
) {
  for (const m of all(
    "SELECT u.* FROM users u JOIN members m ON m.user=u.id WHERE m.space=? AND u.id<>?",
    space,
    owner,
  )) {
    if (!settings(m).sharedNotifications) continue;
    if (
      mediaId &&
      !canMedia(m.id, one("SELECT * FROM media WHERE id=?", mediaId)!)
    )
      continue;
    run(
      "INSERT INTO notifications VALUES(?,?,?,?,?,0)",
      randomUUID(),
      m.id,
      mediaId,
      text,
      now(),
    );
  }
}
function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
const session = (res: express.Response, uid: string) => {
  const token = randomBytes(32).toString("hex");
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    token,
    uid,
    Date.now() + 30 * 86400000,
  );
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 30 * 86400000,
    path: "/",
  });
};
const authSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  name: z.string().trim().min(1).max(100),
});
const attempts = new Map<string, { count: number; until: number }>();
app.post("/api/auth/:action", (req, res) => {
  const key = req.ip || "local",
    count = attempts.get(key);
  if (count && count.until > Date.now() && count.count >= 30)
    fail(429, "Слишком много попыток. Подождите 15 минут");
  attempts.set(key, {
    count: count && count.until > Date.now() ? count.count + 1 : 1,
    until: Date.now() + 900000,
  });
  if (req.params.action === "logout") {
    const u = current(req);
    if (u) {
      const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
      run("DELETE FROM sessions WHERE token=?", token);
    }
    res.clearCookie("session");
    return res.json({ ok: true });
  }
  if (req.params.action === "register") {
    const body = authSchema.parse(req.body),
      email = body.email.toLowerCase();
    if (one("SELECT id FROM users WHERE email=?", email))
      fail(409, "Этот email уже зарегистрирован");
    const uid = randomUUID(),
      sid = randomUUID();
    transaction(() => {
      run(
        "INSERT INTO users VALUES(?,?,?,?,?,?)",
        uid,
        body.name,
        email,
        hash(body.password),
        JSON.stringify(defaults),
        now(),
      );
      run("INSERT INTO spaces VALUES(?,?,?)", sid, "Наша семья", uid);
      run("INSERT INTO members VALUES(?,?,?)", sid, uid, "owner");
    });
    session(res, uid);
    return res.status(201).json({ ok: true });
  }
  if (req.params.action !== "login") fail(404, "Маршрут не найден");
  const body = z
    .object({ email: z.string().max(254), password: z.string().max(128) })
    .parse(req.body);
  const u = one("SELECT * FROM users WHERE email=?", body.email.toLowerCase());
  if (!u || !matches(body.password, u.password))
    fail(401, "Неверный email или пароль");
  session(res, u.id);
  res.json({ ok: true });
});
app.get("/api/health", (_req, res) =>
  res.json({ app: "family-albums", ok: true }),
);
app.get("/api/me", (req, res) => {
  const u = current(req);
  res.json(
    u
      ? { id: u.id, name: u.name, email: u.email, settings: settings(u) }
      : null,
  );
});
app.use("/api", (req, res, next) => {
  try {
    user(req);
    next();
  } catch (e) {
    next(e);
  }
});
app.get("/api/state", (req, res) => {
  const u = user(req),
    spaces = all(
      "SELECT s.*,m.role,u.name AS ownerName FROM spaces s JOIN members m ON m.space=s.id JOIN users u ON u.id=s.owner WHERE m.user=?",
      u.id,
    );
  const entities = all(
    "SELECT e.* FROM entities e JOIN members m ON m.space=e.space WHERE m.user=?",
    u.id,
  )
    .filter((e) => canEntity(u.id, e))
    .map((e) => ({ ...e, ...JSON.parse(e.data) }));
  const files: Row[] = all(
    "SELECT f.* FROM media f JOIN members m ON m.space=f.space WHERE m.user=? ORDER BY f.created DESC",
    u.id,
  )
    .filter((m) => (m.owner === u.id || !m.deleted) && canMedia(u.id, m))
    .map((m) => ({
      ...m,
      meta: JSON.parse(m.meta),
      entities: (() => {
        const links = all(
          "SELECT e.* FROM entities e JOIN links l ON e.id=l.entity WHERE l.media=?",
          m.id,
        ).filter((e) => canEntity(u.id, e));
        const ids = links.map((e) => e.id);
        if (!links.some((e) => e.kind === "places"))
          for (const e of links.filter((e) => e.kind === "albums")) {
            const place = JSON.parse(e.data).place;
            if (place && entities.some((e) => e.id === place)) ids.push(place);
          }
        return [...new Set(ids)];
      })(),
      favorite: !!one(
        "SELECT 1 FROM favorites WHERE user=? AND media=?",
        u.id,
        m.id,
      ),
    }));
  res.json({
    user: { id: u.id, name: u.name, email: u.email, settings: settings(u) },
    spaces,
    entities,
    media: files,
    bytes: files.reduce((a, m) => a + m.size, 0),
    notifications: visibleNotifications(u.id),
    members: all(
      "SELECT u.id,u.name,u.email,m.space,m.role FROM users u JOIN members m ON m.user=u.id WHERE m.space IN (SELECT space FROM members WHERE user=?)",
      u.id,
    ).map((m) => ({ ...m, ...memberPreferences(m.id, m.space) })),
  });
});
const kinds = ["albums", "people", "places", "tags"];
const entityBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  category: z.string().max(100).default("Своё"),
  visibility: z.enum(["private", "family", "invited"]).default("family"),
  cover: z.string().max(200).default(""),
  eventDate: z.string().max(32).default(""),
  place: z.string().max(200).default(""),
  placeName: z.string().trim().max(120).default(""),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  invited: z.array(z.string()).max(100).default([]),
  space: z.string().optional(),
});
function resolvePlace(
  uid: string,
  space: string,
  place: string,
  placeName: string,
) {
  if (place) {
    const e = entity(uid, place);
    if (e.kind !== "places" || e.space !== space)
      fail(400, "Выберите место этой семьи");
    return e.id as string;
  }
  if (!placeName) return "";
  const existing = all(
    "SELECT * FROM entities WHERE space=? AND kind='places'",
    space,
  ).find((e) => e.name.toLocaleLowerCase() === placeName.toLocaleLowerCase());
  if (existing) return existing.id as string;
  const id = randomUUID();
  run(
    "INSERT INTO entities VALUES(?,?,?,?,?,?,?)",
    id,
    space,
    uid,
    "places",
    placeName,
    JSON.stringify({
      category: "Путешествия",
      description: "",
      visibility: "family",
      cover: "",
      invited: [],
      latitude: null,
      longitude: null,
    }),
    now(),
  );
  return id;
}
function visibleNotifications(uid: string) {
  return all(
    "SELECT * FROM notifications WHERE user=? ORDER BY created DESC LIMIT 100",
    uid,
  ).filter(
    (n) =>
      !n.media ||
      (() => {
        const m = one("SELECT * FROM media WHERE id=?", n.media);
        return m && !m.deleted && canMedia(uid, m);
      })(),
  );
}
app.get("/api/notifications", (req, res) =>
  res.json({
    items: visibleNotifications(user(req).id),
    desktopNotifications: settings(user(req)).desktopNotifications,
    accessRevision: createHash("sha256")
      .update(
        JSON.stringify([
          all(
            "SELECT m.space,m.role,p.blockedAlbums FROM members m LEFT JOIN member_preferences p ON p.space=m.space AND p.user=m.user WHERE m.user=? ORDER BY m.space",
            user(req).id,
          ),
          all(
            "SELECT e.id,e.data FROM entities e JOIN members m ON e.space=m.space WHERE m.user=? AND e.kind='albums' ORDER BY e.id",
            user(req).id,
          ),
        ]),
      )
      .digest("hex"),
  }),
);
app.get("/api/storage", (req, res) => {
  const uid = user(req).id,
    files = all("SELECT * FROM media WHERE owner=?", uid);
  const bytesAt = (dir: string, name: string) => {
    try {
      return fs.statSync(path.join(store, dir, name)).size;
    } catch {
      return 0;
    }
  };
  const originals = files.reduce((n, f) => n + f.size, 0);
  const thumbnails = files.reduce(
    (n, f) => n + bytesAt("thumbnails", f.id + ".webp"),
    0,
  );
  const previews = files.reduce(
    (n, f) =>
      n +
      bytesAt("previews", f.id + ".mp4") +
      bytesAt("previews", f.id + "-hero.webp"),
    0,
  );
  res.json({
    originals,
    thumbnails,
    previews,
    used: originals + thumbnails + previews,
    photos: files.filter((f) => !f.deleted && f.mime.startsWith("image"))
      .length,
    videos: files.filter((f) => !f.deleted && f.mime.startsWith("video"))
      .length,
    trash: files.filter((f) => f.deleted).reduce((n, f) => n + f.size, 0),
  });
});
app.post("/api/entities/:kind", (req, res) => {
  const u = user(req),
    kind = String(req.params.kind);
  if (!kinds.includes(kind)) fail(400, "Неизвестный тип");
  const b = entityBody.parse({
      visibility: settings(u).visibility,
      ...req.body,
    }),
    space = b.space || ownSpace(u.id).id,
    m = member(u.id, space);
  if (!m || m.role === "guest") fail(403, "Нет права создавать объекты");
  if (b.cover && !b.cover.startsWith("/assets/")) {
    media(u.id, b.cover);
  }
  if (kind === "albums")
    b.place = resolvePlace(u.id, space, b.place, b.placeName);
  b.placeName = "";
  const id = randomUUID();
  run(
    "INSERT INTO entities VALUES(?,?,?,?,?,?,?)",
    id,
    space,
    u.id,
    kind,
    b.name,
    JSON.stringify(b),
    now(),
  );
  res.status(201).json({ id });
});
app.patch("/api/entities/:id", (req, res) => {
  const u = user(req),
    e = entity(u.id, String(req.params.id), true),
    b = entityBody.parse({ ...JSON.parse(e.data), ...req.body });
  if (b.cover && !b.cover.startsWith("/assets/")) media(u.id, b.cover);
  if (e.kind === "albums")
    b.place = resolvePlace(u.id, e.space, b.place, b.placeName);
  b.placeName = "";
  run(
    "UPDATE entities SET name=?,data=? WHERE id=?",
    b.name,
    JSON.stringify(b),
    e.id,
  );
  res.json({ ok: true });
});
app.delete("/api/entities/:id", (req, res) => {
  const u = user(req),
    e = entity(u.id, String(req.params.id), true);
  transaction(() => {
    if (req.query.trash === "true")
      for (const m of all(
        "SELECT f.* FROM media f JOIN links l ON l.media=f.id WHERE l.entity=?",
        e.id,
      )) {
        if (m.owner === u.id)
          run("UPDATE media SET deleted=? WHERE id=?", now(), m.id);
      }
    run(
      "UPDATE entities SET data=json_set(data,'$.place','') WHERE json_extract(data,'$.place')=?",
      e.id,
    );
    run("DELETE FROM entities WHERE id=?", e.id);
  });
  res.json({ ok: true });
});
async function processVideo(input: string, id: string) {
  const preview = path.join(store, "previews", id + ".mp4");
  const poster = path.join(store, "thumbnails", id + ".webp");
  try {
    const log = await new Promise<string>((resolve, reject) => {
      const child = spawn(ffmpeg.path, [
        "-nostdin",
        "-y",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        "scale='min(1280,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "25",
        "-threads",
        "2",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        preview,
      ]);
      let output = "";
      child.stderr.on("data", (b) => {
        output = (output + b.toString()).slice(-32000);
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new HttpError(422, "Обработка видео превысила 5 минут"));
      }, 300000);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve(output)
          : reject(
              new HttpError(
                422,
                "Видео повреждено или содержит неподдерживаемый кодек",
              ),
            );
      });
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpeg.path,
        [
          "-nostdin",
          "-y",
          "-i",
          preview,
          "-frames:v",
          "1",
          "-vf",
          "scale=600:-2",
          "-threads",
          "1",
          poster,
        ],
        { stdio: "ignore" },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new HttpError(422, "Не удалось создать постер видео")),
      );
    });
    const duration = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
    return {
      duration: duration
        ? Number(duration[1]) * 3600 +
          Number(duration[2]) * 60 +
          Number(duration[3])
        : 0,
      videoPreview: true,
    };
  } catch (e) {
    fs.rmSync(preview, { force: true });
    fs.rmSync(poster, { force: true });
    throw e;
  }
}
function uploadName(name: string) {
  if ([...name].some((char) => char.charCodeAt(0) > 255))
    return path.basename(name).slice(0, 200);
  const bytes = Buffer.from(name, "latin1");
  return path
    .basename(isUtf8(bytes) ? bytes.toString("utf8") : name)
    .slice(0, 200);
}
const maxFile = Number(process.env.MAX_UPLOAD_MB || 200) * 1024 * 1024;
const upload = multer({
  dest: path.join(store, "temp"),
  limits: { fileSize: maxFile, files: 20 },
});
function cleanExpiredTrash() {
  const expired = all(
    "SELECT * FROM media WHERE deleted IS NOT NULL AND deleted<?",
    new Date(Date.now() - 30 * 86400000).toISOString(),
  );
  transaction(() => {
    for (const m of expired) {
      run(
        "UPDATE users SET settings=json_remove(settings, '$.avatar') WHERE json_extract(settings, '$.avatar')=?",
        m.id,
      );
      run(
        "UPDATE users SET settings=json_remove(settings,'$.heroImage') WHERE json_extract(settings,'$.heroImage')=?",
        m.id,
      );
      run(
        "UPDATE entities SET data=json_set(data,'$.cover','') WHERE json_extract(data,'$.cover')=?",
        m.id,
      );
      run("DELETE FROM media WHERE id=?", m.id);
    }
  });
  for (const m of expired) {
    for (const [folder, file] of [
      ["originals", m.file],
      ["thumbnails", m.id + ".webp"],
      ["previews", m.id + ".mp4"],
      ["previews", m.id + "-hero.webp"],
    ])
      fs.rmSync(path.join(store, folder, file), { force: true });
  }
  run("DELETE FROM sessions WHERE expires<?", Date.now());
}
cleanExpiredTrash();
setInterval(() => {
  try {
    cleanExpiredTrash();
  } catch (e) {
    console.error("Не удалось очистить истёкшую корзину", e);
  }
}, 86400000).unref();
app.get("/api/config", (_req, res) =>
  res.json({ maxFileBytes: maxFile, maxFiles: 20 }),
);
app.post("/api/media/upload", upload.single("file"), async (req, res, next) => {
  const f = req.file;
  let original = "",
    thumb = "",
    preview = "";
  try {
    const u = user(req);
    if (!f) fail(400, "Выберите файл");
    const detected = await fileTypeFromFile(f.path);
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ];
    if (!detected || !allowed.includes(detected.mime))
      fail(415, "Поддерживаются JPG, PNG, WebP, GIF, MP4 и WebM");
    const ids = z
      .array(z.string())
      .max(100)
      .parse(JSON.parse(req.body.entities || "[]"));
    const linked = ids.map((id) => entity(u.id, id));
    const space = req.body.space || linked[0]?.space || ownSpace(u.id).id,
      access = member(u.id, space);
    if (!access || access.role === "guest")
      fail(403, "Нет права загружать файлы");
    const placeId = resolvePlace(
      u.id,
      space,
      z
        .string()
        .max(200)
        .parse(req.body.place || ""),
      z
        .string()
        .trim()
        .max(120)
        .parse(req.body.placeName || ""),
    );
    if (placeId) linked.push(entity(u.id, placeId));
    if (
      linked.some(
        (e) =>
          e.space !== space ||
          (!["places", "albums"].includes(e.kind) && e.owner !== u.id),
      )
    )
      fail(403, "Выберите собственные объекты одного пространства");
    const id = randomUUID(),
      file = id + "." + detected.ext;
    preview = path.join(store, "previews", id + ".mp4");
    original = path.join(store, "originals", file);
    thumb = path.join(store, "thumbnails", id + ".webp");
    let width: null | number = null,
      height: null | number = null,
      meta: Row = {};
    if (detected.mime.startsWith("image/")) {
      const info = await createImageThumbnail(f.path, thumb);
      width = info.width;
      height = info.height;
      const exif = await exifr.parse(f.path).catch(() => null);
      if (exif) {
        if (exif.DateTimeOriginal)
          meta.taken = exif.DateTimeOriginal.toISOString();
      }
    }
    if (detected.mime.startsWith("video/"))
      meta = await processVideo(f.path, id);
    fs.renameSync(f.path, original);
    transaction(() => {
      run(
        "INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)",
        id,
        space,
        u.id,
        uploadName(f.originalname),
        file,
        detected.mime,
        f.size,
        width,
        height,
        JSON.stringify(meta),
        now(),
      );
      for (const e of linked) run("INSERT INTO links VALUES(?,?)", id, e.id);
    });
    notifyShared(u.id, space, u.name + " добавил(а) фото в семейный архив", id);
    res.status(201).json({ id });
  } catch (e) {
    if (original) fs.rmSync(original, { force: true });
    if (thumb) fs.rmSync(thumb, { force: true });
    if (preview) fs.rmSync(preview, { force: true });
    next(e);
  } finally {
    if (f) fs.rmSync(f.path, { force: true });
  }
});
app.get("/api/files/:id/:version", (req, res) => {
  const u = user(req),
    m = media(u.id, String(req.params.id));
  if (m.deleted && m.owner !== u.id) fail(403, "Файл в корзине");
  const thumb = req.params.version === "thumb";
  const hero = req.params.version === "hero";
  const preview =
    req.params.version === "preview" && m.mime.startsWith("video/");
  if (req.query.download === "1") res.attachment(m.name);
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.sendFile(
    path.join(
      store,
      thumb ? "thumbnails" : preview || hero ? "previews" : "originals",
      thumb
        ? m.id + ".webp"
        : hero
          ? m.id + "-hero.webp"
          : preview
            ? m.id + ".mp4"
            : m.file,
    ),
  );
});
app.patch("/api/media/:id", (req, res) => {
  const u = user(req),
    m = media(u.id, String(req.params.id));
  if (typeof req.body.favorite === "boolean") {
    req.body.favorite
      ? run("INSERT OR IGNORE INTO favorites VALUES(?,?)", u.id, m.id)
      : run("DELETE FROM favorites WHERE user=? AND media=?", u.id, m.id);
  }
  if (req.body.name !== undefined || req.body.entities !== undefined) {
    media(u.id, m.id, true);
    const name = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(req.body.name ?? m.name);
    const ids = z
      .array(z.string())
      .max(100)
      .parse(
        req.body.entities ??
          all("SELECT entity FROM links WHERE media=?", m.id).map(
            (l) => l.entity,
          ),
      );
    if (req.body.place || req.body.placeName) {
      const placeId = resolvePlace(
        u.id,
        m.space,
        z
          .string()
          .max(200)
          .parse(req.body.place || ""),
        z
          .string()
          .trim()
          .max(120)
          .parse(req.body.placeName || ""),
      );
      if (placeId && !ids.includes(placeId)) ids.push(placeId);
    }
    ids.forEach((id) => {
      const e = entity(u.id, id);
      if (
        e.space !== m.space ||
        (!["places", "albums"].includes(e.kind) && e.owner !== u.id)
      )
        fail(403, "Нет права изменять связи");
    });
    transaction(() => {
      run("UPDATE media SET name=? WHERE id=?", name, m.id);
      run("DELETE FROM links WHERE media=?", m.id);
      ids.forEach((id) => run("INSERT INTO links VALUES(?,?)", m.id, id));
    });
  }
  res.json({ ok: true });
});
app.post("/api/media/batch", (req, res) => {
  const u = user(req),
    b = z
      .object({
        ids: z.array(z.string()).min(1).max(1000),
        action: z.enum(["trash", "restore", "permanent", "link", "unlink"]),
        entity: z.string().optional(),
      })
      .parse(req.body);
  const files = b.ids.map((id) => media(u.id, id, true));
  if (b.action === "link" || b.action === "unlink") {
    const e = entity(u.id, b.entity || "", true);
    if (files.some((m) => m.space !== e.space))
      fail(400, "Объекты из разных пространств");
  }
  if (b.action === "permanent" && files.some((m) => !m.deleted))
    fail(400, "Сначала переместите файлы в корзину");
  transaction(() => {
    for (const m of files) {
      if (b.action === "trash" || b.action === "restore")
        run(
          "UPDATE media SET deleted=? WHERE id=?",
          b.action === "trash" ? now() : null,
          m.id,
        );
      if (b.action === "link")
        run("INSERT OR IGNORE INTO links VALUES(?,?)", m.id, b.entity);
      if (b.action === "unlink")
        run("DELETE FROM links WHERE media=? AND entity=?", m.id, b.entity);
      if (b.action === "permanent") {
        run(
          "UPDATE users SET settings=json_remove(settings, '$.avatar') WHERE json_extract(settings, '$.avatar')=?",
          m.id,
        );
        run(
          "UPDATE users SET settings=json_remove(settings,'$.heroImage') WHERE json_extract(settings,'$.heroImage')=?",
          m.id,
        );
        run(
          "UPDATE entities SET data=json_set(data,'$.cover','') WHERE json_extract(data,'$.cover')=?",
          m.id,
        );
        run("DELETE FROM media WHERE id=?", m.id);
      }
    }
  });
  if (b.action === "permanent")
    for (const m of files) {
      fs.rmSync(path.join(store, "originals", m.file), { force: true });
      fs.rmSync(path.join(store, "thumbnails", m.id + ".webp"), {
        force: true,
      });
      fs.rmSync(path.join(store, "previews", m.id + "-hero.webp"), {
        force: true,
      });
      fs.rmSync(path.join(store, "previews", m.id + ".mp4"), { force: true });
    }
  res.json({ ok: true });
});
app.get("/api/media/:id/comments", (req, res) => {
  media(user(req).id, String(req.params.id));
  res.json(
    all(
      "SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.user WHERE c.media=? ORDER BY c.created",
      String(req.params.id),
    ),
  );
});
app.post("/api/media/:id/comments", (req, res) => {
  const u = user(req),
    m = media(u.id, String(req.params.id)),
    text = z.string().trim().min(1).max(2000).parse(req.body.text),
    id = randomUUID();
  if (member(u.id, m.space)?.role === "guest")
    fail(403, "Гость может только просматривать содержимое");
  transaction(() => {
    run("INSERT INTO comments VALUES(?,?,?,?,?)", id, m.id, u.id, text, now());
    if (
      m.owner !== u.id &&
      settings(one("SELECT * FROM users WHERE id=?", m.owner)!)
        .commentNotifications
    )
      run(
        "INSERT INTO notifications VALUES(?,?,?,?,?,0)",
        randomUUID(),
        m.owner,
        m.id,
        u.name + " оставил(а) комментарий",
        now(),
      );
  });
  res.status(201).json({ id });
});
app.post("/api/notifications/read", (req, res) => {
  run("UPDATE notifications SET read=1 WHERE user=?", user(req).id);
  res.json({ ok: true });
});
app.patch("/api/profile", (req, res) => {
  const u = user(req),
    b = z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.email(),
        currentPassword: z.string().default(""),
        password: z.string().min(10).max(128).optional(),
      })
      .parse(req.body);
  if (b.email.toLowerCase() !== u.email || b.password) {
    if (!matches(b.currentPassword, u.password))
      fail(403, "Введите текущий пароль");
  }
  if (
    one(
      "SELECT id FROM users WHERE email=? AND id<>?",
      b.email.toLowerCase(),
      u.id,
    )
  )
    fail(409, "Email уже используется");
  run(
    "UPDATE users SET name=?,email=?,password=? WHERE id=?",
    b.name,
    b.email.toLowerCase(),
    b.password ? hash(b.password) : u.password,
    u.id,
  );
  if (b.password) run("DELETE FROM sessions WHERE user=?", u.id);
  if (b.password) session(res, u.id);
  res.json({ ok: true });
});
app.patch("/api/profile/appearance", async (req, res) => {
  const u = user(req);
  const body = z
    .object({
      avatar: z.string().max(200).optional(),
      heroImage: z.string().max(200).optional(),
      heroPosition: z.number().min(0).max(100).optional(),
    })
    .parse(req.body);
  for (const field of ["avatar", "heroImage"] as const) {
    if (!body[field]) continue;
    const m = media(u.id, body[field]!, true);
    if (m.deleted || !m.mime.startsWith("image/"))
      fail(400, "Выберите собственную фотографию из архива");
    if (field === "heroImage") {
      const output = path.join(store, "previews", m.id + "-hero.webp");
      if (!fs.existsSync(output))
        await createImageThumbnail(
          path.join(store, "originals", m.file),
          output,
          true,
        );
    }
  }
  const latest = one("SELECT * FROM users WHERE id=?", u.id)!;
  run(
    "UPDATE users SET settings=? WHERE id=?",
    JSON.stringify({ ...settings(latest), ...body }),
    u.id,
  );
  res.json({ ok: true });
});
app.patch("/api/settings", (req, res) => {
  const u = user(req);
  const b = z
    .object({
      theme: z.enum(["light", "dark"]),
      visibility: z.enum(["private", "family", "invited"]),
      geolocation: z.boolean(),
      desktopNotifications: z.boolean(),
      animations: z.boolean(),
      commentNotifications: z.boolean(),
      sharedNotifications: z.boolean(),
      avatar: z.string().max(200).optional(),
      heroImage: z.string().max(200).optional(),
      heroPosition: z.number().min(0).max(100).optional(),
    })
    .parse({ ...settings(u), ...req.body });
  if (b.avatar) media(u.id, b.avatar);
  if (b.heroImage) media(u.id, b.heroImage);
  run("UPDATE users SET settings=? WHERE id=?", JSON.stringify(b), u.id);
  res.json({ ok: true });
});
app.post("/api/invites", (req, res) => {
  const u = user(req),
    space = req.body.space
      ? one(
          "SELECT * FROM spaces WHERE id=? AND owner=?",
          z.string().parse(req.body.space),
          u.id,
        ) || fail(403, "Приглашать может владелец семьи")
      : ownSpace(u.id),
    role = z.enum(["member", "guest"]).parse(req.body.role || "member"),
    token = randomBytes(24).toString("hex");
  run(
    "INSERT INTO invites VALUES(?,?,?,?)",
    token,
    space.id,
    role,
    Date.now() + 7 * 86400000,
  );
  res.status(201).json({ token });
});
app.post("/api/invites/join", (req, res) => {
  const u = user(req),
    token = z.string().parse(req.body.token),
    i =
      one(
        "SELECT * FROM invites WHERE token=? AND expires>?",
        token,
        Date.now(),
      ) || fail(404, "Приглашение недействительно");
  if (member(u.id, i.space)) fail(409, "Вы уже состоите в этой семье");
  transaction(() => {
    run("INSERT OR IGNORE INTO members VALUES(?,?,?)", i.space, u.id, i.role);
    run("DELETE FROM invites WHERE token=?", token);
  });
  res.json({ ok: true, space: i.space });
});
app.patch("/api/members/:space/:id", (req, res) => {
  const u = user(req),
    space = String(req.params.space),
    id = String(req.params.id);
  const family = one(
    "SELECT * FROM spaces WHERE id=? AND owner=?",
    space,
    u.id,
  );
  if (!family || id === u.id || !member(id, space))
    fail(403, "Изменять доступ может владелец семьи");
  const b = z
    .object({
      label: z.string().trim().max(80),
      role: z.enum(["member", "guest"]),
      blockedAlbums: z.array(z.string()).max(500),
    })
    .parse(req.body);
  for (const album of b.blockedAlbums) {
    const e = one(
      "SELECT * FROM entities WHERE id=? AND space=? AND kind='albums'",
      album,
      space,
    );
    if (!e) fail(400, "Альбом не найден в этой семье");
  }
  transaction(() => {
    run(
      "UPDATE members SET role=? WHERE space=? AND user=?",
      b.role,
      space,
      id,
    );
    run(
      "INSERT INTO member_preferences VALUES(?,?,?,?) ON CONFLICT(space,user) DO UPDATE SET label=excluded.label,blockedAlbums=excluded.blockedAlbums",
      space,
      id,
      b.label,
      JSON.stringify(b.blockedAlbums),
    );
  });
  res.json({ ok: true });
});
app.delete("/api/members/:space/:id", (req, res) => {
  const u = user(req),
    s = one("SELECT * FROM spaces WHERE id=?", String(req.params.space));
  if (!s || s.owner !== u.id || req.params.id === u.id)
    fail(403, "Нет права удалить участника");
  run(
    "DELETE FROM member_preferences WHERE space=? AND user=?",
    s.id,
    String(req.params.id),
  );
  run(
    "DELETE FROM members WHERE space=? AND user=?",
    s.id,
    String(req.params.id),
  );
  res.json({ ok: true });
});
app.get("/api/export", (req, res) => {
  const uid = user(req).id,
    files = all("SELECT * FROM media WHERE owner=?", uid).filter((m) =>
      canMedia(uid, m),
    ),
    entities = all("SELECT * FROM entities WHERE owner=?", uid).filter((e) =>
      canEntity(uid, e),
    );
  const manifest = {
    version: 1,
    entities,
    media: files,
    favorites: all("SELECT media FROM favorites WHERE user=?", uid),
    links: all(
      "SELECT l.* FROM links l JOIN media m ON m.id=l.media WHERE m.owner=?",
      uid,
    ),
  };
  res.attachment("FamilyAlbums-backup.zip");
  const zip = new yazl.ZipFile();
  zip.on("error", () => res.destroy());
  zip.outputStream.pipe(res);
  zip.addBuffer(Buffer.from(JSON.stringify(manifest)), "manifest.json");
  for (const m of files) {
    zip.addFile(path.join(store, "originals", m.file), "originals/" + m.file);
    const thumb = path.join(store, "thumbnails", m.id + ".webp");
    if (fs.existsSync(thumb))
      zip.addFile(thumb, "thumbnails/" + m.id + ".webp");
  }
  zip.end();
});
app.post("/api/restore", upload.single("file"), async (req, res, next) => {
  const f = req.file;
  const made: string[] = [];
  try {
    const u = user(req);
    if (!f) fail(400, "Выберите ZIP-копию");
    const zip = new AdmZip(f.path);
    if (
      zip.getEntries().reduce((sum, e) => sum + e.header.size, 0) >
      2 * 1024 ** 3
    )
      fail(400, "Распакованный архив больше 2 ГБ");
    const manifest = JSON.parse(zip.readAsText("manifest.json"));
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.media) ||
      !Array.isArray(manifest.entities) ||
      !Array.isArray(manifest.links)
    )
      fail(400, "Некорректная копия");
    const mappings = new Map<string, string>(),
      space = ownSpace(u.id).id;
    const restored: Row[] = [];
    for (const m of manifest.media) {
      const id = randomUUID();
      mappings.set(m.id, id);
      const source = zip.getEntry("originals/" + path.basename(m.file));
      if (!source) fail(400, "В копии отсутствует оригинал");
      const file = id + path.extname(m.file);
      const dest = path.join(store, "originals", file);
      fs.writeFileSync(dest, source.getData());
      made.push(dest);
      const type = await fileTypeFromFile(dest);
      if (
        !type ||
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
        ].includes(type.mime)
      )
        fail(400, "Недопустимый файл в копии");
      if (type.mime.startsWith("image/")) {
        const thumb = path.join(store, "thumbnails", id + ".webp");
        made.push(thumb);
        const info = await createImageThumbnail(dest, thumb);
        m.width = info.width;
        m.height = info.height;
      }
      if (type.mime.startsWith("video/")) {
        made.push(
          path.join(store, "previews", id + ".mp4"),
          path.join(store, "thumbnails", id + ".webp"),
        );
        m.meta = JSON.stringify({
          ...JSON.parse(m.meta),
          ...(await processVideo(dest, id)),
        });
      }
      restored.push({
        ...m,
        id,
        file,
        mime: type.mime,
        size: fs.statSync(dest).size,
      });
    }
    const es = manifest.entities.map((e: Row) => {
      const id = randomUUID();
      mappings.set(e.id, id);
      return {
        ...e,
        id,
        body: entityBody.parse({ ...JSON.parse(e.data), name: e.name }),
      };
    });
    transaction(() => {
      for (const e of es) {
        if (!kinds.includes(e.kind)) fail(400, "Недопустимая коллекция");
        const b = {
          ...e.body,
          cover: mappings.get(e.body.cover) || "",
          place: mappings.get(e.body.place) || "",
          space,
          invited: [],
        };
        run(
          "INSERT INTO entities VALUES(?,?,?,?,?,?,?)",
          e.id,
          space,
          u.id,
          e.kind,
          b.name,
          JSON.stringify(b),
          now(),
        );
      }
      for (const m of restored)
        run(
          "INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          m.id,
          space,
          u.id,
          z.string().max(200).parse(m.name),
          m.file,
          m.mime,
          m.size,
          m.width,
          m.height,
          JSON.stringify(JSON.parse(m.meta)),
          m.created,
          m.deleted,
        );
      for (const f of manifest.favorites || []) {
        const m = mappings.get(f.media);
        if (m) run("INSERT OR IGNORE INTO favorites VALUES(?,?)", u.id, m);
      }
      for (const l of manifest.links) {
        const m = mappings.get(l.media),
          e = mappings.get(l.entity);
        if (m && e) run("INSERT OR IGNORE INTO links VALUES(?,?)", m, e);
      }
    });
    res.json({ ok: true, count: restored.length });
  } catch (e) {
    for (const file of made) fs.rmSync(file, { force: true });
    next(e);
  } finally {
    if (f) fs.rmSync(f.path, { force: true });
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Маршрут не найден" }),
);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ImageProcessingError
          ? 422
          : error instanceof z.ZodError
            ? 400
            : error instanceof multer.MulterError
              ? 413
              : 500;
    if (status === 500) console.error(error);
    res.status(status).json({
      error:
        error instanceof z.ZodError
          ? "Проверьте введённые данные"
          : error instanceof multer.MulterError
            ? "Превышен лимит загрузки"
            : status === 500
              ? "Ошибка сервера"
              : error.message,
    });
  },
);
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
}
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Семейные альбомы: http://localhost:" + (process.env.PORT || 3000),
    ),
);
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
