"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styles from "./Converter.module.css";
import { DropZone } from "./DropZone";
import { ControlPanel } from "./ControlPanel";
import { ComparisonView, type PreviewState } from "./ComparisonView";
import { ToastList, useToasts } from "./Toast";
import { Showcase } from "./Showcase";
import { IconDownload, IconLink, IconReset } from "./Icon";
import { trackEvent } from "./Analytics";
import type { ConversionParams } from "@/engine/types";
import { useConversion } from "@/hooks/useConversion";
import { DEFAULT_PARAMS, ILLUSTRATION_DEFAULTS, paramsToQuery } from "@/lib/params";
import {
  getParamsServerSnapshot,
  getParamsSnapshot,
  subscribeParams,
  updateParams,
} from "@/lib/paramsStore";
import {
  exportImage,
  imageDataToUrl,
  loadImageData,
  UnsupportedImageError,
} from "@/lib/imageLoader";

type Format = "image/png" | "image/webp";

export function Converter() {
  // 設定は外部ストアで持つ（初期値がURL・localStorage由来のため）
  const params = useSyncExternalStore(
    subscribeParams,
    getParamsSnapshot,
    getParamsServerSnapshot
  );
  const [source, setSource] = useState<ImageData | null>(null);
  const [sourceName, setSourceName] = useState("photo");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("image/png");
  const [loading, setLoading] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const conversion = useConversion(source, params);

  // 元画像のBlob URLはイベント側で作る（レンダーやeffectでは副作用を起こさない）。
  // 最新のURLをrefで押さえ、アンマウント時に取りこぼさず解放する
  const originalUrlRef = useRef<string | null>(null);
  const replaceOriginalUrl = useCallback((url: string | null) => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    originalUrlRef.current = url;
    setOriginalUrl(url);
  }, []);
  useEffect(
    () => () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    },
    []
  );

  // 変換結果をBlob URLにする。生成したURLはcleanupで必ず解放する
  useEffect(() => {
    if (!conversion.result) return;
    let cancelled = false;
    let created: string | null = null;

    imageDataToUrl(conversion.result)
      .then((url) => {
        created = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setResultUrl(url);
      })
      .catch(() =>
        push("error", "プレビューを表示できませんでした。もう一度お試しください")
      );

    return () => {
      cancelled = true;
      if (created) {
        URL.revokeObjectURL(created);
        // 解放したURLを画像が参照し続けないよう、表示側からも外す
        setResultUrl((prev) => (prev === created ? null : prev));
      }
    };
  }, [conversion.result, push]);

  // 結果が消えた瞬間に古いプレビューを映さない（stateを増やさず導出する）
  const previewUrl = conversion.result ? resultUrl : null;

  /**
   * プレビューの状態。
   * 「変換中でない かつ 結果がない」だけで中止と判定すると、
   * 変換成功直後（書き出し待ち）やエラー時まで中止扱いになってしまう。
   */
  const previewState: PreviewState = conversion.isConverting
    ? "converting"
    : conversion.error
      ? "error"
      : previewUrl
        ? "ready"
        : conversion.result
          ? "encoding"
          : "cancelled";

  useEffect(() => {
    if (conversion.error) push("error", conversion.error);
  }, [conversion.error, push]);

  // 画面の変化が見えない利用者にも、変換が終わったことを伝える
  const liveMessage = conversion.result
    ? `変換が完了しました。${conversion.result.width}かける${conversion.result.height}ピクセル。保存できます`
    : "";

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const data = await loadImageData(file);
        setSource(data);
        setSourceName(file.name.replace(/\.[^.]+$/, "") || "photo");
        replaceOriginalUrl(URL.createObjectURL(file));
        trackEvent("image_loaded", { width: data.width, height: data.height });
      } catch (e) {
        push(
          "error",
          e instanceof UnsupportedImageError
            ? e.message
            : "画像を読み込めませんでした。別のファイルでお試しください。"
        );
      } finally {
        setLoading(false);
      }
    },
    [push, replaceOriginalUrl]
  );

  /** サンプルを押すたびに別の写真を出すための位置 */
  const sampleIndexRef = useRef(0);

  // 共有起動の受け取りはマウント時に一度だけ走るため、最新の関数を参照で持つ
  const handleFileRef = useRef(handleFile);
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  // OSの共有メニューから起動された場合、Service Workerが預かった画像を受け取る
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("shared")) return;
    let cancelled = false;

    (async () => {
      try {
        const cache = await caches.open("pc-share");
        const res = await cache.match("/shared-image");
        // 読めても読めなくても、預かった写真は端末に残さない
        await cache.delete("/shared-image");
        window.history.replaceState(null, "", window.location.pathname);
        if (!res || cancelled) return;

        // 前回の共有の残骸を誤って開かないよう、受け取り時刻を確認する
        const receivedAt = Number(res.headers.get("X-Received-At") ?? 0);
        if (receivedAt && Date.now() - receivedAt > 5 * 60 * 1000) return;

        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get("X-Filename") || "shared");
        await handleFileRef.current(new File([blob], name, { type: blob.type }));
      } catch {
        // 受け取れなくても通常の選択導線は使える
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** 手持ちの写真がなくても試せるよう、同梱のサンプルを読み込む */
  const loadSample = useCallback(async () => {
    setLoading(true);
    try {
      // 毎回同じ絵にならないよう、3枚から順番に出す
      const names = ["island", "cape", "harbor"];
      const picked = names[sampleIndexRef.current % names.length];
      sampleIndexRef.current++;
      const res = await fetch(`/samples/${picked}.jpg`);
      if (!res.ok) throw new Error("sample not found");
      const blob = await res.blob();
      await handleFileRef.current(
        new File([blob], `サンプル-${picked}.jpg`, { type: "image/jpeg" })
      );
    } catch {
      push("error", "サンプル写真を読み込めませんでした。お手持ちの写真でお試しください");
    } finally {
      setLoading(false);
    }
  }, [push]);

  const patch = useCallback((p: Partial<ConversionParams>) => {
    updateParams((prev) => {
      // 手描き風へ切り替えたときは、その様式に合う既定値へ寄せる
      if (p.style === "illustration" && prev.style !== "illustration") {
        return { ...prev, ...ILLUSTRATION_DEFAULTS, ...p };
      }
      // 手描き風から戻すときは、手描き風用に寄せた値をすべて既定へ戻す
      // （saturationの戻し漏れで彩度90%が残る問題があった）
      if (p.style && p.style !== "illustration" && prev.style === "illustration") {
        return {
          ...prev,
          ...p,
          numColors: DEFAULT_PARAMS.numColors,
          extractMethod: DEFAULT_PARAMS.extractMethod,
          outline: DEFAULT_PARAMS.outline,
          saturation: DEFAULT_PARAMS.saturation,
        };
      }
      return { ...prev, ...p };
    });
  }, []);

  const reset = useCallback(() => {
    conversion.cancel();
    setSource(null);
    replaceOriginalUrl(null);
    // 変換結果側のURLはeffectのcleanupが解放する
    setResultUrl(null);
  }, [conversion, replaceOriginalUrl]);

  const download = useCallback(async () => {
    if (!conversion.result) return;
    try {
      const blob = await exportImage(conversion.result, format);
      const ext = format === "image/webp" ? "webp" : "png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sourceName}_${params.style}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // iOSはクリック直後にrevokeすると保存に失敗することがある
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      trackEvent("download", { style: params.style, format: ext });
    } catch {
      push("error", "画像の書き出しに失敗しました");
    }
  }, [conversion.result, format, params.style, sourceName, push]);

  const share = useCallback(async () => {
    const query = paramsToQuery(params);
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      push("success", "この設定のリンクをコピーしました");
    } catch {
      push("error", "リンクをコピーできませんでした");
    }
  }, [params, push]);

  const pixelated = params.style !== "illustration";
  const sizeLabel = useMemo(() => {
    if (!conversion.result) return null;
    return `${conversion.result.width} × ${conversion.result.height}px`;
  }, [conversion.result]);

  return (
    <>
      {!source ? (
        <div className={styles.intro}>
          <Hero />
          <DropZone onFile={handleFile} onSample={loadSample} disabled={loading} />
          {/* 何ができるツールかは、写真を選ぶ導線の「下」で伝える */}
          <Showcase />
        </div>
      ) : (
        <div className={styles.workspace}>
          <div className={styles.preview}>
            <ComparisonView
              key={originalUrl}
              originalUrl={originalUrl!}
              resultUrl={previewUrl}
              state={previewState}
              errorMessage={conversion.error}
              progress={conversion.progress}
              onCancel={conversion.cancel}
              onRetry={conversion.retry}
              pixelated={pixelated}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.download}
                onClick={download}
                disabled={!conversion.result}
              >
                <IconDownload size={18} />
                保存する
              </button>

              <select
                className={styles.format}
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                aria-label="保存形式"
              >
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP（軽い）</option>
              </select>

              <button type="button" className={styles.ghost} onClick={share}>
                <IconLink size={17} />
                設定を共有
              </button>

              <button type="button" className={styles.ghost} onClick={reset}>
                <IconReset size={17} />
                別の写真
              </button>
            </div>

            <p className={styles.meta}>
              {sizeLabel}
              {conversion.elapsedMs !== null && ` ・ 変換 ${conversion.elapsedMs}ms`}
            </p>
          </div>

          <aside className={styles.controls}>
            <ControlPanel params={params} onChange={patch} />
          </aside>
        </div>
      )}

      {/* 要素ごと差し込むと読み上げが発火しないことがあるため、器は常に置いておく */}
      <p className={styles.loading} role="status" data-visible={loading || undefined}>
        {loading ? "画像を読み込んでいます…" : ""}
      </p>
      <p className="srOnly" role="status">
        {liveMessage}
      </p>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Hero() {
  return (
    <div className={styles.hero}>
      {/* 意味のまとまりごとに分ける。語の途中で改行されると日本語として読みにくいため */}
      <h1 className={styles.title}>
        <span className={styles.phrase}>写真を、</span>
        <span className={styles.phrase}>
          <span className={styles.titleAccent}>ドット絵</span>と
        </span>
        <span className={styles.phrase}>
          <span className={styles.titleAccent}>手描き風</span>に。
        </span>
      </h1>
      {/*
        「登録不要・アップロードなし」は同種のツールでは当たり前になっており、
        それだけでは差にならない。端末内で動くことの実利（待たない・電波が要らない）を先に言う。
      */}
      <p className={styles.subtitle}>
        <span className={styles.phrase}>アップロードを待ちません。</span>
        <span className={styles.phrase}>設定を動かすとその場で変わります。</span>
        <span className={styles.phrase}>変換はすべて端末の中で行われるので、</span>
        <span className={styles.phrase}>写真が外に出ることはありません。</span>
      </p>
    </div>
  );
}
