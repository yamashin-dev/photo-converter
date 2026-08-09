/**
 * テーマ適用を最初のペイント前に行うインラインスクリプト。
 * 静的HTMLにテーマを埋め込めない（ビルド時に利用者の設定が分からない）ため、
 * ここだけはhydration前に同期実行してちらつきを防ぐ。
 */
const script = `(function(){try{var t=localStorage.getItem('pc-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
