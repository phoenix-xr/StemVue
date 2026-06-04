import { IconGear, IconUser } from "./icons";

export function TopBar() {
  return (
    <div className="flex items-center gap-1">
      <button
        id="btn-settings"
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
        title="Settings"
      >
        <IconGear />
      </button>
      <button
        id="btn-account"
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
        title="Account"
      >
        <IconUser />
      </button>
    </div>
  );
}
