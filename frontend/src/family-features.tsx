import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Heart, Bell, HardDrive, Sparkles } from "lucide-react";
import { api, date, size, src } from "./types";
import type { State, Media } from "./types";
import { Select } from "./controls";

export function PlaceFields({
  state,
  space,
  initial = "",
  disabled = false,
}: {
  state: State;
  space?: string;
  initial?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="place-fields">
      <label>
        Место события
        <Select
          name="place"
          aria-label="Место события"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Не указано</option>
          {state.entities
            .filter((e) => e.kind === "places" && (!space || e.space === space))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          <option value="new">Вписать новое место…</option>
        </Select>
      </label>
      {value === "new" && (
        <label>
          Название нового места
          <input
            name="placeName"
            placeholder="Например, Сочи · пляж Ривьера"
            maxLength={120}
            required
            disabled={disabled}
          />
        </label>
      )}
      <small>Место объединит фотографии события во вкладке «Места».</small>
    </div>
  );
}
export function MemoriesPage({
  files,
  entities,
  onOpen,
  onUpload,
  query,
}: {
  files: Media[];
  entities: State["entities"];
  onOpen: (id: string) => void;
  onUpload: () => void;
  query: string;
}) {
  const [tab, setTab] = useState("day"),
    [year, setYear] = useState(""),
    [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [tab, year, query]);
  const now = new Date();
  const taken = (m: Media) => new Date(m.meta.taken || m.created);
  const day = files.filter((m) => {
    const d = taken(m);
    return (
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate() &&
      d.getFullYear() < now.getFullYear()
    );
  });
  const month = files.filter((m) => {
    const d = taken(m);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear()
    );
  });
  const favorite = files.filter((m) => m.favorite);
  const years = [...new Set(files.map((m) => String(taken(m).getFullYear())))]
    .sort()
    .reverse();
  const shown = (
    tab === "day"
      ? day
      : tab === "month"
        ? month
        : tab === "favorites"
          ? favorite
          : files
  ).filter(
    (m) =>
      (!year || String(taken(m).getFullYear()) === year) &&
      (!query || m.name.toLowerCase().includes(query.toLowerCase())),
  );
  const visible = shown.slice(0, limit);
  const groups = [
    ...new Set(visible.map((m) => String(taken(m).getFullYear()))),
  ]
    .sort()
    .reverse();
  const albums = entities.filter(
    (e) =>
      e.kind === "albums" &&
      e.eventDate &&
      new Date(e.eventDate).getMonth() === now.getMonth(),
  );
  return (
    <section className="memories-page">
      <div className="memory-intro">
        <span className="feature-symbol">
          <Sparkles />
        </span>
        <div>
          <h2>История вашей семьи</h2>
          <p>
            Возвращайтесь к любимым моментам. Даты берём из фотографии, а если
            их нет — из даты загрузки.
          </p>
        </div>
      </div>
      <div
        className="memory-tabs"
        role="group"
        aria-label="Подборки воспоминаний"
      >
        {[
          ["day", "В этот день", day.length],
          ["month", "В этом месяце", month.length],
          ["favorites", "Любимые моменты", favorite.length],
          ["years", "История по годам", files.length],
        ].map(([id, title, count]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(String(id));
              setYear("");
            }}
          >
            {title}
            <small>{count}</small>
          </button>
        ))}
      </div>
      {tab === "years" && (
        <label className="memory-year">
          Год
          <Select
            aria-label="Год воспоминаний"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">Все годы</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
        </label>
      )}
      {shown.length ? (
        groups.map((y) => (
          <section className="memory-year-group" key={y}>
            <h3>
              <Calendar size={21} />
              {y}
              <small>
                Моментов ·{" "}
                {
                  shown.filter((m) => String(taken(m).getFullYear()) === y)
                    .length
                }
              </small>
            </h3>
            <div className="memory-photo-grid">
              {visible
                .filter((m) => String(taken(m).getFullYear()) === y)
                .map((m) => (
                  <button
                    className="memory-photo"
                    key={m.id}
                    onClick={() => onOpen(m.id)}
                    aria-label={"Открыть " + m.name}
                  >
                    <img src={src(m)} alt="" loading="lazy" />
                    <span>
                      <strong>{m.name}</strong>
                      <small>{date(m.meta.taken || m.created)}</small>
                    </span>
                    {m.favorite && (
                      <Heart
                        className="memory-heart"
                        size={18}
                        fill="currentColor"
                      />
                    )}
                  </button>
                ))}
            </div>
          </section>
        ))
      ) : (
        <div className="memory-empty">
          <Calendar size={36} />
          <h3>
            {query
              ? "Ничего не найдено"
              : tab === "day"
                ? "В этот день пока нет снимков прошлых лет"
                : tab === "month"
                  ? "В этом месяце пока нет снимков прошлых лет"
                  : tab === "favorites"
                    ? "Соберите любимые моменты"
                    : "Начните историю вашей семьи"}
          </h3>
          <p>
            {tab === "favorites"
              ? "Нажмите сердечко на фотографии — она появится в этой подборке."
              : "Загрузите старые фотографии с датой съёмки или откройте всю историю по годам."}
          </p>
          <div className="feature-actions">
            <button
              className="primary"
              onClick={() => {
                setTab("years");
                setYear("");
              }}
            >
              История по годам
            </button>
            <button className="secondary" onClick={onUpload}>
              Загрузить фото
            </button>
          </div>
        </div>
      )}
      {shown.length > limit && (
        <button className="secondary" onClick={() => setLimit((n) => n + 60)}>
          Показать ещё воспоминания
        </button>
      )}
      {albums.length > 0 && (
        <section className="anniversary-list">
          <h3>События этого месяца</h3>
          {albums.map((e) => (
            <Link key={e.id} to={"/albums/" + e.id}>
              <Calendar size={19} />
              <span>
                <strong>{e.name}</strong>
                <small>{date(e.eventDate!)}</small>
              </span>
            </Link>
          ))}
        </section>
      )}
    </section>
  );
}
type StorageInfo = {
  used: number;
  originals: number;
  thumbnails: number;
  previews: number;
  free: number;
  total: number;
  photos: number;
  videos: number;
  trash: number;
};
export function StoragePanel({
  version,
  compact = false,
}: {
  version: number;
  compact?: boolean;
}) {
  const [info, setInfo] = useState<StorageInfo | null>(null),
    [error, setError] = useState("");
  const load = () =>
    api("/storage")
      .then((v) => {
        setInfo(v);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [version]);
  if (compact)
    return (
      <Link to="/settings#storage" className="storage storage-link">
        <span>
          <HardDrive size={15} />
          Хранилище
        </span>
        <strong>{info ? size(info.used) : "…"}</strong>
        {info && (
          <>
            <div
              className="storage-meter"
              aria-label="Использование диска"
              role="meter"
              aria-valuenow={Math.round(
                ((info.total - info.free) / Math.max(info.total, 1)) * 100,
              )}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i
                style={{
                  width:
                    Math.min(
                      100,
                      ((info.total - info.free) / Math.max(info.total, 1)) *
                        100,
                    ) + "%",
                }}
              />
            </div>
            <small>На диске свободно {size(info.free)}</small>
          </>
        )}
      </Link>
    );
  return (
    <section className="settings-card storage-detail" id="storage">
      <h2>
        <HardDrive />
        Ваше хранилище
      </h2>
      {info ? (
        <>
          <div className="storage-total">
            <strong>{size(info.used)}</strong>
            <span>
              ваши файлы и миниатюры · {info.photos} фото · {info.videos} видео
            </span>
          </div>
          <div className="storage-breakdown">
            {[
              ["Оригиналы", info.originals],
              ["Миниатюры", info.thumbnails],
              ["Превью", info.previews],
            ].map(([label, bytes]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{size(Number(bytes))}</strong>
              </div>
            ))}
          </div>
          <div className="storage-meter">
            <i
              style={{
                width:
                  Math.min(
                    100,
                    ((info.total - info.free) / Math.max(info.total, 1)) * 100,
                  ) + "%",
              }}
            />
          </div>
          <p>
            На диске сервера свободно {size(info.free)} из {size(info.total)}.
            Это общий диск, отдельная квота для семьи не установлена.
          </p>
          {info.trash > 0 && (
            <Link to="/trash">
              В корзине {size(info.trash)} · посмотреть и освободить место
            </Link>
          )}
        </>
      ) : (
        <p role="status">{error || "Считаем ваши файлы…"}</p>
      )}
      <button className="text-button" onClick={() => void load()}>
        Обновить сведения
      </button>
    </section>
  );
}
export function BrowserNotificationsSetting({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const [permission, setPermission] = useState(
      typeof Notification !== "undefined"
        ? Notification.permission
        : "unsupported",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    let status: PermissionStatus | undefined,
      disposed = false;
    const sync = () => setPermission(Notification.permission);
    if (navigator.permissions)
      void navigator.permissions
        .query({ name: "notifications" })
        .then((value) => {
          if (disposed) return;
          status = value;
          status.addEventListener("change", sync);
        })
        .catch(() => {});
    window.addEventListener("focus", sync);
    return () => {
      disposed = true;
      status?.removeEventListener("change", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  const request = async () => {
    try {
      if (!window.isSecureContext || typeof Notification === "undefined")
        throw new Error(
          "Браузерные уведомления доступны по HTTPS или на localhost.",
        );
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === "granted") {
        if ("serviceWorker" in navigator)
          await navigator.serviceWorker.register("/sw.js");
        onChange(true);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="browser-notification-setting">
      <h3>
        <Bell size={20} />
        Уведомления браузера
      </h3>
      <p>
        Сообщим о новых фотографиях и комментариях, когда архив открыт в другой
        вкладке. При закрытом сайте уведомления не приходят.
      </p>
      {permission === "granted" ? (
        <button
          type="button"
          role="switch"
          aria-label="Уведомления браузера"
          aria-checked={enabled}
          className={"switch " + (enabled ? "on" : "")}
          onClick={() => onChange(!enabled)}
        >
          <i />
        </button>
      ) : (
        <button
          type="button"
          className="secondary"
          disabled={permission === "denied" || permission === "unsupported"}
          onClick={() => void request()}
        >
          Разрешить уведомления
        </button>
      )}
      {permission === "denied" && (
        <small>
          Разрешите уведомления в настройках браузера для этого сайта.
        </small>
      )}
      {permission === "unsupported" && (
        <small>Этот браузер не поддерживает уведомления.</small>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function useFamilyNotifications(
  user: State["user"],
  onItems: (items: State["notifications"]) => void,
  onAccessChanged: () => void,
) {
  const callback = useRef(onItems);
  callback.current = onItems;
  const accessChanged = useRef(onAccessChanged);
  accessChanged.current = onAccessChanged;
  useEffect(() => {
    if (!user) return;
    let disposed = false,
      busy = false;
    const seen = new Set<string>();
    let initialized = false,
      accessRevision = "";
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const snapshot = await api("/notifications");
        const items: State["notifications"] = snapshot.items;
        if (disposed) return;
        callback.current(items);
        if (
          accessRevision &&
          snapshot.accessRevision &&
          accessRevision !== snapshot.accessRevision
        )
          accessChanged.current();
        accessRevision = snapshot.accessRevision || "";
        for (const item of [...items].reverse()) {
          if (
            !seen.has(item.id) &&
            initialized &&
            !item.read &&
            snapshot.desktopNotifications &&
            document.hidden &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            const key = "album-notification-" + user.id;
            let ids: string[] = [];
            try {
              ids = JSON.parse(localStorage.getItem(key) || "[]");
            } catch {}
            if (!ids.includes(item.id)) {
              try {
                localStorage.setItem(
                  key,
                  JSON.stringify([...ids, item.id].slice(-150)),
                );
              } catch {}
              const options = {
                body: item.text,
                tag: item.id,
                data: { url: "/photos" },
              };
              if ("serviceWorker" in navigator) {
                const worker = await navigator.serviceWorker.register("/sw.js");
                await navigator.serviceWorker.ready;
                await worker.showNotification("Семейные альбомы", options);
              } else {
                const n = new Notification("Семейные альбомы", options);
                n.onclick = () => {
                  window.focus();
                  location.assign("/photos");
                };
              }
            }
          }
          seen.add(item.id);
        }
        initialized = true;
      } catch {
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 15000);
    const focus = () => void poll();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [user?.id, user?.settings.desktopNotifications]);
}
export function MemberAccess({
  member,
  albums,
  onSave,
  onCancel,
}: {
  member: State["members"][number];
  albums: State["entities"];
  onSave: (b: unknown) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(member.label || ""),
    [role, setRole] = useState(member.role),
    [blocked, setBlocked] = useState(member.blockedAlbums || []),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-access"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onSave({ label, role, blockedAlbums: blocked })) onCancel();
        setBusy(false);
      }}
    >
      <h3>Доступ · {member.name}</h3>
      <label>
        Семейная пометка
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder="Например, ребёнок · Миша или бабушка · Ирина"
        />
      </label>
      <label>
        Права участника
        <Select
          aria-label="Права участника"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">Просмотр и свои загрузки</option>
          <option value="guest">Только просмотр</option>
        </Select>
      </label>
      <label>
        Скрытые альбомы
        <Select
          multiple
          aria-label="Скрытые альбомы"
          value={blocked}
          onChange={(e) =>
            setBlocked(e.target.selectedOptions.map((o) => o.value))
          }
        >
          {albums
            .filter((e) => e.space === member.space && e.kind === "albums")
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </Select>
      </label>
      <small>
        Фотографии из скрытого альбома недоступны этому участнику во всех
        разделах, включая поиск и прямые ссылки.
      </small>
      <div className="feature-actions">
        <button className="primary" disabled={busy}>
          {busy ? "Сохранение…" : "Сохранить доступ"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
