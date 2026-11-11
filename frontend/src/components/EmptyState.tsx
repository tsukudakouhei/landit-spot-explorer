import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** タイトルの上に出す装飾アイコン */
  icon?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
};

/** 0 件・エラーなど「結果の代わりに出す案内」の共通レイアウト */
export function EmptyState({ title, description, icon, action, role = "status" }: Props) {
  return (
    <div role={role} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
