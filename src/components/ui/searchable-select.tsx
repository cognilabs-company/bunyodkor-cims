import * as Popover from "@radix-ui/react-popover";
import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  buildSearchEntry,
  matchesSearch,
  tokenizeQuery,
} from "@/lib/search-utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string[];
  /** Second, quieter line under the label (e.g. a group's coach). */
  description?: string;
  /** Heading the option is listed under (e.g. a birth year). Options with the
   *  same section should be adjacent; a heading is drawn where it changes. */
  section?: string;
  /** Text shown on the closed trigger when selected; defaults to `label`. */
  selectedLabel?: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Hide the search box — for short lists. Default true. */
  searchable?: boolean;
  /** Draws the trigger in the error state. */
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

/**
 * A select drawn in the app's own style: styled trigger, a popover list with
 * optional search, section headings and a description line.
 *
 * Keyboard: ↑/↓ move, Enter picks, Escape closes (only the list — see Dialog).
 * Search folds Cyrillic/Latin and apostrophe variants (lib/search-utils), so
 * "hayotov" finds "Хаётов".
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No data found",
  disabled = false,
  searchable = true,
  invalid = false,
  className,
  triggerClassName,
  contentClassName,
}: SearchableSelectProps) {
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const selectedOption = options.find((option) => option.value === value);

  const searchIndex = React.useMemo(
    () =>
      options.map((option) => ({
        option,
        entry: buildSearchEntry([
          option.label,
          option.value,
          option.description,
          option.section,
          ...(option.keywords || []),
        ]),
      })),
    [options],
  );

  const filteredOptions = React.useMemo(() => {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return options;
    return searchIndex
      .filter(({ entry }) => matchesSearch(entry, tokens))
      .map(({ option }) => option);
  }, [options, searchIndex, query]);

  // Opening: clear the search and start on the selected option.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(options.findIndex((option) => option.value === value));

    const frameId = window.requestAnimationFrame(() => {
      if (searchable) searchInputRef.current?.focus();
      else listRef.current?.focus();
      listRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted option in view while moving with the keyboard.
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const pick = (option: SearchableSelectOption) => {
    onValueChange(option.value);
    setOpen(false);
  };

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (filteredOptions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(filteredOptions.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) pick(option);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              // Same look as <Select>: border, hover and focus ring match.
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
              invalid && "border-red-500 hover:border-red-500",
              triggerClassName,
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={invalid || undefined}
          >
            <span
              className={cn(
                "truncate text-left",
                !selectedOption && "text-muted-foreground",
              )}
            >
              {selectedOption?.selectedLabel ||
                selectedOption?.label ||
                placeholder}
            </span>
            <ChevronDown
              className={cn(
                "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className={cn(
              "z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none",
              contentClassName,
            )}
            style={{
              width: "var(--radix-popover-trigger-width)",
              minWidth: "16rem",
            }}
          >
            {searchable && (
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleListKeyDown}
                    placeholder={searchPlaceholder}
                    className="h-9 pl-9"
                  />
                </div>
              </div>
            )}

            <div
              ref={listRef}
              role="listbox"
              tabIndex={searchable ? -1 : 0}
              onKeyDown={searchable ? undefined : handleListKeyDown}
              className="max-h-72 overflow-y-auto p-1 outline-none"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  const showSection =
                    option.section &&
                    option.section !== filteredOptions[index - 1]?.section;

                  return (
                    <React.Fragment key={`${option.value}-${option.label}`}>
                      {showSection && (
                        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                          {option.section}
                        </div>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-index={index}
                        data-selected={isSelected}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70",
                          isActive && "bg-muted/70",
                          isSelected && "bg-primary/10 text-primary",
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pick(option)}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-primary transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate",
                              isSelected && "font-medium",
                            )}
                          >
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </button>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
