"use client";

import { useId } from "react";
import { useCategories } from "@/lib/hooks/useCategories";

/** <select> の value は文字列しか持てないので「すべて」を空文字で表す */
const ALL = "";

type Props = {
  value: string | null;
  onChange: (category: string | null) => void;
};

export function CategoryFilter({ value, onChange }: Props) {
  const id = useId();
  const helpId = `${id}-help`;
  const { data, isPending, isError, refetch } = useCategories();
  const categories = data?.items ?? [];

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        カテゴリ
      </label>
      <select
        id={id}
        value={value ?? ALL}
        onChange={(e) => onChange(e.target.value === ALL ? null : e.target.value)}
        disabled={isPending || isError}
        aria-describedby={isError ? helpId : undefined}
        className="mt-1 block h-11 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value={ALL}>{isPending ? "読み込み中…" : "すべて"}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {isError && (
        <p id={helpId} className="mt-1 text-sm text-slate-600">
          カテゴリを取得できなかったため、すべてのカテゴリで検索しています。
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-1 cursor-pointer font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            再読み込み
          </button>
        </p>
      )}
    </div>
  );
}
