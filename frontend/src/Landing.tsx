import { useTheme } from "./theme";
import {
  Images,
  ArrowRight,
  Heart,
  Users,
  Shield,
  Sun,
  Moon,
  Upload,
  FolderHeart,
  Check,
} from "lucide-react";
export default function Landing({
  onRegister,
  onLogin,
  error,
  onRetry,
}: {
  onRegister: () => void;
  onLogin: () => void;
  error?: string;
  onRetry: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Images size={30} />
          </span>
          <b>
            Семейные
            <br />
            альбомы
          </b>
        </a>
        <nav>
          <a href="#features">Возможности</a>
          <a href="#begin">Как начать</a>
        </nav>
        <div>
          <button
            className="icon"
            aria-label="Переключить тему"
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="secondary" onClick={onLogin}>
            Войти
          </button>
          <button className="primary" onClick={onRegister}>
            Создать аккаунт
          </button>
        </div>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <div>
            <span className="landing-eyebrow">
              <Heart size={17} />
              Для тех, кто рядом
            </span>
            <h1>
              Сохраняйте
              <br />
              семейные
              <br />
              <em>воспоминания.</em>
            </h1>
            <p>
              Фотографии, видео и истории вашей семьи.
              <br />В одном месте, куда хочется возвращаться.
            </p>
            <div className="landing-actions">
              <button className="primary" onClick={onRegister}>
                Создать семейный архив
                <ArrowRight size={18} />
              </button>
              <button className="secondary" onClick={onLogin}>
                У меня есть аккаунт
              </button>
            </div>
          </div>
        </section>
        {error && (
          <div className="landing-error" role="alert">
            <p>{error}</p>
            <button className="secondary" onClick={onRetry}>
              Повторить подключение
            </button>
          </div>
        )}
        <section id="features" className="landing-features">
          {[
            [
              Images,
              "Все моменты вместе",
              "Храните оригиналы фото и видео. Собирайте альбомы, добавляйте людей, места и теги.",
            ],
            [
              Users,
              "Семейный круг",
              "Приглашайте близких по личному коду и выбирайте, кому доступны ваши альбомы.",
            ],
            [
              Shield,
              "Архив под вашим контролем",
              "Файлы остаются на вашем сервере. Резервную копию можно скачать в настройках.",
            ],
          ].map(([Icon, title, copy]) => (
            <article key={String(title)}>
              <span>{typeof Icon !== "string" && <Icon size={25} />}</span>
              <h2>{title as string}</h2>
              <p>{copy as string}</p>
            </article>
          ))}
        </section>
        <section id="begin" className="landing-begin">
          <div>
            <h2>
              Ваша история начинается
              <br />с первого снимка.
            </h2>
            <p>
              Создайте аккаунт, загрузите любимые фотографии
              <br />и пригласите семью в свой архив.
            </p>
            <button className="primary" onClick={onRegister}>
              Начать свою историю
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="begin-steps">
            <div>
              <span>
                <Check size={18} />
              </span>
              <strong>Создайте личный аккаунт</strong>
              <small>Имя, email и надёжный пароль</small>
            </div>
            <div>
              <span>
                <Upload size={18} />
              </span>
              <strong>Добавьте фотографии</strong>
              <small>Оригиналы, видео и подписи к моментам</small>
            </div>
            <div>
              <span>
                <FolderHeart size={18} />
              </span>
              <strong>Соберите первый альбом</strong>
              <small>И поделитесь им с близкими</small>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>Семейные альбомы</span>
        <span>С любовью к вашей истории</span>
      </footer>
    </div>
  );
}
