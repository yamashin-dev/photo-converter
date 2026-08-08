import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的エクスポート: VPSのnginx静的配信のみで動作させる（サーバープロセス不要）
  output: "export",
  // 静的エクスポートではNext.jsの画像最適化サーバーが使えない
  images: { unoptimized: true },
};

export default nextConfig;
