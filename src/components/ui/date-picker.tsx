import * as Popover from "@radix-ui/react-popover";
import * as React from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/languageStore";

const NAMES = {
  uz: {
    months: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
    monthsShort: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
    weekdays: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
    today: "Bugun",
    clear: "Tozalash",
    placeholder: "Sanani tanlang",
  },
  ru: {
    months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
    monthsShort: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    today: "Сегодня",
    clear: "Очистить",
    placeholder: "Выберите дату",
  },
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    today: "Today",
    clear: "Clear",
    placeholder: "Pick a date",
  },
} as const;

const VALUE_FORMAT = "yyyy-MM-dd";
const YEARS_PER_PAGE = 12;

const parseValue = (value?: string | null) => {
  if (!value) return null;
  const date = parse(value.slice(0, 10), VALUE_FORMAT, new Date());
  return isValid(date) ? date : null;
};

interface DatePickerProps {
  id?: string;
  /** "yyyy-MM-dd", or "" for no date — the same string a native date input uses. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Earliest / latest selectable year (inclusive). */
  fromYear?: number;
  toYear?: number;
  className?: string;
  contentClassName?: string;
}

type View = "days" | "months" | "years";

/**
 * Date field in the app's own style, replacing the browser's date input.
 *
 * Works with plain "yyyy-MM-dd" strings, so it drops into forms that used
 * <input type="date"> without changing what they send. The calendar opens on
 * days; the title jumps to a month grid and then a year grid, so a birth date
 * 15 years back is three clicks, not 180.
 */
export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  invalid = false,
  fromYear = 1950,
  toYear = new Date().getFullYear() + 10,
  className,
  contentClassName,
}: DatePickerProps) {
  const language = useLanguageStore((s) => s.language);
  const names = NAMES[language as keyof typeof NAMES] ?? NAMES.uz;

  const selected = parseValue(value);
  const today = new Date();

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("days");
  const [cursor, setCursor] = React.useState<Date>(
    () => selected ?? today,
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Open on the chosen date's month, or today's.
      setCursor(startOfMonth(parseValue(value) ?? new Date()));
      setView("days");
    } else {
      onBlur?.();
    }
  };

  const commit = (date: Date | null) => {
    onChange(date ? format(date, VALUE_FORMAT) : "");
    setOpen(false);
    onBlur?.();
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const isYearAllowed = (y: number) => y >= fromYear && y <= toYear;

  // 6 weeks, Monday first, so the grid height never jumps between months.
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const pageStart = year - (((year - fromYear) % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE;
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i);

  const goPrev = () => {
    if (view === "days") setCursor((c) => addMonths(c, -1));
    else if (view === "months") setCursor((c) => addMonths(c, -12));
    else setCursor((c) => addMonths(c, -12 * YEARS_PER_PAGE));
  };
  const goNext = () => {
    if (view === "days") setCursor((c) => addMonths(c, 1));
    else if (view === "months") setCursor((c) => addMonths(c, 12));
    else setCursor((c) => addMonths(c, 12 * YEARS_PER_PAGE));
  };

  const title =
    view === "days"
      ? `${names.months[month]} ${year}`
      : view === "months"
        ? String(year)
        : `${years[0]} – ${years[years.length - 1]}`;

  const navButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-red-500 hover:border-red-500",
            className,
          )}
        >
          <span
            className={cn(
              "truncate tabular-nums",
              !selected && "text-muted-foreground",
            )}
          >
            {selected
              ? format(selected, "dd.MM.yyyy")
              : placeholder || names.placeholder}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[10030] w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
            contentClassName,
          )}
        >
          {/* Header: ‹ title › — the title zooms out days → months → years */}
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" onClick={goPrev} className={navButton} aria-label="‹">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView(view === "days" ? "months" : "years")}
              disabled={view === "years"}
              className="flex-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
            >
              {title}
            </button>
            <button type="button" onClick={goNext} className={navButton} aria-label="›">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {view === "days" && (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase text-muted-foreground">
                {names.weekdays.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day) => {
                  const isSelected = selected && isSameDay(day, selected);
                  const isToday = isSameDay(day, today);
                  const inMonth = isSameMonth(day, cursor);
                  const allowed = isYearAllowed(day.getFullYear());
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={!allowed}
                      onClick={() => commit(day)}
                      aria-label={format(day, "dd.MM.yyyy")}
                      aria-pressed={isSelected || undefined}
                      className={cn(
                        "h-9 rounded-md text-sm tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-30",
                        !inMonth && "text-muted-foreground/50",
                        isToday && !isSelected && "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                        isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "months" && (
            <div className="grid grid-cols-3 gap-1.5">
              {names.monthsShort.map((label, index) => {
                const isCurrent =
                  selected &&
                  selected.getFullYear() === year &&
                  selected.getMonth() === index;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setCursor(new Date(year, index, 1));
                      setView("days");
                    }}
                    className={cn(
                      "h-10 rounded-md text-sm transition-colors hover:bg-muted",
                      isCurrent && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {view === "years" && (
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((y) => {
                const isCurrent = selected?.getFullYear() === y;
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={!isYearAllowed(y)}
                    onClick={() => {
                      setCursor(new Date(y, month, 1));
                      setView("months");
                    }}
                    className={cn(
                      "h-10 rounded-md text-sm tabular-nums transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30",
                      y === today.getFullYear() && !isCurrent && "font-semibold text-primary",
                      isCurrent && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => commit(null)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {names.clear}
            </button>
            <button
              type="button"
              onClick={() => commit(today)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {names.today}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
