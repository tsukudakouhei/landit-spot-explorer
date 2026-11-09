"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * 地図（Google Maps の内部処理）で例外が出ても、住所バー・検索条件・リストまで巻き込んで落ちないようにする。
 * 例: キーが無効なとき、マーカーのスタイル変更が Google 側で TypeError を投げる。
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="flex h-full items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">地図を表示できませんでした。</p>
          <p className="mt-1">
            GOOGLE_MAPS_BROWSER_KEY が正しいか、Maps JavaScript API が有効か、このサイトの URL
            がキーのリファラ制限で許可されているかを確認してください。住所表示とリストはこのまま使えます。
          </p>
        </div>
      </div>
    );
  }
}
