import { Link, useRouterState } from "@tanstack/react-router";
import { ListTodo, Sun } from "lucide-react";

const tabs = [
  { to: "/", label: "All Tasks", Icon: ListTodo },
  { to: "/my-day", label: "My Day", Icon: Sun },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ to, label, Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 py-3 pb-6 text-[11px] tracking-wide transition-colors ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
