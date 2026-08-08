# フォトチェンジ（photo-converter）

写真をドット絵・手描き風イラストに変換するWebアプリ。

**URL**: https://photo-converter.yamashin-app.com（公開準備中）

旧2ツールの統合リニューアル版:
- [convert-photo-16bit](https://github.com/yamashin-dev/convert-photo-16bit)（PHP/GD・ドット絵変換）
- [convert-photo-drawing](https://github.com/yamashin-dev/convert-photo-drawing)（Flask/OpenCV・手描き風変換）

## 特徴

- **変換は全てブラウザ内で完結** — 画像はサーバーに送信されない
- 3スタイル: ドット絵（レトロ）/ ドット絵（整数倍）/ 手描き風イラスト
- ディザリング9種、パレット8種+自動抽出4方式
- PWA対応（オフライン動作・ホーム画面追加・共有ターゲット）

## 技術構成

- Next.js (App Router) + TypeScript、静的エクスポート（`output: "export"`）
- 変換エンジン: `src/engine/` の純TSモジュール（フレームワーク非依存、Web Worker実行）
- スタイリング: CSS Modules（標準CSS）
- テスト: Vitest（ユニット + ゴールデンテスト）

設計の詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## 開発

```bash
npm run dev        # 開発サーバー
npm run build      # 静的エクスポートビルド（out/ に出力）
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm test           # テスト実行
```
