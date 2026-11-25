import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";

function usePanel(open: boolean, onClose: () => void) {
  const anchor = useRef<HTMLSpanElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const [container, setContainer] = useState<Element | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    setContainer(anchor.current?.closest("dialog") || document.body);
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const availableBelow = window.innerHeight - r.bottom - 12;
      const above = availableBelow < 180 && r.top > availableBelow;
      const maxHeight = Math.max(
        110,
        Math.min(300, above ? r.top - 16 : availableBelow),
      );
      setPosition({
        position: "fixed",
        left: Math.max(
          10,
          Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 10),
        ),
        width: Math.min(Math.max(r.width, 220), window.innerWidth - 20),
        maxHeight,
        ...(above
          ? { bottom: window.innerHeight - r.top + 6 }
          : { top: r.bottom + 6 }),
      });
    };
    place();
    const outside = (e: PointerEvent) => {
      if (
        !anchor.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return { anchor, panel, position, container };
}
type ChoiceEvent = {
  target: { value: string; selectedOptions: { value: string }[] };
};
type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> & { onChange?: (event: ChoiceEvent) => void };
function optionsFrom(
  children: React.ReactNode,
): { value: string; label: string; disabled: boolean }[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === React.Fragment) return optionsFrom(child.props.children);
    const label = React.Children.toArray(child.props.children).join("");
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: !!child.props.disabled,
      },
    ];
  });
}
export function Select({
  children,
  value,
  defaultValue,
  name,
  multiple,
  onChange,
  disabled,
  className,
  "aria-label": label,
  ...props
}: SelectProps) {
  const options = optionsFrom(children);
  const initial = defaultValue ?? (multiple ? [] : (options[0]?.value ?? ""));
  const [local, setLocal] = useState(initial),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [autoLabel, setAutoLabel] = useState("");
  const selected = value === undefined ? local : value;
  const values = (Array.isArray(selected) ? selected : [selected]).map(String);
  const id = useId(),
    close = () => setOpen(false);
  const { anchor, panel, position, container } = usePanel(open, close);
  useEffect(() => {
    const parent = anchor.current?.closest("label");
    setAutoLabel(
      Array.from(parent?.childNodes || [])
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join("")
        .trim(),
    );
  }, []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [active]?.scrollIntoView({ block: "nearest" });
  }, [open, active, container]);
  function choose(option: { value: string; disabled: boolean }) {
    if (option.disabled) return;
    const next = multiple
      ? values.includes(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value]
      : [option.value];
    if (value === undefined) setLocal(multiple ? next : next[0]);
    onChange?.({
      target: {
        value: next[0] ?? "",
        selectedOptions: next.map((value) => ({ value })),
      },
    });
    if (!multiple) setOpen(false);
    anchor.current?.querySelector("button")?.focus();
  }
  const chosen = options.filter((o) => values.includes(o.value));
  return (
    <span className={"select-control " + (className || "")} ref={anchor}>
      {name &&
        (multiple ? values.filter(Boolean) : values).map((v) => (
          <input key={v} type="hidden" name={name} value={v} />
        ))}
      <button
        type="button"
        className="select-trigger"
        aria-label={label || autoLabel || name || "Выбрать"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => {
          setActive(
            Math.max(
              0,
              options.findIndex((o) => values.includes(o.value)),
            ),
          );
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  options.length - 1,
                  i + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            if (options[active]) choose(options[active]);
          }
          if (e.key === "Tab") setOpen(false);
        }}
      >
        <span>
          {chosen.length
            ? multiple
              ? chosen.map((o) => o.label).join(", ")
              : chosen[0].label
            : multiple
              ? "Не выбрано"
              : "Выбрать"}
        </span>
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open &&
        container &&
        createPortal(
          <div
            id={id}
            role="listbox"
            aria-label={label || autoLabel || name || "Варианты"}
            aria-multiselectable={multiple || undefined}
            className="choice-panel"
            ref={panel}
            style={position}
          >
            {options.length ? (
              options.map((o, i) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={values.includes(o.value)}
                  disabled={o.disabled}
                  className={
                    (values.includes(o.value) ? "chosen " : "") +
                    (i === active ? "highlighted" : "")
                  }
                  key={o.value}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  {multiple && (
                    <span className="choice-check">
                      {values.includes(o.value) && <Check size={13} />}
                    </span>
                  )}
                  <span>{o.label}</span>
                  {!multiple && values.includes(o.value) && <Check size={16} />}
                </button>
              ))
            ) : (
              <p className="choice-empty">Пока нет доступных вариантов</p>
            )}
          </div>,
          container,
        )}
    </span>
  );
}
const iso = (d: Date) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
export function DateField({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [month, setMonth] = useState(
      () => new Date(defaultValue ? defaultValue + "T12:00:00" : Date.now()),
    );
  const { anchor, panel, position, container } = usePanel(open, () =>
    setOpen(false),
  );
  const start = new Date(month.getFullYear(), month.getMonth(), 1),
    offset = (start.getDay() + 6) % 7,
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <span className="date-control" ref={anchor}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className="select-trigger"
        aria-label="Дата события"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          {value
            ? new Date(value + "T12:00:00").toLocaleDateString("ru-RU")
            : "Выберите дату"}
        </span>
        <Calendar size={18} />
      </button>
      {open &&
        container &&
        createPortal(
          <div
            className="calendar-panel choice-panel"
            style={position}
            ref={panel}
          >
            <div className="calendar-heading">
              <button
                type="button"
                className="icon"
                aria-label="Предыдущий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={18} />
              </button>
              <strong>
                {month.toLocaleDateString("ru-RU", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <button
                type="button"
                className="icon"
                aria-label="Следующий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="calendar-days">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <small key={d}>{d}</small>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={"empty" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = iso(
                  new Date(month.getFullYear(), month.getMonth(), i + 1),
                );
                return (
                  <button
                    type="button"
                    key={day}
                    className={day === value ? "chosen" : ""}
                    aria-label={day}
                    onClick={() => {
                      setValue(day);
                      setOpen(false);
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="calendar-footer">
              <button
                type="button"
                onClick={() => {
                  setValue(iso(new Date()));
                  setOpen(false);
                }}
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
              >
                Очистить
              </button>
            </div>
          </div>,
          container,
        )}
    </span>
  );
}
type Question = {
  id: number;
  message: string;
  kind: "confirm" | "prompt";
  initial?: string;
  resolve: (value: any) => void;
};
const DialogContext = createContext<{
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, initial?: string) => Promise<string | null>;
}>({ confirm: async () => false, prompt: async () => null });
export const useDialogs = () => useContext(DialogContext);
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const nextId = useRef(0);
  const current = questions[0];
  const ask = (kind: "confirm" | "prompt", message: string, initial?: string) =>
    new Promise<any>((resolve) =>
      setQuestions((items) => [
        ...items,
        { id: ++nextId.current, kind, message, initial, resolve },
      ]),
    );
  const finish = (value: string | boolean | null) => {
    current.resolve(value);
    setQuestions((items) => items.slice(1));
  };
  return (
    <DialogContext.Provider
      value={{
        confirm: (message) => ask("confirm", message),
        prompt: (message, initial) => ask("prompt", message, initial),
      }}
    >
      {children}
      {current && (
        <QuestionDialog key={current.id} question={current} finish={finish} />
      )}
    </DialogContext.Provider>
  );
}
function QuestionDialog({
  question,
  finish,
}: {
  question: Question;
  finish: (value: string | boolean | null) => void;
}) {
  useScrollLock();
  const ref = useRef<HTMLDialogElement>(null),
    [value, setValue] = useState(question.initial || "");
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className="question-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        finish(question.kind === "prompt" ? null : false);
      }}
      aria-label={
        question.kind === "prompt" ? "Введите название" : "Подтверждение"
      }
    >
      <h2>
        {question.kind === "prompt" ? "Введите название" : "Подтверждение"}
      </h2>
      <p>{question.message}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          finish(question.kind === "prompt" ? value : true);
        }}
      >
        {question.kind === "prompt" && (
          <input
            aria-label="Название"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            maxLength={120}
            autoFocus
          />
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => finish(question.kind === "prompt" ? null : false)}
          >
            Отмена
          </button>
          <button
            className="primary"
            disabled={question.kind === "prompt" && !value.trim()}
          >
            {question.kind === "prompt" ? "Сохранить" : "Подтвердить"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
let scrollLocks = 0;
let previousOverflow = "";
export function useScrollLock() {
  useEffect(() => {
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
}
