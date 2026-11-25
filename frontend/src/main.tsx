import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import Landing from "./Landing";
import {
  PlaceFields,
  MemoriesPage,
  StoragePanel,
  BrowserNotificationsSetting,
  useFamilyNotifications,
  MemberAccess,
} from "./family-features";
import { ThemeProvider, useTheme } from "./theme";
import type { Theme } from "./theme";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  Images,
  FolderHeart,
  Video,
  Heart,
  Users,
  MapPin,
  Tag,
  Trash2,
  Settings as SettingsIcon,
  Search,
  Upload,
  Plus,
  Bell,
  UserRound,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Check,
  Grid2X2,
  List,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  LogOut,
  Shield,
  Sun,
  Sparkles,
  Moon,
  MessageCircle,
  Share2,
  Cloud,
  Monitor,
  SlidersHorizontal,
  Calendar,
  Leaf,
  Map as MapIcon,
  ImagePlus,
  FolderPlus,
  Pencil,
  Copy,
  CheckSquare,
  RotateCcw,
} from "lucide-react";
import { api, src, size, date } from "./types";
import type { State, Entity, Media, Settings, User } from "./types";
const emptyState: State = {
  user: null,
  media: [],
  entities: [],
  spaces: [],
  members: [],
  notifications: [],
  bytes: 0,
};
import {
  Select,
  DateField,
  DialogProvider,
  useDialogs,
  useScrollLock,
} from "./controls";
import "./style.css";

const PlacesMap = lazy(() => import("./PlacesMap"));
const navigation = [
  ["/", "Главная", Home],
  ["/albums", "Альбомы", FolderHeart],
  ["/photos", "Все фото", Images],
  ["/videos", "Видео", Video],
  ["/favorites", "Избранное", Heart],
  ["/memories", "Воспоминания", Calendar],
  ["/people", "Люди", UserRound],
  ["/places", "Места", MapPin],
  ["/tags", "Теги", Tag],
  ["/trash", "Корзина", Trash2],
] as const;
const categories: Record<string, string[]> = {
  people: ["Все люди", "Родные", "Друзья", "Без метки"],
  places: ["Все места", "Путешествия", "Дом и быт", "Природа", "Города"],
  tags: ["Все теги", "Семья", "События", "Отдых", "Праздники", "Хобби", "Своё"],
};
const titles: Record<string, string> = {
  albums: "Наш семейный архив ❤️",
  photos: "Все фотографии",
  videos: "Видео",
  favorites: "Избранное",
  people: "Люди",
  places: "Места",
  tags: "Теги",
  trash: "Корзина",
  settings: "Настройки",
  memories: "Воспоминания",
  profile: "Настройки профиля",
};
const descriptions: Record<string, string> = {
  people: "Все близкие в одном месте — находите фото родных быстрее",
  places:
    "Все ваши фото по местоположению — путешествия, дом, города и любимые места",
  tags: "Помечайте фото тегами, чтобы легко находить нужные моменты",
  trash: "Удалённые файлы хранятся здесь 30 дней",
  settings: "Управляйте вашим профилем, альбомами и приватностью",
  photos: "Все важные моменты — всегда рядом",
  videos: "Истории, которые хочется пересматривать",
  favorites: "Моменты, к которым хочется возвращаться",
  profile: "Личные данные, обложка главной и участники вашей семьи",
};
const iconFor: Record<string, React.ElementType> = {
  people: UserRound,
  places: MapPin,
  tags: Tag,
  settings: SettingsIcon,
  trash: Trash2,
  profile: UserRound,
};
type Modal = { type: string; entity?: Entity; kind?: string };
function ModalFrame({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useScrollLock();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="Закрыть" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
function App() {
  const { confirm } = useDialogs();
  const { setTheme, adoptTheme, markSaved, getPreference } = useTheme();
  const location = useLocation(),
    navigate = useNavigate(),
    page = location.pathname.split("/")[1] || "home",
    detailId = location.pathname.split("/")[2];
  const [pageNumber, setPageNumber] = useState(0);
  const [state, setState] = useState<State>(emptyState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [viewer, setViewer] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("new"),
    [list, setList] = useState(false),
    [year, setYear] = useState(""),
    [season, setSeason] = useState(""),
    [person, setPerson] = useState(""),
    [place, setPlace] = useState(""),
    [fileType, setFileType] = useState(""),
    [showFilters, setShowFilters] = useState(false);
  useFamilyNotifications(
    state.user,
    (items) => setState((current) => ({ ...current, notifications: items })),
    () => void refresh(),
  );
  useEffect(() => {
    document.documentElement.dataset.motion =
      state.user?.settings.animations === false ? "reduced" : "full";
  }, [state.user?.settings.animations]);
  const refresh = useCallback(async () => {
    try {
      const me = await api("/me");
      setState(me ? await api("/state") : emptyState);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  useEffect(() => {
    if (viewer && !state.media.some((m) => m.id === viewer)) setViewer(null);
  }, [state.media, viewer]);
  useLayoutEffect(() => {
    if (!state.user) return;
    const account = state.user;
    const preference = getPreference();
    if (preference && preference.theme !== account.settings.theme) {
      const chosen = preference.theme;
      void api("/settings", "PATCH", { theme: chosen })
        .then(() => {
          if (getPreference()?.theme !== chosen) return;
          markSaved(chosen);
          setState((current) =>
            current.user?.id === account.id
              ? {
                  ...current,
                  user: {
                    ...current.user,
                    settings: { ...current.user.settings, theme: chosen },
                  },
                }
              : current,
          );
        })
        .catch(() => {
          /* Keep the device preference until the next successful save. */
        });
    } else adoptTheme(preference?.theme || account.settings.theme);
  }, [state.user?.id]);
  useEffect(() => {
    if (!loading && !state.user && location.pathname !== "/")
      navigate("/", { replace: true });
  }, [loading, state.user?.id, location.pathname]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setCategory("");
    setNotifications(false);
    setSelected([]);
    setMobile(false);
    setQuery("");
    setYear("");
    setPerson("");
    setPlace("");
    setSeason("");
    setFileType("");
  }, [location.pathname]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!notifications) return;
    const close = (e: PointerEvent) => {
      if (
        !(e.target as Element).closest(
          ".notification-panel,.notification-button",
        )
      )
        setNotifications(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifications(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [notifications]);
  useEffect(() => {
    const viewport = window.matchMedia(
      "(max-width:760px), (max-width:1000px) and (max-height:500px)",
    );
    const resize = () => {
      if (!viewport.matches) setMobile(false);
    };
    viewport.addEventListener("change", resize);
    return () => viewport.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobile]);
  const requireUser = () => {
    if (!state.user) {
      setModal({ type: "auth" });
      return false;
    }
    return true;
  };
  const perform = async (
    fn: () => Promise<unknown>,
    message = "Изменения сохранены",
  ) => {
    setToast("");
    try {
      await fn();
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  };
  const openCreate = (kind: string) => {
    if (requireUser()) setModal({ type: "entity", kind });
  };
  const openUpload = () => {
    if (requireUser()) setModal({ type: "upload" });
  };
  const live = state.media.filter((m) => !m.deleted),
    currentEntity = state.entities.find((e) => e.id === detailId);
  let media = state.media.filter((m) =>
    page === "trash" ? !!m.deleted : !m.deleted,
  );
  if (page === "videos")
    media = media.filter((m) => m.mime.startsWith("video"));
  if (page === "photos")
    media = media.filter((m) => m.mime.startsWith("image"));
  if (page === "favorites") media = media.filter((m) => m.favorite);
  if (detailId) media = media.filter((m) => m.entities.includes(detailId));
  if (year)
    media = media.filter(
      (m) => String(new Date(m.meta.taken || m.created).getFullYear()) === year,
    );
  if (season)
    media = media.filter(
      (m) =>
        String(
          Math.floor(
            ((new Date(m.meta.taken || m.created).getMonth() + 1) % 12) / 3,
          ),
        ) === season,
    );
  if (person) media = media.filter((m) => m.entities.includes(person));
  if (place) media = media.filter((m) => m.entities.includes(place));
  if (fileType) media = media.filter((m) => m.mime.startsWith(fileType));
  if (query)
    media = media.filter((m) =>
      (
        m.name +
        " " +
        m.entities
          .map((id) => state.entities.find((e) => e.id === id)?.name || "")
          .join(" ")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const sortMedia = (a: Media, b: Media) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "ru")
      : sort === "size"
        ? b.size - a.size
        : sort === "old"
          ? a.created.localeCompare(b.created)
          : b.created.localeCompare(a.created);
  media.sort(sortMedia);
  useEffect(
    () => setPageNumber(0),
    [page, detailId, query, year, season, person, place, fileType, sort],
  );
  const visibleMedia = media.slice(pageNumber * 120, (pageNumber + 1) * 120);
  const count = (e: Entity) =>
    live.filter((m) => m.entities.includes(e.id)).length;
  const cover = (e: Entity) =>
    e.cover?.startsWith("/assets/")
      ? e.cover
      : live.find((m) => m.id === e.cover)
        ? src(live.find((m) => m.id === e.cover)!)
        : live.find((m) => m.entities.includes(e.id))
          ? src(live.find((m) => m.entities.includes(e.id))!)
          : "";
  const entities = state.entities
    .filter(
      (e) =>
        e.kind === page &&
        (!category || e.category === category) &&
        (!query || e.name.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ru")
        : sort === "count"
          ? count(b) - count(a)
          : b.created.localeCompare(a.created),
    );
  const batch = async (action: string, ids = selected, entity?: string) => {
    if (!requireUser() || !ids.length) return;
    if (
      action === "permanent" &&
      !(await confirm(
        "Удалить выбранные файлы навсегда? Восстановить их будет невозможно.",
      ))
    )
      return;
    if (
      await perform(
        () => api("/media/batch", "POST", { ids, action, entity }),
        action === "restore"
          ? "Файлы восстановлены"
          : action === "trash"
            ? "Файлы перемещены в корзину"
            : "Готово",
      )
    ) {
      setSelected([]);
      if (action === "trash" || action === "permanent") setViewer(null);
    }
  };
  const toggle = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const cards = (files: Media[], limit?: number) => (
    <div
      className={"photo-grid " + (list && page !== "home" ? "list-view" : "")}
    >
      {files.slice(0, limit || 200).map((m) => (
        <article
          key={m.id}
          className={
            "photo-card " + (selected.includes(m.id) ? "selected" : "")
          }
        >
          <button
            className="photo-open"
            onClick={() => setViewer(m.id)}
            aria-label={"Открыть " + m.name}
          >
            {m.mime.startsWith("video") ? (
              <>
                <img
                  draggable={false}
                  src={src(m)}
                  alt={m.name}
                  loading="lazy"
                />
                <span className="video-label">
                  <Video size={15} />{" "}
                  {m.meta.duration
                    ? Math.floor(m.meta.duration / 60) +
                      ":" +
                      String(Math.floor(m.meta.duration % 60)).padStart(2, "0")
                    : "Видео"}
                </span>
              </>
            ) : (
              <img draggable={false} src={src(m)} alt={m.name} loading="lazy" />
            )}
          </button>
          <button
            hidden={!!state.user && m.owner !== state.user.id}
            className="select-photo"
            aria-label={"Выбрать " + m.name}
            aria-pressed={selected.includes(m.id)}
            onClick={() => toggle(m.id)}
          >
            {selected.includes(m.id) ? <Check size={16} /> : <span />}
          </button>
          {m.favorite && (
            <Heart className="favorite-marker" size={17} fill="currentColor" />
          )}
          {page === "trash" ? (
            <small className="photo-caption">
              Осталось{" "}
              {Math.max(
                0,
                30 -
                  Math.floor(
                    (Date.now() - new Date(m.deleted!).getTime()) / 86400000,
                  ),
              )}{" "}
              дней
            </small>
          ) : (
            list &&
            page !== "home" && (
              <span className="photo-caption">
                <span className="media-name">{m.name}</span>
                <small>{date(m.created)}</small>
              </span>
            )
          )}
        </article>
      ))}
    </div>
  );
  const entityCards = (items: Entity[], create = false) => (
    <div
      className={
        "entity-grid " +
        (page === "people" ? "people-grid " : "") +
        (list && page !== "home" ? "entity-list" : "")
      }
    >
      {create && (
        <button className="create-card" onClick={() => openCreate(page)}>
          <Plus size={30} />
          Создать альбом
        </button>
      )}
      {items.map((e) => (
        <article className="entity-card" key={e.id}>
          <Link to={"/" + e.kind + "/" + e.id}>
            {cover(e) ? (
              <img draggable={false} src={cover(e)} alt="" loading="lazy" />
            ) : (
              <div className="no-cover">
                <Images />
              </div>
            )}
            <div>
              <strong>
                {e.kind === "tags" && <Tag size={17} />}{" "}
                {e.kind === "places" && <MapPin size={17} />}{" "}
                <span className="entity-name">{e.name}</span>
              </strong>
              <span>{count(e)} фото</span>
            </div>
          </Link>
          {state.user?.id === e.owner && (
            <button
              className="edit-card icon"
              aria-label={"Изменить " + e.name}
              onClick={() =>
                setModal({ type: "entity", kind: e.kind, entity: e })
              }
            >
              <Pencil size={15} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
  const filters = (
    <div className="filters">
      <label>
        <Calendar size={18} />
        <Select
          aria-label="Год"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Все годы</option>
          {[
            ...new Set(
              live.map((m) =>
                String(new Date(m.meta.taken || m.created).getFullYear()),
              ),
            ),
          ]
            .sort()
            .reverse()
            .map((y) => (
              <option key={y}>{y}</option>
            ))}
        </Select>
      </label>
      <label>
        <Leaf size={18} />
        <Select
          aria-label="Время года"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
        >
          <option value="">Все времена года</option>
          {["Зима", "Весна", "Лето", "Осень"].map((s, i) => (
            <option key={s} value={String(i)}>
              {s}
            </option>
          ))}
        </Select>
      </label>
      {["places", "people"].map((kind) => (
        <label key={kind}>
          {kind === "places" ? <MapPin size={18} /> : <UserRound size={18} />}
          <Select
            aria-label={kind === "places" ? "Место" : "Человек"}
            value={kind === "places" ? place : person}
            onChange={(e) =>
              (kind === "places" ? setPlace : setPerson)(e.target.value)
            }
          >
            <option value="">
              {kind === "places" ? "Все места" : "Все люди"}
            </option>
            {state.entities
              .filter((e) => e.kind === kind)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </label>
      ))}
      <button
        className="secondary"
        onClick={() => setShowFilters(!showFilters)}
      >
        <SlidersHorizontal size={18} /> Ещё фильтры
      </button>
      {showFilters && (
        <>
          <Select
            aria-label="Тип файла"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
          >
            <option value="">Все файлы</option>
            <option value="image">Фото</option>
            <option value="video">Видео</option>
          </Select>
          <button
            onClick={() => {
              setYear("");
              setSeason("");
              setPerson("");
              setPlace("");
              setFileType("");
            }}
          >
            Сбросить
          </button>
        </>
      )}
    </div>
  );
  const authenticated = async () => {
    await refresh();
    setModal(null);
    navigate("/");
  };
  if (loading)
    return (
      <div className="app-loading">
        <div className="brand-icon">
          <Images size={30} />
        </div>
        <p>Открываем семейные альбомы…</p>
      </div>
    );
  if (!state.user)
    return (
      <>
        <Landing
          onRegister={() => setModal({ type: "auth", kind: "register" })}
          onLogin={() => setModal({ type: "auth", kind: "login" })}
          error={error}
          onRetry={() => void refresh()}
        />
        {modal?.type === "auth" && (
          <Auth
            initialRegister={modal.kind !== "login"}
            onClose={() => setModal(null)}
            onDone={authenticated}
          />
        )}
      </>
    );
  return (
    <>
      <aside
        id="family-navigation"
        className={mobile ? "sidebar open" : "sidebar"}
      >
        <Link to="/" className="brand" onClick={() => setMobile(false)}>
          <div className="brand-icon">
            <Images size={31} />
          </div>
          <b>
            Семейные
            <br />
            альбомы
          </b>
        </Link>
        <nav>
          {navigation.map(([url, label, Icon]) => (
            <Link
              key={url}
              to={url}
              onClick={() => setMobile(false)}
              className={
                location.pathname === url ||
                (url !== "/" && location.pathname.startsWith(url + "/"))
                  ? "active"
                  : ""
              }
            >
              <Icon size={23} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <StoragePanel version={state.bytes} compact />
          <Link
            className={
              page === "settings" ? "settings-link active" : "settings-link"
            }
            to="/settings"
            onClick={() => setMobile(false)}
          >
            <SettingsIcon size={23} />
            Настройки
          </Link>
        </div>
      </aside>
      {mobile && <MobileNavigationLock />}
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            aria-label="Меню"
            aria-expanded={mobile}
            aria-controls="family-navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="search">
            <Search size={21} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                page === "settings"
                  ? "Поиск по настройкам…"
                  : "Поиск по фото, альбомам, людям, местам…"
              }
              aria-label="Поиск"
            />
            {query && (
              <button
                className="icon"
                aria-label="Очистить поиск"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button className="primary upload-top" onClick={openUpload}>
            <Upload size={20} />
            <span>Загрузить фото</span>
          </button>
          <button
            className="icon notification-button"
            aria-label="Уведомления"
            onClick={() => {
              if (requireUser()) setNotifications(!notifications);
            }}
          >
            <Bell />
            {state.notifications.some((n) => !n.read) && <i />}
          </button>
          <button
            className="avatar-button"
            aria-label="Настройки профиля"
            title="Настройки профиля"
            onClick={() =>
              state.user ? navigate("/profile") : setModal({ type: "auth" })
            }
          >
            {state.user?.settings.avatar ? (
              <img
                draggable={false}
                src={"/api/files/" + state.user.settings.avatar + "/thumb"}
                alt=""
              />
            ) : (
              <UserRound />
            )}
          </button>
        </header>
        {query && page !== "settings" && (
          <section className="search-results">
            <h3>Результаты поиска</h3>
            {state.entities
              .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((e) => (
                <button
                  key={e.id}
                  aria-label={e.name}
                  onClick={() => {
                    navigate("/" + e.kind + "/" + e.id);
                    setQuery("");
                  }}
                >
                  <FolderHeart size={17} />
                  <span className="result-name">{e.name}</span>
                  <small>
                    {
                      {
                        albums: "Альбом",
                        tags: "Тег",
                        people: "Человек",
                        places: "Место",
                      }[e.kind]
                    }
                  </small>
                </button>
              ))}
            {media.slice(0, 5).map((m) => (
              <button
                key={m.id}
                aria-label={m.name}
                onClick={() => {
                  setViewer(m.id);
                  setQuery("");
                }}
              >
                <Images size={17} />
                <span className="result-name">{m.name}</span>
                <small>{m.mime.startsWith("video") ? "Видео" : "Фото"}</small>
              </button>
            ))}
            {!media.length &&
              !state.entities.some((e) =>
                e.name.toLowerCase().includes(query.toLowerCase()),
              ) && <p>Совпадений пока нет</p>}
          </section>
        )}
        {notifications && (
          <section className="notification-panel">
            <h3>Уведомления</h3>
            {state.notifications.length ? (
              state.notifications.map((n) => (
                <button
                  key={n.id}
                  className={!n.read ? "unread" : ""}
                  onClick={() => {
                    setViewer(n.media);
                    setNotifications(false);
                    void perform(() => api("/notifications/read", "POST"));
                  }}
                >
                  {n.text}
                  <small>{date(n.created)}</small>
                </button>
              ))
            ) : (
              <p>Новых уведомлений пока нет</p>
            )}
            <button
              onClick={() =>
                void perform(() => api("/notifications/read", "POST"))
              }
            >
              Отметить все прочитанными
            </button>
          </section>
        )}
        {loading ? (
          <div className="loading">Загружаем семейный архив…</div>
        ) : error ? (
          <div className="empty">
            <h2>Не удалось загрузить архив</h2>
            <p>{error}</p>
            <button onClick={() => void refresh()}>Повторить</button>
          </div>
        ) : (
          <>
            <section
              className={
                page === "home" ? "hero home-hero" : "hero page-heading"
              }
              style={
                page === "home"
                  ? ({
                      "--hero-image": `url("${state.user?.settings.heroImage ? "/api/files/" + state.user.settings.heroImage + "/hero" : "/assets/family-hero.jpg"}")`,
                      "--hero-position":
                        (state.user?.settings.heroPosition ?? 50) + "%",
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="hero-copy">
                {page === "home" ? (
                  <>
                    <h1>
                      Сохраняйте
                      <br />
                      семейные воспоминания
                    </h1>
                    <p>
                      Все ваши фото, видео и важные моменты —<br />в одном
                      безопасном месте
                    </p>
                    <div className="hero-actions">
                      <button className="primary" onClick={openUpload}>
                        <Upload size={19} />
                        Загрузить фото
                      </button>
                      <button
                        className="secondary"
                        onClick={() => openCreate("albums")}
                      >
                        <FolderPlus size={19} />
                        Создать альбом
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h1>
                      {iconFor[page] &&
                        React.createElement(iconFor[page], { size: 38 })}
                      {currentEntity?.name ||
                        titles[page] ||
                        "Страница не найдена"}
                    </h1>
                    <p>
                      {currentEntity?.description ||
                        (page === "albums"
                          ? live.filter((m) => m.mime.startsWith("image"))
                              .length +
                            " фото · " +
                            live.filter((m) => m.mime.startsWith("video"))
                              .length +
                            " видео"
                          : descriptions[page])}
                    </p>
                    {currentEntity?.place && (
                      <Link
                        className="album-place"
                        to={"/places/" + currentEntity.place}
                      >
                        <MapPin size={17} />
                        {state.entities.find(
                          (e) => e.id === currentEntity.place,
                        )?.name || "Место события"}
                      </Link>
                    )}
                  </>
                )}
              </div>
              {page === "albums" && !detailId && (
                <button
                  className="secondary family-access"
                  onClick={() => {
                    if (requireUser()) setModal({ type: "family" });
                  }}
                >
                  <Users size={18} />
                  Семейный доступ
                </button>
              )}
            </section>
            <main>
              {page === "settings" || page === "profile" ? (
                <SettingsPage
                  user={state.user}
                  profileMode={page === "profile"}
                  onThemeSaved={(theme) =>
                    setState((current) =>
                      current.user
                        ? {
                            ...current,
                            user: {
                              ...current.user,
                              settings: { ...current.user.settings, theme },
                            },
                          }
                        : current,
                    )
                  }
                  query={query}
                  requireUser={requireUser}
                  state={state}
                  perform={perform}
                  setModal={setModal}
                />
              ) : page === "memories" ? (
                <MemoriesPage
                  files={live}
                  entities={state.entities}
                  query={query}
                  onOpen={setViewer}
                  onUpload={openUpload}
                />
              ) : (
                <>
                  {page === "home" && (
                    <>
                      <section className="benefits">
                        {[
                          [Upload, "Загрузка фото", "Оригиналы и видео"],
                          [Users, "Семейный доступ", "По личному приглашению"],
                          [Shield, "Постоянное хранение", "Ваша база и файлы"],
                          [
                            Monitor,
                            "С любого устройства",
                            "Адаптивный интерфейс",
                          ],
                        ].map(([Icon, title, copy]) => (
                          <div key={String(title)}>
                            <span>
                              {React.createElement(Icon as React.ElementType, {
                                size: 27,
                              })}
                            </span>
                            <div>
                              <strong>{title as string}</strong>
                              <small>{copy as string}</small>
                            </div>
                          </div>
                        ))}
                      </section>
                      <div className="home-columns">
                        <div>
                          <div className="section-heading">
                            <h2>Недавние альбомы</h2>
                            <Link to="/albums">
                              Смотреть все <ArrowRight size={17} />
                            </Link>
                          </div>
                          {state.entities.some((e) => e.kind === "albums") ? (
                            entityCards(
                              state.entities
                                .filter(
                                  (e) =>
                                    e.kind === "albums" &&
                                    (!query ||
                                      e.name
                                        .toLowerCase()
                                        .includes(query.toLowerCase())),
                                )
                                .slice(0, 5),
                            )
                          ) : (
                            <Empty
                              title="Ваш первый семейный альбом"
                              text="Соберите фотографии одного события вместе."
                              action={() => openCreate("albums")}
                              label="Создать альбом"
                            />
                          )}
                          <div className="section-heading">
                            <h2>Недавние фото</h2>
                            <Link to="/photos">
                              <ArrowRight size={19} />
                            </Link>
                          </div>
                          {media.length ? (
                            cards(media, 12)
                          ) : (
                            <Empty
                              title="Сохраните первое воспоминание"
                              text="Загрузите свои фотографии или видео."
                              action={openUpload}
                              label="Загрузить фото"
                            />
                          )}
                        </div>
                        <div className="home-aside">
                          <section className="quick-actions">
                            <h3>Быстрые действия</h3>
                            <button onClick={openUpload}>
                              <Upload size={18} />
                              Загрузить фото
                            </button>
                            <button onClick={() => openCreate("albums")}>
                              <FolderPlus size={18} />
                              Создать альбом
                            </button>
                            <Link to="/people">
                              <UserRound size={18} />
                              Найти людей
                            </Link>
                            <Link to="/places">
                              <MapPin size={18} />
                              Найти по месту
                            </Link>
                            <Link to="/photos">
                              <SlidersHorizontal size={18} />
                              Фильтры и сортировка
                            </Link>
                          </section>
                          <Link className="memory-card" to="/memories">
                            <h3>Воспоминания</h3>
                            <Calendar />
                            <span>
                              Этот день
                              <br />в прошлые годы
                            </span>
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                  {categories[page] && !detailId && (
                    <div className="category-bar">
                      <div className="tabs">
                        {categories[page].map((c, i) => (
                          <button
                            key={c}
                            className={
                              category === (i ? c : "") ? "active" : ""
                            }
                            onClick={() => setCategory(i ? c : "")}
                          >
                            {c}{" "}
                            <span>
                              {
                                state.entities.filter(
                                  (e) =>
                                    e.kind === page && (!i || e.category === c),
                                ).length
                              }
                            </span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="tinted"
                        onClick={() => openCreate(page)}
                      >
                        <Plus size={18} />
                        {page === "people"
                          ? "Добавить человека"
                          : page === "places"
                            ? "Добавить место"
                            : "Создать тег"}
                      </button>
                    </div>
                  )}
                  {page === "tags" && !detailId && (
                    <>
                      <h2>Популярные теги</h2>
                      <div className="popular-tags">
                        {[...entities]
                          .sort((a, b) => count(b) - count(a))
                          .slice(0, 6)
                          .map((e) => (
                            <Link key={e.id} to={"/tags/" + e.id}>
                              <Tag size={20} />
                              {e.name}
                              <span>{count(e)}</span>
                            </Link>
                          ))}
                      </div>
                    </>
                  )}
                  {page !== "home" && (
                    <>
                      {(page === "albums" ||
                        page === "people" ||
                        page === "photos" ||
                        page === "videos" ||
                        page === "favorites" ||
                        detailId) &&
                        filters}
                      <div className="section-heading">
                        <h2>
                          {currentEntity
                            ? "Фотографии"
                            : page === "albums"
                              ? "Альбомы"
                              : page === "tags"
                                ? "Все теги"
                                : page === "people"
                                  ? "Близкие люди"
                                  : page === "places"
                                    ? "Популярные места"
                                    : page === "trash"
                                      ? "Удалённые файлы"
                                      : "Медиатека"}
                        </h2>
                        <div className="view-controls">
                          {currentEntity &&
                            state.user?.id === currentEntity.owner && (
                              <button
                                className="secondary"
                                onClick={() =>
                                  setModal({
                                    type: "entity",
                                    kind: currentEntity.kind,
                                    entity: currentEntity,
                                  })
                                }
                              >
                                <Pencil size={16} />
                                Изменить
                              </button>
                            )}
                          <Select
                            aria-label="Сортировка"
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="new">По дате (новые сверху)</option>
                            <option value="old">По дате (старые сверху)</option>
                            <option value="name">По названию</option>
                            <option value="size">По размеру</option>
                            <option value="count">По количеству фото</option>
                          </Select>
                          <div className="segmented">
                            <button
                              aria-label="Сетка"
                              className={!list ? "active" : ""}
                              onClick={() => setList(false)}
                            >
                              <Grid2X2 size={18} />
                            </button>
                            <button
                              aria-label="Список"
                              className={list ? "active" : ""}
                              onClick={() => setList(true)}
                            >
                              <List size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {!detailId &&
                        ["albums", "people", "places", "tags"].includes(page) &&
                        entityCards(entities, page === "albums")}
                      {["people", "places", "tags"].includes(page) &&
                        !detailId &&
                        !entities.length && (
                          <Empty
                            title={
                              query || category
                                ? "Ничего не найдено"
                                : page === "people"
                                  ? "Добавьте близких людей"
                                  : page === "places"
                                    ? "Где живут ваши воспоминания?"
                                    : "Соберите моменты по тегам"
                            }
                            text={
                              query || category
                                ? "Попробуйте другой запрос или категорию."
                                : "Создайте первую запись и свяжите её с фотографиями."
                            }
                            action={() => openCreate(page)}
                            label={
                              page === "people"
                                ? "Создать запись человека"
                                : page === "places"
                                  ? "Создать запись места"
                                  : "Добавить первый тег"
                            }
                          />
                        )}
                      {page === "places" &&
                        !detailId &&
                        entities.some(
                          (e) => e.latitude !== null && e.longitude !== null,
                        ) && (
                          <>
                            <Suspense
                              fallback={
                                <div className="places-map">
                                  Загружаем карту…
                                </div>
                              }
                            >
                              <PlacesMap
                                entities={entities}
                                media={live}
                                navigate={navigate}
                              />
                            </Suspense>
                          </>
                        )}
                      {page === "people" && !detailId && (
                        <p className="hint">
                          Ручная разметка · добавляйте людей к фотографиям в
                          просмотрщике
                        </p>
                      )}
                      {(!["tags", "people", "places", "albums"].includes(
                        page,
                      ) ||
                        detailId ||
                        page === "albums") && (
                        <>
                          {page === "albums" && !detailId && (
                            <div className="section-heading">
                              <h2>Последние фото</h2>
                            </div>
                          )}
                          <div className="bulk-bar">
                            <button
                              className="secondary"
                              onClick={() =>
                                setSelected(
                                  selected.length ===
                                    visibleMedia.filter(
                                      (m) => m.owner === state.user?.id,
                                    ).length
                                    ? []
                                    : visibleMedia
                                        .filter(
                                          (m) => m.owner === state.user?.id,
                                        )
                                        .map((m) => m.id),
                                )
                              }
                            >
                              <CheckSquare size={17} />
                              {selected.length
                                ? "Снять выделение"
                                : "Выбрать все"}
                            </button>
                            {selected.length > 0 && (
                              <>
                                <span>Выбрано {selected.length}</span>
                                {page === "trash" ? (
                                  <>
                                    <button
                                      className="secondary"
                                      onClick={() => void batch("restore")}
                                    >
                                      <RotateCcw size={17} />
                                      Восстановить
                                    </button>
                                    <button
                                      className="danger"
                                      onClick={() => void batch("permanent")}
                                    >
                                      Удалить навсегда
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <Select
                                      aria-label="Добавить выбранное в коллекцию"
                                      value=""
                                      onChange={(e) =>
                                        void batch(
                                          "link",
                                          selected,
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">
                                        Добавить в альбом / тег / к людям…
                                      </option>
                                      {state.entities
                                        .filter(
                                          (e) => e.owner === state.user?.id,
                                        )
                                        .map((e) => (
                                          <option key={e.id} value={e.id}>
                                            {e.name}
                                          </option>
                                        ))}
                                    </Select>
                                    {currentEntity && (
                                      <button
                                        onClick={() =>
                                          void batch(
                                            "unlink",
                                            selected,
                                            currentEntity.id,
                                          )
                                        }
                                      >
                                        Убрать из коллекции
                                      </button>
                                    )}
                                    <button
                                      className="danger"
                                      onClick={() => void batch("trash")}
                                    >
                                      <Trash2 size={17} />В корзину
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            {page === "trash" && media.length > 0 && (
                              <button
                                className="danger clear-trash"
                                onClick={() =>
                                  void batch(
                                    "permanent",
                                    media.map((m) => m.id),
                                  )
                                }
                              >
                                Очистить корзину
                              </button>
                            )}
                          </div>
                          {media.length ? (
                            cards(visibleMedia)
                          ) : (
                            <Empty
                              title={
                                query
                                  ? "Ничего не найдено"
                                  : page === "trash"
                                    ? "Корзина пуста"
                                    : "Здесь будут ваши воспоминания"
                              }
                              text={
                                query
                                  ? "Попробуйте другой запрос или измените фильтры."
                                  : page === "trash"
                                    ? "Удалённые фотографии появятся здесь."
                                    : "Добавьте фотографии, чтобы наполнить семейный архив."
                              }
                              action={page === "trash" ? undefined : openUpload}
                              label="Загрузить фото"
                            />
                          )}
                          {media.length > 120 && (
                            <div className="pagination">
                              <button
                                className="secondary"
                                disabled={pageNumber === 0}
                                onClick={() => setPageNumber((p) => p - 1)}
                              >
                                Назад
                              </button>
                              <span>
                                Страница {pageNumber + 1} из{" "}
                                {Math.ceil(media.length / 120)}
                              </span>
                              <button
                                className="secondary"
                                disabled={
                                  (pageNumber + 1) * 120 >= media.length
                                }
                                onClick={() => setPageNumber((p) => p + 1)}
                              >
                                Далее
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </main>
          </>
        )}
      </div>
      {modal?.type === "auth" && (
        <Auth
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await refresh();
          }}
        />
      )}
      {modal?.type === "entity" && (
        <EntityForm
          kind={modal.kind!}
          entity={modal.entity}
          state={state}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            if (
              await perform(() =>
                api(
                  "/entities/" + (modal.entity?.id || modal.kind),
                  modal.entity ? "PATCH" : "POST",
                  body,
                ),
              )
            ) {
              setModal(null);
            }
          }}
          onDelete={async (trash) => {
            if (
              await perform(() =>
                api(
                  "/entities/" + modal.entity!.id + "?trash=" + trash,
                  "DELETE",
                ),
              )
            ) {
              setModal(null);
              navigate("/" + modal.kind);
            }
          }}
        />
      )}
      {modal?.type === "upload" && (
        <UploadModal
          state={state}
          initialEntity={detailId}
          onClose={() => setModal(null)}
          onUploaded={refresh}
        />
      )}
      {modal?.type === "family" && (
        <FamilyModal
          state={state}
          onClose={() => setModal(null)}
          perform={perform}
        />
      )}
      {viewer && (
        <Viewer
          id={viewer}
          files={media}
          state={state}
          requireUser={requireUser}
          onClose={() => setViewer(null)}
          onChange={setViewer}
          perform={perform}
          onTrash={(id) => batch("trash", [id])}
        />
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}
function MobileNavigationLock() {
  useScrollLock();
  return null;
}
function Toast({ message }: { message: string }) {
  const [container, setContainer] = useState<Element>(document.body);
  useLayoutEffect(() => {
    setContainer(
      Array.from(document.querySelectorAll("dialog[open]")).at(-1) ||
        document.body,
    );
  });
  return createPortal(
    <div className="toast" role="status">
      <Check size={18} />
      {message}
    </div>,
    container,
  );
}
function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <Images size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          <Plus size={17} />
          {label}
        </button>
      )}
    </div>
  );
}
function Auth({
  onClose,
  onDone,
  initialRegister = true,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
  initialRegister?: boolean;
}) {
  const [register, setRegister] = useState(initialRegister),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <ModalFrame
      title={register ? "Ваш семейный архив" : "С возвращением"}
      onClose={onClose}
    >
      <p>
        Создайте личный аккаунт, чтобы хранить свои фотографии и приглашать
        близких.
      </p>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const b = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("/auth/" + (register ? "register" : "login"), "POST", b);
            await onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Ваше имя
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={register ? 10 : 1}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <small>Не менее 10 символов. Данные хранятся на вашем сервере.</small>
        )}
        <p className="error" role="alert">
          {error}
        </p>
        <div className="auth-actions">
          <button className="primary" disabled={busy}>
            {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Уже есть аккаунт? Войти" : "Создать новый аккаунт"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
function EntityForm({
  kind,
  entity,
  state,
  onClose,
  onSave,
  onDelete,
}: {
  kind: string;
  entity?: Entity;
  state: State;
  onClose: () => void;
  onSave: (b: unknown) => Promise<void>;
  onDelete: (trash: boolean) => Promise<void>;
}) {
  const { confirm } = useDialogs();
  const [busy, setBusy] = useState(false);
  return (
    <ModalFrame
      title={
        (entity ? "Изменить" : "Создать") +
        " " +
        ({ albums: "альбом", tags: "тег", people: "человека", places: "место" }[
          kind
        ] || "коллекцию")
      }
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget),
            b = Object.fromEntries(f);
          await onSave({
            ...b,
            place: b.place === "new" ? "" : b.place,
            latitude: b.latitude ? Number(b.latitude) : null,
            longitude: b.longitude ? Number(b.longitude) : null,
            invited: f.getAll("invited"),
          });
          setBusy(false);
        }}
      >
        <label>
          Название
          <input
            name="name"
            required
            defaultValue={entity?.name}
            maxLength={120}
          />
        </label>
        <label>
          Описание
          <textarea
            name="description"
            defaultValue={entity?.description}
            maxLength={2000}
          />
        </label>
        {categories[kind] && (
          <label>
            Категория
            <Select
              name="category"
              defaultValue={entity?.category || categories[kind][1]}
            >
              {categories[kind].slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
        )}
        <label>
          Обложка / аватар
          <Select
            name="cover"
            defaultValue={
              entity?.cover &&
              (entity.cover.startsWith("/assets/") ||
                state.media.some((m) => m.id === entity.cover && !m.deleted))
                ? entity.cover
                : ""
            }
          >
            <option value="">Автоматически по фото</option>
            {state.media
              .filter(
                (m) =>
                  !m.deleted &&
                  m.mime.startsWith("image") &&
                  m.owner === state.user?.id,
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </label>
        {kind === "albums" && (
          <>
            <PlaceFields
              state={state}
              space={
                entity?.space ||
                state.spaces.find((s) => s.role === "owner")?.id
              }
              initial={entity?.place}
            />
            <label>
              Дата события
              <DateField name="eventDate" defaultValue={entity?.eventDate} />
            </label>
            <label>
              Доступ
              <Select
                name="visibility"
                defaultValue={
                  entity?.visibility ||
                  state.user?.settings.visibility ||
                  "family"
                }
              >
                <option value="private">Только я</option>
                <option value="family">Только семья</option>
                <option value="invited">Выбранные участники</option>
              </Select>
            </label>
            <label>
              Участники по приглашению
              <Select
                name="invited"
                multiple
                defaultValue={entity?.invited || []}
              >
                {state.members
                  .filter(
                    (m, i, a) =>
                      m.id !== state.user?.id &&
                      a.findIndex((x) => x.id === m.id) === i,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
              <small>Выбор применяется к режиму «Выбранные участники»</small>
            </label>
          </>
        )}
        {kind === "places" && (
          <details className="manual-map-point">
            <summary>Указать точку на карте вручную (необязательно)</summary>
            <div className="two-fields">
              <label>
                Широта
                <input
                  type="number"
                  name="latitude"
                  min="-90"
                  max="90"
                  step="any"
                  defaultValue={entity?.latitude ?? ""}
                />
              </label>
              <label>
                Долгота
                <input
                  type="number"
                  name="longitude"
                  min="-180"
                  max="180"
                  step="any"
                  defaultValue={entity?.longitude ?? ""}
                />
              </label>
            </div>
          </details>
        )}
        <div className="modal-actions">
          {entity && (
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (await confirm("Удалить коллекцию?"))
                  await onDelete(
                    kind === "albums" &&
                      (await confirm(
                        "Также переместить её фотографии в корзину? Отмена сохранит фотографии в медиатеке.",
                      )),
                  );
              }}
            >
              Удалить
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
type QueueFile = {
  id: string;
  file: File;
  progress: number;
  status: "waiting" | "sending" | "processing" | "saved" | "error";
  serverId?: string;
  error?: string;
};
function UploadModal({
  state,
  initialEntity,
  onClose,
  onUploaded,
}: {
  state: State;
  initialEntity?: string;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const { confirm, prompt } = useDialogs();
  const initial = state.entities.find(
    (e) =>
      e.id === initialEntity &&
      (e.owner === state.user?.id || ["places", "albums"].includes(e.kind)) &&
      state.spaces.some((s) => s.id === e.space && s.role !== "guest"),
  );
  const [space, setSpace] = useState(
    initial?.space || state.spaces.find((s) => s.role === "owner")?.id || "",
  );
  const [queue, setQueue] = useState<QueueFile[]>([]),
    [album, setAlbum] = useState(initial?.kind === "albums" ? initial.id : ""),
    [uploadPlace, setUploadPlace] = useState(
      initial?.kind === "places" ? initial.id : "",
    ),
    [placeName, setPlaceName] = useState(""),
    [tags, setTags] = useState<string[]>(
      initial?.kind === "tags" ? [initial.id] : [],
    ),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [maxBytes, setMaxBytes] = useState(200 * 1024 ** 2),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    request = useRef<XMLHttpRequest | null>(null),
    active = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    void api("/config")
      .then((c) => setMaxBytes(c.maxFileBytes))
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  const update = (id: string, b: Partial<QueueFile>) => {
    if (mounted.current)
      setQueue((q) => q.map((f) => (f.id === id ? { ...f, ...b } : f)));
  };
  const add = (files: FileList | File[]) => {
    if (uploadPlace === "new" && !placeName.trim()) {
      setError("Впишите название нового места");
      return;
    }
    setError("");
    const accepted: QueueFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        setError(file.name + ": больше " + size(maxBytes));
        continue;
      }
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "video/mp4",
          "video/webm",
        ].includes(file.type)
      ) {
        setError(file.name + ": неподдерживаемый формат");
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "waiting",
      });
    }
    setQueue((q) => [...q, ...accepted].slice(0, 20));
  };
  useEffect(() => {
    const entry = queue.find((f) => f.status === "waiting");
    if (!entry || active.current || !mounted.current) return;
    active.current = true;
    setBusy(true);
    const send = async () => {
      update(entry.id, { status: "sending", error: undefined });
      const form = new FormData();
      form.append("file", entry.file);
      if (space) form.append("space", space);
      form.append(
        "entities",
        JSON.stringify(
          [
            album,
            ...tags,
            initial && !["albums", "tags", "places"].includes(initial.kind)
              ? initial.id
              : "",
          ].filter(Boolean),
        ),
      );
      form.append("place", uploadPlace === "new" ? "" : uploadPlace);
      form.append("placeName", uploadPlace === "new" ? placeName : "");
      try {
        const id = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          request.current = xhr;
          xhr.open("POST", "/api/media/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              update(entry.id, {
                progress: Math.round((e.loaded / e.total) * 100),
                status: e.loaded === e.total ? "processing" : "sending",
              });
          };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              xhr.status >= 200 && xhr.status < 300
                ? resolve(data.id)
                : reject(new Error(data.error || "Ошибка загрузки"));
            } catch {
              reject(new Error("Сервер вернул непонятный ответ"));
            }
          };
          xhr.onerror = () => reject(new Error("Нет связи с сервером"));
          xhr.onabort = () => reject(new Error("Загрузка прервана"));
          xhr.send(form);
        });
        await new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = "/api/files/" + id + "/thumb";
        });
        update(entry.id, { serverId: id, status: "saved", progress: 100 });
        if (mounted.current) await onUploaded();
      } catch (e) {
        update(entry.id, { status: "error", error: (e as Error).message });
      } finally {
        active.current = false;
        request.current = null;
        if (mounted.current) setBusy(false);
      }
    };
    void send();
  }, [queue, busy]);
  const pending =
    busy ||
    queue.some((f) => ["waiting", "sending", "processing"].includes(f.status));
  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      const ids = [
        album,
        ...tags,
        initial && !["albums", "tags"].includes(initial.kind) ? initial.id : "",
      ].filter(Boolean);
      for (const file of queue.filter((f) => f.status === "saved"))
        await api("/media/" + file.serverId, "PATCH", {
          entities: ids,
          place: uploadPlace === "new" ? "" : uploadPlace,
          placeName: uploadPlace === "new" ? placeName : "",
        });
      await onUploaded();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const close = async () => {
    if (pending) {
      if (
        await confirm(
          "Прервать текущую загрузку? Уже сохранённые файлы останутся в архиве.",
        )
      )
        onClose();
    } else if (queue.some((f) => f.status === "saved")) await finish();
    else onClose();
  };
  const saved = queue.filter((f) => f.status === "saved").length;
  return (
    <ModalFrame title="Загрузить фото" onClose={() => void close()}>
      <p className="upload-intro">
        Файлы сохраняются сразу после выбора. В архиве появляются готовые
        фотографии и миниатюры.
      </p>
      <div className="upload-destination">
        <h3>Куда сохраним воспоминания?</h3>
        <p>
          Выберите альбом и место до добавления файлов. Фотографии сразу получат
          нужный доступ.
        </p>
        {state.spaces.filter((s) => s.role !== "guest").length > 1 && (
          <label>
            Семья
            <Select
              aria-label="Семья для загрузки"
              value={space}
              disabled={queue.length > 0}
              onChange={(e) => {
                setSpace(e.target.value);
                setAlbum("");
                setTags([]);
                setUploadPlace("");
                setPlaceName("");
              }}
            >
              {state.spaces
                .filter((s) => s.role !== "guest")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name +
                      (s.role === "owner"
                        ? " · моя семья"
                        : " · " + s.ownerName)}
                  </option>
                ))}
            </Select>
          </label>
        )}
        <label>
          Альбом
          <Select
            aria-label="Альбом"
            value={album}
            disabled={saving || queue.length > 0}
            onChange={(e) => setAlbum(e.target.value)}
          >
            <option value="">Без альбома</option>
            {state.entities
              .filter((e) => e.kind === "albums" && e.space === space)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </label>
        <button
          className="text-button"
          disabled={saving || queue.length > 0}
          onClick={async () => {
            const name = await prompt("Как назовём новый альбом?");
            if (name?.trim())
              try {
                const e = await api("/entities/albums", "POST", {
                  name,
                  space,
                });
                await onUploaded();
                setAlbum(e.id);
              } catch (e) {
                setError((e as Error).message);
              }
          }}
        >
          <Plus size={16} />
          Создать альбом
        </button>
        <label>
          Место события
          <Select
            aria-label="Место события"
            value={uploadPlace}
            disabled={saving || queue.length > 0}
            onChange={(e) => setUploadPlace(e.target.value)}
          >
            <option value="">
              {state.entities.find((e) => e.id === album)?.place
                ? "Как в альбоме"
                : "Не указано"}
            </option>
            {state.entities
              .filter((e) => e.kind === "places" && e.space === space)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            <option value="new">Вписать новое место…</option>
          </Select>
        </label>
        {uploadPlace === "new" && (
          <label>
            Название нового места
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              maxLength={120}
              disabled={queue.length > 0}
              placeholder="Например, Сочи · пляж Ривьера"
            />
          </label>
        )}
        <label>
          Теги
          <Select
            aria-label="Теги"
            multiple
            value={tags}
            disabled={saving || queue.length > 0}
            onChange={(e) =>
              setTags(e.target.selectedOptions.map((o) => o.value))
            }
          >
            {state.entities
              .filter(
                (e) =>
                  e.kind === "tags" &&
                  e.owner === state.user?.id &&
                  e.space === space,
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </label>
      </div>
      <div
        className={"drop-zone " + (dragging ? "dragging" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={42} />
        <h3>Добавьте новое воспоминание</h3>
        <p>Перетащите фотографии и видео сюда</p>
        <button
          className="primary"
          onClick={() => input.current?.click()}
          disabled={saving || (uploadPlace === "new" && !placeName.trim())}
        >
          <Plus size={18} />
          Выбрать файлы
        </button>
        <small>
          JPG, PNG, WebP, GIF, MP4, WebM · до {size(maxBytes)} на файл · до 20
          файлов
        </small>
        <input
          hidden
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {queue.length > 0 && (
        <>
          <div className="upload-summary">
            <strong>
              {pending
                ? "Сохраняем воспоминания"
                : saved + " из " + queue.length + " в архиве"}
            </strong>
            {queue.some((f) => f.status === "error") && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  setQueue((q) =>
                    q.map((f) =>
                      f.status === "error"
                        ? { ...f, status: "waiting", progress: 0 }
                        : f,
                    ),
                  )
                }
              >
                <RotateCcw size={15} />
                Повторить ошибки
              </button>
            )}
          </div>
          <div className="upload-queue">
            {queue.map((entry) => (
              <div className={"queue-row " + entry.status} key={entry.id}>
                <div className="queue-thumbnail">
                  {entry.serverId ? (
                    <img
                      draggable={false}
                      src={"/api/files/" + entry.serverId + "/thumb"}
                      alt=""
                    />
                  ) : entry.file.type.startsWith("video") ? (
                    <Video size={23} />
                  ) : (
                    <Images size={23} />
                  )}
                </div>
                <div className="queue-details">
                  <strong>{entry.file.name}</strong>
                  <small>
                    {size(entry.file.size)} ·{" "}
                    {entry.status === "saved"
                      ? "В архиве"
                      : entry.status === "processing"
                        ? "Создаём миниатюру на сервере"
                        : entry.status === "sending"
                          ? "Передача " + entry.progress + "%"
                          : entry.status === "error"
                            ? entry.error
                            : "В очереди"}
                  </small>
                  {["sending", "processing"].includes(entry.status) && (
                    <div
                      className={
                        "upload-progress " +
                        (entry.status === "processing" ? "processing" : "")
                      }
                    >
                      <i style={{ width: entry.progress + "%" }} />
                    </div>
                  )}
                </div>
                {entry.status === "saved" ? (
                  <Check className="saved-check" size={20} />
                ) : (
                  ["waiting", "error"].includes(entry.status) && (
                    <button
                      className="icon"
                      aria-label={"Убрать " + entry.file.name}
                      onClick={() =>
                        setQueue((q) => q.filter((f) => f.id !== entry.id))
                      }
                    >
                      <X size={17} />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <span className="upload-footer-status">
          {pending
            ? "Дождитесь сохранения на сервере"
            : saved
              ? "Сохранено файлов · " + saved
              : "Можно оставить альбом и место пустыми"}
        </span>
        <button
          className="primary"
          disabled={
            pending || saving || (uploadPlace === "new" && !placeName.trim())
          }
          onClick={() => (saved ? void finish() : input.current?.click())}
        >
          {saved ? <Check size={18} /> : <Plus size={18} />}
          {saving ? "Сохраняем альбом…" : saved ? "Готово" : "Выбрать фото"}
        </button>
      </div>
    </ModalFrame>
  );
}
type Perform = (
  fn: () => Promise<unknown>,
  message?: string,
) => Promise<boolean>;
function Viewer({
  id,
  files,
  state,
  requireUser,
  onClose,
  onChange,
  perform,
  onTrash,
}: {
  id: string;
  files: Media[];
  state: State;
  requireUser: () => boolean;
  onClose: () => void;
  onChange: (id: string) => void;
  perform: Perform;
  onTrash: (id: string) => Promise<void>;
}) {
  const { prompt } = useDialogs();
  const m =
    files.find((m) => m.id === id) || state.media.find((m) => m.id === id);
  const [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [frame, setFrame] = useState({ width: 800, height: 600 }),
    [natural, setNatural] = useState({
      width: m?.width || 800,
      height: m?.height || 600,
    }),
    [ready, setReady] = useState(false),
    [comments, setComments] = useState<
      { id: string; name: string; text: string; created: string }[]
    >([]),
    [comment, setComment] = useState(""),
    [error, setError] = useState(""),
    [posting, setPosting] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
      null,
    );
  const fit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const move = useCallback(
    (by: number) => {
      const i = files.findIndex((m) => m.id === id);
      if (files.length)
        onChange(files[(i + by + files.length) % files.length].id);
    },
    [files, id, onChange],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        (e.target as HTMLElement).closest(
          "input,textarea,[role=listbox],.select-control",
        )
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [move]);
  useEffect(() => {
    fit();
    setRotation(0);
    setReady(false);
    setComments([]);
    setComment("");
    setError("");
    setNatural({ width: m?.width || 800, height: m?.height || 600 });
    let active = true;
    void api("/media/" + id + "/comments")
      .then((data) => {
        if (active) setComments(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(el);
      setFrame({
        width: Math.max(
          10,
          el.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
        ),
        height: Math.max(
          10,
          el.clientHeight -
            parseFloat(style.paddingTop) -
            parseFloat(style.paddingBottom),
        ),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);
  if (!m) return null;
  const edit =
    state.user?.id === m.owner &&
    state.spaces.find((s) => s.id === m.space)?.role !== "guest";
  const rotated = rotation % 180 !== 0;
  const scale = Math.min(
    frame.width / (rotated ? natural.height : natural.width),
    frame.height / (rotated ? natural.width : natural.height),
  );
  const imageStyle = {
    width: natural.width * scale,
    height: natural.height * scale,
    transform: `translate(${pan.x}px,${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
  };
  return (
    <ModalFrame title={m.name} onClose={onClose} wide>
      <div className="viewer-layout">
        <div className="viewer-stage">
          <button
            className="viewer-prev icon"
            aria-label="Предыдущее фото"
            disabled={files.length < 2}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <div
            className={"viewer-media " + (zoom > 1 ? "zoomed" : "")}
            ref={frameRef}
            onPointerDown={(e) => {
              if (zoom <= 1 || m.mime.startsWith("video")) return;
              e.preventDefault();
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                panX: pan.x,
                panY: pan.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current)
                setPan({
                  x: drag.current.panX + e.clientX - drag.current.x,
                  y: drag.current.panY + e.clientY - drag.current.y,
                });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {m.mime.startsWith("video") ? (
              <video
                key={m.id}
                controls
                poster={src(m)}
                src={
                  m.meta.videoPreview
                    ? "/api/files/" + m.id + "/preview"
                    : src(m, false)
                }
                onError={() =>
                  setError(
                    "Браузер не поддерживает этот видеокодек. Скачайте оригинал.",
                  )
                }
                autoPlay
              />
            ) : (
              <>
                {!ready && (
                  <img
                    className="viewer-preview"
                    draggable={false}
                    src={src(m)}
                    alt=""
                    aria-hidden="true"
                    style={imageStyle}
                  />
                )}
                <img
                  className="viewer-original"
                  draggable={false}
                  key={m.id}
                  src={src(m, false)}
                  alt={m.name}
                  style={{ ...imageStyle, opacity: ready ? 1 : 0 }}
                  onLoad={(e) => {
                    setNatural({
                      width: e.currentTarget.naturalWidth,
                      height: e.currentTarget.naturalHeight,
                    });
                    setReady(true);
                  }}
                  onError={() =>
                    setError(
                      "Не удалось загрузить оригинал. Попробуйте открыть фотографию ещё раз.",
                    )
                  }
                />
                {!ready && (
                  <span className="original-loading">Загружаем оригинал…</span>
                )}
              </>
            )}
          </div>
          <button
            className="viewer-next icon"
            aria-label="Следующее фото"
            disabled={files.length < 2}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
          <div className="viewer-tools">
            <button
              className="icon"
              title="Увеличить"
              aria-label="Увеличить"
              disabled={zoom >= 4 || m.mime.startsWith("video")}
              onClick={() => setZoom((v) => Math.min(v + 0.25, 4))}
            >
              <ZoomIn />
            </button>
            <button
              className="icon"
              title="Уменьшить"
              aria-label="Уменьшить"
              disabled={zoom <= 0.5 || m.mime.startsWith("video")}
              onClick={() => {
                setZoom((v) => Math.max(v - 0.25, 0.5));
                setPan({ x: 0, y: 0 });
              }}
            >
              <ZoomOut />
            </button>
            <button
              className="icon"
              title="Вписать фотографию"
              aria-label="Вписать фотографию"
              onClick={fit}
            >
              <RotateCcw />
            </button>
            <button
              className="icon"
              title="Повернуть"
              aria-label="Повернуть"
              disabled={m.mime.startsWith("video")}
              onClick={() => {
                setRotation((v) => (v + 90) % 360);
                fit();
              }}
            >
              <RotateCw />
            </button>
            <button
              className="icon"
              title="Полный экран"
              aria-label="Полный экран"
              onClick={async (e) => {
                const stage = e.currentTarget.closest(".viewer-stage");
                fit();
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await stage?.requestFullscreen();
                } catch {
                  setError("Полноэкранный режим недоступен в этом браузере.");
                }
              }}
            >
              <Maximize />
            </button>
            <span className="tool-divider" />
            <a
              className="icon"
              title="Скачать оригинал"
              aria-label="Скачать оригинал"
              href={src(m, false) + "?download=1"}
              download
            >
              <Download />
            </a>
            <button
              className={"icon " + (m.favorite ? "liked" : "")}
              title="В избранное"
              aria-label="В избранное"
              aria-pressed={m.favorite}
              onClick={() => {
                if (requireUser())
                  void perform(() =>
                    api("/media/" + m.id, "PATCH", { favorite: !m.favorite }),
                  );
              }}
            >
              <Heart fill={m.favorite ? "currentColor" : "none"} />
            </button>
            {edit && (
              <button
                className="icon danger"
                title="В корзину"
                aria-label="В корзину"
                onClick={() => void onTrash(m.id)}
              >
                <Trash2 />
              </button>
            )}
          </div>
        </div>
        <section className="viewer-info">
          <div className="photo-information">
            <h3>О фотографии</h3>
            <p>
              {date(m.meta.taken || m.created)}
              <span>
                {m.width && m.width + " × " + m.height + " · "}
                {size(m.size)}
              </span>
            </p>
          </div>
          {edit && (
            <details className="photo-edit" key={m.id}>
              <summary>
                <Pencil size={16} />
                Изменить данные фото
                <ChevronDown size={16} />
              </summary>
              <form
                noValidate
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  await perform(() =>
                    api("/media/" + m.id, "PATCH", {
                      name: data.get("name"),
                      entities: data.getAll("entities"),
                    }),
                  );
                }}
              >
                <label>
                  Название
                  <input
                    name="name"
                    defaultValue={m.name}
                    required
                    maxLength={200}
                  />
                </label>
                {["albums", "tags", "people", "places"].map((kind) => (
                  <label key={kind}>
                    {
                      {
                        albums: "Альбомы",
                        tags: "Теги",
                        people: "Люди",
                        places: "Места",
                      }[kind]
                    }
                    <Select
                      aria-label={
                        {
                          albums: "Альбомы",
                          tags: "Теги",
                          people: "Люди",
                          places: "Места",
                        }[kind]
                      }
                      name="entities"
                      multiple
                      defaultValue={m.entities.filter(
                        (id) =>
                          state.entities.find((e) => e.id === id)?.kind ===
                          kind,
                      )}
                    >
                      {state.entities
                        .filter(
                          (e) =>
                            e.kind === kind &&
                            e.owner === state.user?.id &&
                            e.space === m.space,
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </Select>
                  </label>
                ))}

                <button className="primary">Сохранить</button>
              </form>
            </details>
          )}
          <section className="comments-section">
            <div className="comments-heading">
              <h3>Комментарии</h3>
              <span>{comments.length}</span>
            </div>
            <div className="comments-list">
              {comments.length ? (
                comments.map((c) => (
                  <article className="comment" key={c.id}>
                    <span className="comment-avatar">
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="comment-heading">
                        <strong>{c.name}</strong>
                        <time>
                          {new Date(c.created).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      </div>
                      <p>{c.text}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="comments-empty">
                  Поделитесь историей этого момента.
                </p>
              )}
            </div>
            {state.user &&
              state.spaces.find((s) => s.id === m.space)?.role !== "guest" && (
                <form
                  noValidate
                  className="comment-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPosting(true);
                    if (
                      await perform(
                        () =>
                          api("/media/" + m.id + "/comments", "POST", {
                            text: comment.trim(),
                          }),
                        "Комментарий добавлен",
                      )
                    ) {
                      setComment("");
                      try {
                        setComments(await api("/media/" + m.id + "/comments"));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }
                    setPosting(false);
                  }}
                >
                  <textarea
                    aria-label="Комментарий"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    maxLength={2000}
                    placeholder="Напишите, что хочется сохранить в памяти…"
                  />
                  <button
                    className="primary"
                    disabled={!comment.trim() || posting}
                  >
                    <MessageCircle size={17} />
                    {posting ? "Отправляем…" : "Отправить комментарий"}
                  </button>
                </form>
              )}
          </section>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </ModalFrame>
  );
}
function FamilyPanel({ state, perform }: { state: State; perform: Perform }) {
  const { confirm } = useDialogs();
  const [spaceId, setSpaceId] = useState(
      state.spaces.find((s) => s.role === "owner")?.id ||
        state.spaces[0]?.id ||
        "",
    ),
    [code, setCode] = useState(""),
    [role, setRole] = useState("member"),
    [join, setJoin] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    void perform(async () => {}, "");
  }, []);
  const space = state.spaces.find((s) => s.id === spaceId);
  const members = state.members.filter((m) => m.space === spaceId);
  const [editing, setEditing] = useState("");
  useEffect(() => {
    setCode("");
    setCopied(false);
  }, [spaceId]);
  return (
    <div className="family-panel">
      <div className="family-space-selector">
        <label>
          Семейное пространство
          <Select
            aria-label="Семейное пространство"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            {state.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name +
                  " · " +
                  (s.role === "owner"
                    ? "ваша семья"
                    : s.ownerName || "семья участника")}
              </option>
            ))}
          </Select>
        </label>
        <span className="family-count">
          <Users size={18} />
          Участники · {members.length}
        </span>
      </div>
      {space?.role === "owner" && (
        <section className="family-section">
          <div className="family-section-title">
            <Share2 size={21} />
            <div>
              <h3>Пригласить близких</h3>
              <p>
                Код действует 7 дней. Каждый код можно использовать один раз.
              </p>
            </div>
          </div>
          <div className="invite-create">
            <label>
              Роль приглашённого
              <Select
                aria-label="Роль приглашённого"
                value={role}
                disabled={busy}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">
                  Участник · просмотр и свои загрузки
                </option>
                <option value="guest">Гость · только просмотр</option>
              </Select>
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await perform(async () => {
                  const result = await api("/invites", "POST", {
                    role,
                    space: spaceId,
                  });
                  setCode(result.token);
                  setCopied(false);
                }, "Приглашение создано");
                setBusy(false);
              }}
            >
              <Plus size={18} />
              Создать приглашение
            </button>
          </div>
          {code && (
            <div className="invitation-code">
              <label>
                Код приглашения
                <input
                  readOnly
                  value={code}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    if (navigator.clipboard)
                      await navigator.clipboard.writeText(code);
                    else {
                      const input = document.createElement("textarea");
                      input.value = code;
                      document.body.append(input);
                      input.select();
                      const ok = document.execCommand("copy");
                      input.remove();
                      if (!ok) throw new Error();
                    }
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={17} />
                {copied ? "Скопировано" : "Скопировать"}
              </button>
            </div>
          )}
        </section>
      )}
      <section className="family-section">
        <div className="family-section-title">
          <Users size={21} />
          <div>
            <h3>Участники семьи</h3>
            <p>Доступ и роли в выбранном пространстве.</p>
          </div>
        </div>
        <div className="members-list">
          {members.map((m) => (
            <div className="member-row" key={m.id}>
              <span className="member-avatar">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>
                  <span className="person-name">{m.name}</span>
                  {m.id === state.user?.id && (
                    <small className="you-label">Вы</small>
                  )}
                </strong>
                <small>
                  {m.label ? m.label + " · " : ""}
                  {m.email}
                </small>
              </div>
              <span className={"role-badge " + m.role}>
                {m.role === "owner"
                  ? "Владелец"
                  : m.role === "guest"
                    ? "Гость"
                    : "Участник"}
              </span>
              {m.id !== state.user?.id && space?.role === "owner" && (
                <button
                  className="icon"
                  aria-label={"Настроить доступ " + m.name}
                  onClick={() => setEditing(editing === m.id ? "" : m.id)}
                >
                  <SettingsIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
        {members.some((m) => m.id === editing) && (
          <>
            <MemberAccess
              key={editing}
              member={members.find((m) => m.id === editing)!}
              albums={state.entities}
              onCancel={() => setEditing("")}
              onSave={(b) =>
                perform(
                  () => api("/members/" + spaceId + "/" + editing, "PATCH", b),
                  "Доступ участника сохранён",
                )
              }
            />
            <button
              className="danger"
              onClick={async () => {
                if (
                  await confirm("Закрыть доступ к семье для этого участника?")
                )
                  if (
                    await perform(
                      () =>
                        api("/members/" + spaceId + "/" + editing, "DELETE"),
                      "Доступ закрыт",
                    )
                  )
                    setEditing("");
              }}
            >
              Удалить участника из семьи
            </button>
          </>
        )}
      </section>
      <section className="family-section join-section">
        <div className="family-section-title">
          <FolderHeart size={21} />
          <div>
            <h3>Присоединиться к другой семье</h3>
            <p>Введите код, который вам передал владелец.</p>
          </div>
        </div>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            let joinedSpace = "";
            if (
              await perform(async () => {
                const result = await api("/invites/join", "POST", {
                  token: join.trim(),
                });
                joinedSpace = result.space;
              }, "Вы присоединились к семье")
            ) {
              setJoin("");
              if (joinedSpace) setSpaceId(joinedSpace);
            }
            setBusy(false);
          }}
        >
          <label>
            Код приглашения
            <input
              value={join}
              onChange={(e) => setJoin(e.target.value)}
              required
              placeholder="Вставьте полученный код"
              autoComplete="off"
            />
          </label>
          <button className="secondary" disabled={busy || !join.trim()}>
            <ArrowRight size={17} />
            Присоединиться
          </button>
        </form>
      </section>
    </div>
  );
}
function FamilyModal({
  state,
  onClose,
  perform,
}: {
  state: State;
  onClose: () => void;
  perform: Perform;
}) {
  return (
    <ModalFrame title="Семейный доступ" onClose={onClose}>
      <FamilyPanel state={state} perform={perform} />
    </ModalFrame>
  );
}
function CoverSettings({
  user,
  state,
  perform,
}: {
  user: User;
  state: State;
  perform: Perform;
}) {
  const [image, setImage] = useState(user.settings.heroImage || ""),
    [position, setPosition] = useState(user.settings.heroPosition ?? 50),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setImage(user.settings.heroImage || "");
    setPosition(user.settings.heroPosition ?? 50);
  }, [user.settings.heroImage, user.settings.heroPosition]);
  const dirty =
    image !== (user.settings.heroImage || "") ||
    position !== (user.settings.heroPosition ?? 50);
  const source = image
    ? "/api/files/" +
      image +
      "/" +
      (image === user.settings.heroImage ? "hero" : "original")
    : "/assets/family-hero.jpg";
  return (
    <section className="settings-card cover-settings">
      <h2>
        <Images />
        Обложка главной
      </h2>
      <p>Выберите фотографию и расположите важную часть в кадре.</p>
      <div
        className="cover-preview"
        style={{
          backgroundImage:
            'linear-gradient(90deg,var(--hero-shade),transparent),url("' +
            source +
            '")',
          backgroundPosition: "center " + position + "%",
        }}
      >
        <strong>
          Сохраняйте
          <br />
          семейные воспоминания
        </strong>
      </div>
      <div className="cover-controls">
        <label>
          Фотография
          <Select
            aria-label="Фотография обложки"
            value={image}
            disabled={busy}
            onChange={(e) => setImage(e.target.value)}
          >
            <option value="">Стандартная обложка</option>
            {image && !state.media.some((m) => m.id === image) && (
              <option value={image}>Новая фотография</option>
            )}
            {state.media
              .filter(
                (m) =>
                  m.owner === user.id &&
                  !m.deleted &&
                  m.mime.startsWith("image"),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </label>
        <label className="button secondary">
          <Upload size={17} />
          {busy ? "Сохраняем фотографию…" : "Загрузить обложку"}
          <input
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.append("file", file);
                const response = await fetch("/api/media/upload", {
                  method: "POST",
                  body: form,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setImage(data.id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      <label className="cover-position">
        Положение фотографии
        <input
          type="range"
          aria-label="Положение фотографии"
          min="0"
          max="100"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="cover-save">
        <button
          className="primary"
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true);
            await perform(
              () =>
                api("/profile/appearance", "PATCH", {
                  heroImage: image,
                  heroPosition: position,
                }),
              "Обложка сохранена",
            );
            setBusy(false);
          }}
        >
          <Check size={18} />
          Сохранить обложку
        </button>
      </div>
    </section>
  );
}
function SettingsPage({
  user,
  profileMode = false,
  onThemeSaved,
  query,
  requireUser,
  state,
  perform,
  setModal,
}: {
  user: User | null;
  profileMode?: boolean;
  onThemeSaved: (theme: Theme) => void;
  query: string;
  requireUser: () => boolean;
  state: State;
  perform: Perform;
  setModal: (m: Modal | null) => void;
}) {
  const { confirm } = useDialogs();
  const { theme, setTheme, markSaved } = useTheme();
  const [themeSaving, setThemeSaving] = useState(false),
    [themeStatus, setThemeStatus] = useState("");
  const changeTheme = async (next: Theme) => {
    setTheme(next);
    setThemeSaving(true);
    setThemeStatus("Сохраняем тему…");
    try {
      await api("/settings", "PATCH", { theme: next });
      markSaved(next);
      onThemeSaved(next);
      setThemeStatus("Тема сохранена");
    } catch (e) {
      setThemeStatus(
        (e as Error).message +
          ". Тема сохранена на этом устройстве. Нажмите на выбранную тему, чтобы повторить сохранение в аккаунте.",
      );
    } finally {
      setThemeSaving(false);
    }
  };
  const navigate = useNavigate();
  const fallback: Settings = {
    theme: "light",
    visibility: "family",
    geolocation: false,
    desktopNotifications: false,
    animations: true,
    commentNotifications: true,
    sharedNotifications: true,
  };
  const [draft, setDraft] = useState<Settings>(user?.settings || fallback),
    [profile, setProfile] = useState(false),
    [busy, setBusy] = useState(false),
    [profileError, setProfileError] = useState(""),
    [backupMessage, setBackupMessage] = useState("");
  useEffect(() => {
    setDraft(user?.settings || fallback);
  }, [user?.id, profileMode]);
  const savedSettings = user?.settings || fallback;
  const dirty =
    !profileMode &&
    (
      [
        "visibility",
        "desktopNotifications",
        "animations",
        "commentNotifications",
        "sharedNotifications",
      ] as const
    ).some((key) => draft[key] !== savedSettings[key]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    const click = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        link.origin !== window.location.origin ||
        link.pathname === window.location.pathname
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      void confirm("Есть несохранённые настройки. Покинуть страницу?").then(
        (ok) => {
          if (ok) navigate(link.pathname + link.search + link.hash);
        },
      );
    };
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  const shown = (text: string) =>
    !query || text.toLowerCase().includes(query.toLowerCase());
  const toggle = (
    key:
      | "geolocation"
      | "animations"
      | "commentNotifications"
      | "sharedNotifications",
  ) => setDraft((d) => ({ ...d, [key]: !d[key] }));
  const toggleRow = (
    key:
      | "geolocation"
      | "animations"
      | "commentNotifications"
      | "sharedNotifications",
    label: string,
    Icon: React.ElementType,
  ) => (
    <div className="setting-row">
      <Icon size={23} />
      <span>{label}</span>
      <button
        role="switch"
        aria-label={label}
        aria-checked={draft[key]}
        className={"switch " + (draft[key] ? "on" : "")}
        onClick={() => toggle(key)}
      >
        <i />
      </button>
    </div>
  );
  return (
    <>
      {!profileMode &&
        query &&
        ![
          "Внешний вид светлая тема тёмная тема",
          "Приватность доступ альбомы семья участники",
          "Уведомления комментарии общие альбомы новые фото браузер",
          "Комфорт просмотра анимации движение",
          "Хранилище файлы место диск размер резервное копирование экспорт восстановление",
        ].some(shown) && (
          <div className="memory-empty">
            <h3>Настройки не найдены</h3>
            <p>
              Попробуйте другой запрос — например, «тема» или «уведомления».
            </p>
          </div>
        )}
      <div className={"settings-grid " + (profileMode ? "profile-grid" : "")}>
        <div>
          {profileMode && shown("Мой профиль имя пароль email аватар") && (
            <section className="settings-card">
              <h2>
                <UserRound />
                Мой профиль
              </h2>
              <div className="profile-card">
                <div className="profile-avatar">
                  {draft.avatar ? (
                    <img
                      draggable={false}
                      src={"/api/files/" + draft.avatar + "/thumb"}
                      alt="Ваш аватар"
                    />
                  ) : (
                    <UserRound size={64} />
                  )}
                </div>
                <div>
                  <h2>
                    <span className="profile-name">
                      {user?.name || "Ваш профиль"}
                    </span>
                  </h2>
                  <p>{user?.email || "Создайте личный аккаунт"}</p>
                  <button
                    className="tinted"
                    onClick={() => {
                      if (requireUser()) setProfile(true);
                    }}
                  >
                    <Pencil size={17} />
                    Изменить профиль
                  </button>
                </div>
              </div>
            </section>
          )}
          {!profileMode && shown("Внешний вид светлая тема тёмная тема") && (
            <section className="settings-card">
              <h2>
                <Monitor />
                Внешний вид
              </h2>
              <p>Выберите тему оформления</p>
              <div className="theme-options">
                <button
                  className={theme === "light" ? "chosen" : ""}
                  disabled={themeSaving}
                  onClick={() => void changeTheme("light")}
                >
                  <Sun />
                  Светлая тема{theme === "light" && <Check size={18} />}
                </button>
                <button
                  className={theme === "dark" ? "chosen" : ""}
                  disabled={themeSaving}
                  onClick={() => void changeTheme("dark")}
                >
                  <Moon />
                  Тёмная тема{theme === "dark" && <Check size={18} />}
                </button>
              </div>
              <small className="theme-status" role="status">
                {themeStatus ||
                  "Тема применяется ко всем страницам и сохраняется автоматически."}
              </small>
            </section>
          )}
        </div>
        <div>
          {!profileMode &&
            shown("Приватность доступ альбомы семья участники") && (
              <section className="settings-card">
                <h2>
                  <Shield />
                  Приватность
                </h2>
                <div className="setting-row">
                  <Users size={23} />
                  <span>Новые альбомы видны</span>
                  <Select
                    aria-label="Новые альбомы видны"
                    value={draft.visibility}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        visibility: e.target.value as Settings["visibility"],
                      }))
                    }
                  >
                    <option value="private">Только мне</option>
                    <option value="family">Только семье</option>
                    <option value="invited">По приглашению</option>
                  </Select>
                </div>
                <p className="settings-note">
                  Это правило применяется к новым альбомам. В настройках альбома
                  можно выбрать конкретных участников, а в профиле — скрыть
                  альбомы от ребёнка и изменить права членов семьи.
                </p>
                <Link to="/profile">
                  Управлять семьёй <ArrowRight size={16} />
                </Link>
              </section>
            )}
          {!profileMode &&
            shown(
              "Уведомления комментарии общие альбомы новые фото браузер",
            ) && (
              <section className="settings-card">
                <h2>
                  <Bell />
                  Уведомления
                </h2>
                {toggleRow(
                  "commentNotifications",
                  "Новые комментарии",
                  MessageCircle,
                )}
                {toggleRow("sharedNotifications", "Новые фото семьи", Share2)}
                <BrowserNotificationsSetting
                  enabled={!!draft.desktopNotifications}
                  onChange={(value) =>
                    setDraft((d) => ({ ...d, desktopNotifications: value }))
                  }
                />
              </section>
            )}
          {!profileMode && shown("Комфорт просмотра анимации движение") && (
            <section className="settings-card">
              <h2>
                <Monitor />
                Комфорт просмотра
              </h2>
              {toggleRow("animations", "Плавные анимации", Sparkles)}
              <p className="settings-note">
                Плавное появление окон, карточек и подборок. Если в системе
                включено уменьшение движения, мы учитываем это автоматически.
              </p>
            </section>
          )}
        </div>
      </div>
      {!profileMode && (
        <div className="save-settings">
          <button
            className="primary"
            disabled={!dirty || busy}
            onClick={async () => {
              if (!requireUser()) return;
              setBusy(true);
              await perform(
                () =>
                  api("/settings", "PATCH", {
                    theme,
                    visibility: draft.visibility,
                    geolocation: false,
                    animations: draft.animations !== false,
                    desktopNotifications: !!draft.desktopNotifications,
                    commentNotifications: draft.commentNotifications,
                    sharedNotifications: draft.sharedNotifications,
                  }),
                "Настройки сохранены",
              );
              setBusy(false);
            }}
          >
            <Check />
            {busy ? "Сохранение…" : "Сохранить изменения"}
          </button>
        </div>
      )}
      {!profileMode &&
        shown(
          "Хранилище файлы место диск размер резервное копирование экспорт восстановление",
        ) && <StoragePanel version={state.bytes} />}
      {profileMode && user && (
        <>
          <CoverSettings user={user} state={state} perform={perform} />
          <section className="settings-card">
            <h2>
              <Users />
              Моя семья
            </h2>
            <FamilyPanel state={state} perform={perform} />
          </section>
          <div className="profile-actions">
            <Link to="/settings">
              Настройки приложения <ArrowRight size={17} />
            </Link>
            <button
              className="secondary"
              onClick={async () => {
                await api("/auth/logout", "POST");
                window.location.href = "/";
              }}
            >
              <LogOut size={18} />
              Выйти из аккаунта
            </button>
          </div>
        </>
      )}
      {!profileMode &&
        shown("Хранилище резервное копирование экспорт восстановление") && (
          <section className="settings-card backup-card">
            <h2>
              <Shield />
              Данные и резервные копии
            </h2>
            <p>
              Резервная копия содержит ваши оригиналы и коллекции. Храните её на
              другом диске.
            </p>
            <div className="backup-actions">
              <button
                className="secondary"
                onClick={() => {
                  if (requireUser()) window.location.href = "/api/export";
                }}
              >
                <Download size={18} />
                Скачать резервную копию
              </button>
              <label className="button secondary">
                Восстановить копию
                <input
                  hidden
                  type="file"
                  accept=".zip"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (
                      !file ||
                      !requireUser() ||
                      !(await confirm(
                        "Импортировать копию как новые объекты? Текущие данные сохранятся.",
                      ))
                    )
                      return;
                    setBackupMessage("Восстановление…");
                    await perform(async () => {
                      const data = new FormData();
                      data.append("file", file);
                      const r = await fetch("/api/restore", {
                        method: "POST",
                        body: data,
                      });
                      const b = await r.json();
                      if (!r.ok) throw new Error(b.error);
                    }, "Копия восстановлена");
                    setBackupMessage("");
                  }}
                />
              </label>
            </div>
            {backupMessage && <p role="status">{backupMessage}</p>}
          </section>
        )}
      {profile && user && (
        <ModalFrame
          title="Изменить профиль"
          onClose={() => {
            setProfile(false);
            setDraft(user.settings);
            setProfileError("");
          }}
        >
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setProfileError("");
              const data = Object.fromEntries(new FormData(e.currentTarget));
              if (data.password && data.password !== data.confirmPassword) {
                setProfileError("Новые пароли не совпадают");
                setBusy(false);
                return;
              }
              delete data.confirmPassword;
              if (!data.password) delete data.password;
              try {
                await api("/profile", "PATCH", data);
                if (draft.avatar !== user.settings.avatar)
                  await api("/profile/appearance", "PATCH", {
                    avatar: draft.avatar,
                  });
                await perform(async () => {}, "Профиль обновлён");
                setProfile(false);
              } catch (e) {
                setProfileError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Имя и фамилия
              <input
                name="name"
                defaultValue={user.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                defaultValue={user.email}
                required
              />
            </label>
            <label>
              Текущий пароль
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
            </label>
            <small>
              Для смены email или пароля подтвердите текущий пароль.
            </small>
            <label>
              Новый пароль
              <input
                name="password"
                type="password"
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <label>
              Повторите новый пароль
              <input
                name="confirmPassword"
                type="password"
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <label>
              Загрузить новый аватар
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    const r = await fetch("/api/media/upload", {
                      method: "POST",
                      body: form,
                    });
                    const b = await r.json();
                    if (!r.ok) throw new Error(b.error);
                    setDraft((d) => ({ ...d, avatar: b.id }));
                  } catch (e) {
                    setProfileError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <label>
              Аватар из загруженных фотографий
              <Select
                value={draft.avatar || ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, avatar: e.target.value }))
                }
              >
                <option value="">Без аватара</option>
                {draft.avatar &&
                  !state.media.some((m) => m.id === draft.avatar) && (
                    <option value={draft.avatar}>Новый аватар</option>
                  )}
                {state.media
                  .filter(
                    (m) =>
                      !m.deleted &&
                      m.owner === user.id &&
                      m.mime.startsWith("image"),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
              <small>Аватар сохранится вместе с профилем.</small>
            </label>
            <p className="error">{profileError}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setProfile(false);
                  setDraft(user.settings);
                  setProfileError("");
                }}
              >
                Отмена
              </button>
              <button className="primary" disabled={busy}>
                Сохранить профиль
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ThemeProvider>
  </BrowserRouter>,
);
