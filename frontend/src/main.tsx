import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
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
import { demo } from "./demo";
import "./style.css";

const PlacesMap = lazy(() => import("./PlacesMap"));
const navigation = [
  ["/", "Главная", Home],
  ["/albums", "Альбомы", FolderHeart],
  ["/photos", "Все фото", Images],
  ["/videos", "Видео", Video],
  ["/favorites", "Избранное", Heart],
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
};
const iconFor: Record<string, React.ElementType> = {
  people: UserRound,
  places: MapPin,
  tags: Tag,
  settings: SettingsIcon,
  trash: Trash2,
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
      onCancel={onClose}
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
      {children}
    </dialog>
  );
}
function App() {
  const location = useLocation(),
    navigate = useNavigate(),
    page = location.pathname.split("/")[1] || "home",
    detailId = location.pathname.split("/")[2];
  const [pageNumber, setPageNumber] = useState(0);
  const [state, setState] = useState<State>(demo),
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
  const refresh = useCallback(async () => {
    try {
      const me = await api("/me");
      setState(me ? await api("/state") : demo);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme =
      state.user?.settings.theme || "light";
  }, [state.user?.settings.theme]);
  useEffect(() => {
    setCategory("");
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
  if (page === "memories") {
    const now = new Date();
    media = media.filter(
      (m) =>
        new Date(m.meta.taken || m.created).getMonth() === now.getMonth() &&
        new Date(m.meta.taken || m.created).getDate() === now.getDate() &&
        new Date(m.meta.taken || m.created).getFullYear() < now.getFullYear(),
    );
  }
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
      !confirm(
        "Удалить выбранные файлы навсегда? Восстановить их будет невозможно.",
      )
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
    <div className={"photo-grid " + (list ? "list-view" : "")}>
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
                <img src={src(m)} alt={m.name} loading="lazy" />
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
              <img src={src(m)} alt={m.name} loading="lazy" />
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
            list && (
              <span className="photo-caption">
                {m.name} · {date(m.created)}
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
        (list ? "entity-list" : "")
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
              <img src={cover(e)} alt="" loading="lazy" />
            ) : (
              <div className="no-cover">
                <Images />
              </div>
            )}
            <div>
              <strong>
                {e.kind === "tags" && <Tag size={17} />}{" "}
                {e.kind === "places" && <MapPin size={17} />} {e.name}
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
        <select
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
        </select>
      </label>
      <label>
        <Leaf size={18} />
        <select
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
        </select>
      </label>
      {["places", "people"].map((kind) => (
        <label key={kind}>
          {kind === "places" ? <MapPin size={18} /> : <UserRound size={18} />}
          <select
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
          </select>
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
          <select
            aria-label="Тип файла"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
          >
            <option value="">Все файлы</option>
            <option value="image">Фото</option>
            <option value="video">Видео</option>
          </select>
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
  return (
    <>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
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
          <div className="storage">
            <span>Хранилище</span>
            <strong>{size(state.bytes)}</strong>
            <div className="storage-line">
              <i />
            </div>
          </div>
          <Link
            className={
              page === "settings" ? "settings-link active" : "settings-link"
            }
            to="/settings"
          >
            <SettingsIcon size={23} />
            Настройки
          </Link>
        </div>
      </aside>
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
            aria-label="Профиль"
            onClick={() =>
              state.user ? navigate("/settings") : setModal({ type: "auth" })
            }
          >
            {state.user?.settings.avatar ? (
              <img
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
                  onClick={() => {
                    navigate("/" + e.kind + "/" + e.id);
                    setQuery("");
                  }}
                >
                  <FolderHeart size={17} />
                  {e.name}
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
                onClick={() => {
                  setViewer(m.id);
                  setQuery("");
                }}
              >
                <Images size={17} />
                {m.name}
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
        {!state.user && !loading && (
          <div className="demo-notice">
            Демонстрационный режим · фотографии-примеры{" "}
            <button onClick={() => setModal({ type: "auth" })}>
              Создать свой семейный архив <ArrowRight size={14} />
            </button>
          </div>
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
                "hero " +
                (page === "home"
                  ? "home-hero"
                  : page === "people"
                    ? "people-hero"
                    : "")
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
              {page === "settings" ? (
                <SettingsPage
                  user={state.user}
                  query={query}
                  requireUser={requireUser}
                  state={state}
                  perform={perform}
                  setModal={setModal}
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
                          <select
                            aria-label="Сортировка"
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="new">По дате (новые сверху)</option>
                            <option value="old">По дате (старые сверху)</option>
                            <option value="name">По названию</option>
                            <option value="size">По размеру</option>
                            <option value="count">По количеству фото</option>
                          </select>
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
                      {page === "places" && !detailId && (
                        <>
                          <div className="section-heading">
                            <h2>Карта воспоминаний</h2>
                            <span>Только места с координатами</span>
                          </div>
                          <Suspense
                            fallback={
                              <div className="places-map">Загружаем карту…</div>
                            }
                          >
                            <PlacesMap
                              entities={entities}
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
                                    <select
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
                                    </select>
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
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
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
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [register, setRegister] = useState(true),
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
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget),
            b = Object.fromEntries(f);
          await onSave({
            ...b,
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
            <select
              name="category"
              defaultValue={entity?.category || categories[kind][1]}
            >
              {categories[kind].slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Обложка / аватар
          <select name="cover" defaultValue={entity?.cover || ""}>
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
          </select>
        </label>
        {kind === "albums" && (
          <>
            <label>
              Дата события
              <input
                name="eventDate"
                type="date"
                defaultValue={entity?.eventDate}
              />
            </label>
            <label>
              Доступ
              <select
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
              </select>
            </label>
            <label>
              Участники по приглашению
              <select
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
              </select>
              <small>Выбор применяется к режиму «Выбранные участники»</small>
            </label>
          </>
        )}
        {kind === "places" && (
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
        )}
        <div className="modal-actions">
          {entity && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirm("Удалить коллекцию?"))
                  void onDelete(
                    kind === "albums" &&
                      confirm(
                        "Также переместить её фотографии в корзину? Отмена сохранит фотографии в медиатеке.",
                      ),
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
  url: string;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
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
  const [queue, setQueue] = useState<QueueFile[]>([]),
    [album, setAlbum] = useState(initialEntity || ""),
    [tags, setTags] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [maxBytes, setMaxBytes] = useState(200 * 1024 ** 2);
  const input = useRef<HTMLInputElement>(null),
    urls = useRef<string[]>([]),
    request = useRef<XMLHttpRequest | null>(null);
  useEffect(() => {
    void api("/config").then((c) => setMaxBytes(c.maxFileBytes));
    return () => {
      urls.current.forEach(URL.revokeObjectURL);
      request.current?.abort();
    };
  }, []);
  const add = (files: FileList | File[]) => {
    const accepted: QueueFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        setError(file.name + ": превышен лимит " + size(maxBytes));
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
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      accepted.push({
        id: crypto.randomUUID(),
        file,
        url,
        progress: 0,
        status: "ready",
      });
    }
    setQueue((q) => [...q, ...accepted].slice(0, 20));
  };
  const update = (id: string, b: Partial<QueueFile>) =>
    setQueue((q) => q.map((f) => (f.id === id ? { ...f, ...b } : f)));
  const submit = async () => {
    setBusy(true);
    setError("");
    for (const entry of queue.filter((q) => q.status !== "done")) {
      update(entry.id, { status: "uploading", progress: 0 });
      const data = new FormData();
      data.append("file", entry.file);
      data.append("entities", JSON.stringify([album, ...tags].filter(Boolean)));
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          request.current = xhr;
          xhr.open("POST", "/api/media/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              update(entry.id, {
                progress: Math.round((e.loaded / e.total) * 100),
              });
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              try {
                reject(new Error(JSON.parse(xhr.responseText).error));
              } catch {
                reject(new Error("Ошибка загрузки"));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Нет связи с сервером"));
          xhr.onabort = () => reject(new Error("Загрузка отменена"));
          xhr.send(data);
        });
        update(entry.id, { status: "done", progress: 100 });
      } catch (e) {
        update(entry.id, { status: "error", error: (e as Error).message });
      }
    }
    setBusy(false);
    request.current = null;
    await onUploaded();
  };
  return (
    <ModalFrame
      title="Загрузить фото"
      onClose={() => {
        if (!busy || confirm("Прервать текущую загрузку?")) onClose();
      }}
    >
      <div
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) add(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={48} />
        <p>
          Перетащите фото и видео сюда
          <br />
          или нажмите «Выбрать файлы»
        </p>
        <button
          className="primary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <FolderPlus size={18} />
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
      <div className="upload-queue">
        {queue.map((entry) => (
          <div className="queue-row" key={entry.id}>
            {entry.file.type.startsWith("image") ? (
              <img src={entry.url} alt="" />
            ) : (
              <video src={entry.url} />
            )}
            <div>
              <strong>{entry.file.name}</strong>
              <small>
                {size(entry.file.size)}{" "}
                {entry.status === "error" && entry.error}
              </small>
            </div>
            <div className="progress-wrap">
              <span>
                {entry.status === "done"
                  ? "Сохранено"
                  : entry.status === "uploading"
                    ? entry.progress + "%"
                    : entry.status === "error"
                      ? "Ошибка"
                      : "Готов к загрузке"}
              </span>
              <progress max={100} value={entry.progress} />
            </div>
            {entry.status === "done" ? (
              <Check size={19} />
            ) : (
              <button
                className="icon"
                aria-label={"Убрать " + entry.file.name}
                disabled={busy}
                onClick={() =>
                  setQueue((q) => q.filter((f) => f.id !== entry.id))
                }
              >
                <X size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
      <label>
        Альбом
        <select
          aria-label="Альбом"
          value={album}
          disabled={busy}
          onChange={(e) => setAlbum(e.target.value)}
        >
          <option value="">Без альбома</option>
          {state.entities
            .filter((e) => e.kind === "albums" && e.owner === state.user?.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <button
        className="text-button"
        disabled={busy}
        onClick={async () => {
          const name = prompt("Название нового альбома");
          if (name?.trim())
            try {
              const e = await api("/entities/albums", "POST", { name });
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
        Теги
        <select
          multiple
          value={tags}
          disabled={busy}
          onChange={(e) =>
            setTags(Array.from(e.target.selectedOptions, (o) => o.value))
          }
        >
          {state.entities
            .filter((e) => e.kind === "tags" && e.owner === state.user?.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <p className="error" role="alert">
        {error}
      </p>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          {queue.length && queue.every((f) => f.status === "done")
            ? "Готово"
            : "Закрыть"}
        </button>
        <button
          className="primary"
          disabled={busy || !queue.some((f) => f.status !== "done")}
          onClick={() => void submit()}
        >
          <Upload size={18} />
          {busy
            ? "Загружаем…"
            : queue.some((f) => f.status === "error")
              ? "Повторить загрузку"
              : "Загрузить"}
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
  const m =
      files.find((m) => m.id === id) || state.media.find((m) => m.id === id),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0),
    [comments, setComments] = useState<
      { id: string; name: string; text: string; created: string }[]
    >([]),
    [comment, setComment] = useState(""),
    [error, setError] = useState("");
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
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [move]);
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setComments([]);
    if (!id.startsWith("demo"))
      void api("/media/" + id + "/comments")
        .then(setComments)
        .catch((e) => setError(e.message));
  }, [id]);
  if (!m) return null;
  const edit = state.user?.id === m.owner;
  return (
    <ModalFrame title={m.name} onClose={onClose} wide>
      <div className="viewer-layout">
        <div className="viewer-stage">
          <button
            className="viewer-prev icon"
            aria-label="Предыдущее фото"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <div className="viewer-media">
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
              <img
                src={src(m, false)}
                alt={m.name}
                style={{
                  transform: "scale(" + zoom + ") rotate(" + rotation + "deg)",
                }}
              />
            )}
          </div>
          <button
            className="viewer-next icon"
            aria-label="Следующее фото"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
          <div className="viewer-tools">
            <button
              className="icon"
              aria-label="Увеличить"
              onClick={() => setZoom((v) => Math.min(v + 0.25, 3))}
            >
              <ZoomIn />
            </button>
            <button
              className="icon"
              aria-label="Уменьшить"
              onClick={() => setZoom((v) => Math.max(v - 0.25, 0.25))}
            >
              <ZoomOut />
            </button>
            <button
              className="icon"
              aria-label="Повернуть"
              onClick={() => setRotation((v) => v + 90)}
            >
              <RotateCw />
            </button>
            <button
              className="icon"
              aria-label="Полный экран"
              onClick={(e) =>
                void e.currentTarget
                  .closest(".viewer-stage")
                  ?.requestFullscreen()
              }
            >
              <Maximize />
            </button>
            <a
              className="icon"
              aria-label="Скачать оригинал"
              href={src(m, false) + (m.demoSrc ? "" : "?download=1")}
              download
            >
              <Download />
            </a>
            <button
              className={"icon " + (m.favorite ? "liked" : "")}
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
                aria-label="В корзину"
                onClick={() => void onTrash(m.id)}
              >
                <Trash2 />
              </button>
            )}
          </div>
        </div>
        <section className="viewer-info">
          <h3>О фотографии</h3>
          <p>
            {date(m.meta.taken || m.created)}
            <br />
            {m.width && m.width + " × " + m.height + " · "}
            {size(m.size)}
          </p>
          {edit && (
            <form
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
                  key={m.id}
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
                  <select
                    aria-label={
                      {
                        albums: "Альбомы",
                        tags: "Теги",
                        people: "Люди",
                        places: "Места",
                      }[kind]
                    }
                    key={m.id + kind + m.entities.join()}
                    name="entities"
                    multiple
                    defaultValue={m.entities.filter(
                      (id) =>
                        state.entities.find((e) => e.id === id)?.kind === kind,
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
                  </select>
                </label>
              ))}
              {m.meta.latitude !== undefined && (
                <div>
                  <p>
                    GPS {m.meta.latitude.toFixed(4)},{" "}
                    {m.meta.longitude?.toFixed(4)}
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      const name = prompt("Название места съёмки");
                      if (name?.trim())
                        await perform(async () => {
                          const e = await api("/entities/places", "POST", {
                            name,
                            space: m.space,
                            latitude: m.meta.latitude,
                            longitude: m.meta.longitude,
                          });
                          await api("/media/" + m.id, "PATCH", {
                            entities: [...m.entities, e.id],
                          });
                        });
                    }}
                  >
                    Создать место по GPS
                  </button>
                </div>
              )}
              <button className="primary">Сохранить</button>
            </form>
          )}
          <h3>Комментарии</h3>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <strong>{c.name}</strong>
              <small>{date(c.created)}</small>
              <p>{c.text}</p>
            </div>
          ))}
          {state.user &&
            state.spaces.find((s) => s.id === m.space)?.role !== "guest" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await perform(
                      () =>
                        api("/media/" + m.id + "/comments", "POST", {
                          text: comment,
                        }),
                      "Комментарий добавлен",
                    )
                  ) {
                    setComment("");
                    setComments(await api("/media/" + m.id + "/comments"));
                  }
                }}
              >
                <textarea
                  aria-label="Комментарий"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  maxLength={2000}
                  placeholder="Добавить комментарий…"
                />
                <button className="secondary">Отправить</button>
              </form>
            )}
          <p className="error">{error}</p>
        </section>
      </div>
    </ModalFrame>
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
  const [code, setCode] = useState(""),
    [role, setRole] = useState("member"),
    [join, setJoin] = useState("");
  return (
    <ModalFrame title="Семейный доступ" onClose={onClose}>
      <p>
        Пригласите близкого человека в своё пространство. Код действует 7 дней и
        используется один раз.
      </p>
      <label>
        Роль приглашённого
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">Участник — просмотр и свои загрузки</option>
          <option value="guest">Гость — только просмотр</option>
        </select>
      </label>
      <button
        className="primary"
        onClick={() =>
          void perform(async () => {
            const result = await api("/invites", "POST", { role });
            setCode(result.token);
          }, "Приглашение создано")
        }
      >
        Создать приглашение
      </button>
      {code && (
        <label>
          Код приглашения
          <input readOnly value={code} />
          <button
            className="secondary"
            onClick={() => void navigator.clipboard.writeText(code)}
          >
            <Copy size={16} />
            Скопировать
          </button>
        </label>
      )}
      <h3>Присоединиться к семье</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await perform(
              () => api("/invites/join", "POST", { token: join }),
              "Вы присоединились к семье",
            )
          )
            setJoin("");
        }}
      >
        <label>
          Код приглашения
          <input
            value={join}
            onChange={(e) => setJoin(e.target.value)}
            required
          />
        </label>
        <button className="secondary">Присоединиться</button>
      </form>
      <h3>Участники</h3>
      {state.members.map((m) => (
        <div className="member-row" key={m.id + m.space}>
          <UserRound size={20} />
          <div>
            <strong>{m.name}</strong>
            <small>
              {m.role === "owner"
                ? "Владелец"
                : m.role === "guest"
                  ? "Гость"
                  : "Участник"}
            </small>
          </div>
          {m.id !== state.user?.id &&
            state.spaces.find((s) => s.id === m.space)?.role === "owner" && (
              <button
                className="icon danger"
                aria-label={"Удалить участника " + m.name}
                onClick={() => {
                  if (confirm("Закрыть доступ участнику?"))
                    void perform(() =>
                      api("/members/" + m.space + "/" + m.id, "DELETE"),
                    );
                }}
              >
                <X size={18} />
              </button>
            )}
        </div>
      ))}
    </ModalFrame>
  );
}
function SettingsPage({
  user,
  query,
  requireUser,
  state,
  perform,
  setModal,
}: {
  user: User | null;
  query: string;
  requireUser: () => boolean;
  state: State;
  perform: Perform;
  setModal: (m: Modal | null) => void;
}) {
  const fallback: Settings = {
    theme: "light",
    visibility: "family",
    geolocation: true,
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
  }, [user?.settings]);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(user?.settings || fallback);
  useEffect(() => {
    document.documentElement.dataset.theme = draft.theme;
    return () => {
      document.documentElement.dataset.theme = user?.settings.theme || "light";
    };
  }, [draft.theme, user?.settings.theme]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    const click = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest("a[href]") &&
        !confirm("Есть несохранённые настройки. Покинуть страницу?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
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
    key: "geolocation" | "commentNotifications" | "sharedNotifications",
  ) => setDraft((d) => ({ ...d, [key]: !d[key] }));
  const toggleRow = (
    key: "geolocation" | "commentNotifications" | "sharedNotifications",
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
      <div className="settings-grid">
        <div>
          {shown("Мой профиль имя пароль email аватар") && (
            <section className="settings-card">
              <h2>
                <UserRound />
                Мой профиль
              </h2>
              <div className="profile-card">
                <div className="profile-avatar">
                  {draft.avatar ? (
                    <img
                      src={"/api/files/" + draft.avatar + "/thumb"}
                      alt="Ваш аватар"
                    />
                  ) : (
                    <UserRound size={64} />
                  )}
                </div>
                <div>
                  <h2>{user?.name || "Ваш профиль"}</h2>
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
          {shown("Внешний вид светлая тема тёмная тема") && (
            <section className="settings-card">
              <h2>
                <Monitor />
                Внешний вид
              </h2>
              <p>Выберите тему оформления</p>
              <div className="theme-options">
                <button
                  className={draft.theme === "light" ? "chosen" : ""}
                  onClick={() => setDraft((d) => ({ ...d, theme: "light" }))}
                >
                  <Sun />
                  Светлая тема{draft.theme === "light" && <Check size={18} />}
                </button>
                <button
                  className={draft.theme === "dark" ? "chosen" : ""}
                  onClick={() => setDraft((d) => ({ ...d, theme: "dark" }))}
                >
                  <Moon />
                  Тёмная тема{draft.theme === "dark" && <Check size={18} />}
                </button>
              </div>
            </section>
          )}
        </div>
        <div>
          {shown("Приватность альбомы распознавание лиц геолокация") && (
            <section className="settings-card">
              <h2>
                <Shield />
                Приватность
              </h2>
              <div className="setting-row">
                <Users size={23} />
                <span>Новые альбомы видны</span>
                <select
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
                </select>
              </div>
              <div className="setting-row">
                <UserRound size={23} />
                <span>Распознавание лиц</span>
                <small>Недоступно · ручная разметка</small>
              </div>
              {toggleRow("geolocation", "Геолокация фото", MapPin)}
              <small>
                GPS считывается только из новых загрузок. Доступ к существующим
                альбомам изменяется в их настройках.
              </small>
            </section>
          )}
          {shown("Уведомления комментарии общие альбомы") && (
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
              {toggleRow("sharedNotifications", "Общие альбомы", Share2)}
            </section>
          )}
        </div>
      </div>
      <div className="save-settings">
        <button
          className="primary"
          disabled={!dirty || busy}
          onClick={async () => {
            if (!requireUser()) return;
            setBusy(true);
            await perform(
              () => api("/settings", "PATCH", draft),
              "Настройки сохранены",
            );
            setBusy(false);
          }}
        >
          <Check />
          {busy ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
      {shown(
        "Хранилище резервное копирование экспорт восстановление семья выход",
      ) && (
        <section className="settings-card backup-card">
          <h2>
            <Shield />
            Данные и доступ
          </h2>
          <p>
            Занято {size(state.bytes)}. Резервная копия содержит ваши оригиналы
            и коллекции. Храните её на другом диске.
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
                    !confirm(
                      "Импортировать копию как новые объекты? Текущие данные сохранятся.",
                    )
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
            <button
              className="secondary"
              onClick={() => {
                if (requireUser()) setModal({ type: "family" });
              }}
            >
              <Users size={18} />
              Семейный доступ
            </button>
            {user && (
              <button
                className="secondary"
                onClick={async () => {
                  await api("/auth/logout", "POST");
                  window.location.href = "/";
                }}
              >
                <LogOut size={18} />
                Выйти
              </button>
            )}
          </div>
          {backupMessage && <p role="status">{backupMessage}</p>}
        </section>
      )}
      {profile && user && (
        <ModalFrame title="Изменить профиль" onClose={() => setProfile(false)}>
          <form
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
                  await api("/settings", "PATCH", {
                    ...user.settings,
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
              <select
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
              </select>
              <small>Аватар сохранится вместе с профилем.</small>
            </label>
            <p className="error">{profileError}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setProfile(false)}
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
    <App />
  </BrowserRouter>,
);
