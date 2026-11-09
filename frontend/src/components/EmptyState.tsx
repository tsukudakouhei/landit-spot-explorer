import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  role?: "status" | "alert";
};

/** 0 件・エラーなど「結果の代わりに出す案内」の共通レイアウト */
export function EmptyState({ title, description, action, role = "status" }: Props) {
  return (
    <div role={role} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-base font-medium text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {action}
    </div>
  );
}
