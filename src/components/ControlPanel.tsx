"use client";

import { useId, useState } from "react";
import styles from "./ControlPanel.module.css";
import type { ConversionParams } from "@/engine/types";
import {
  COLOR_COUNTS,
  DITHERING_GROUPS,
  EXTRACT_OPTIONS,
  matchPreset,
  OUTLINE_OPTIONS,
  PALETTE_OPTIONS,
  PIXEL_SIZES,
  PRESETS,
  STYLE_OPTIONS,
} from "@/lib/params";
import { IconChevron } from "./Icon";

export function ControlPanel({
  params,
  onChange,
}: {
  params: ConversionParams;
  onChange: (patch: Partial<ConversionParams>) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const id = useId();
  const isIllustration = params.style === "illustration";

  const activePreset = matchPreset(params);

  return (
    <div className={styles.panel}>
      {/* 0. プリセット: 設定を理解しなくても、ここだけで仕上がりが決まる */}
      <section className={styles.section}>
        <h3 className={styles.legend}>まずは選ぶだけ</h3>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.preset} ${activePreset === p.id ? styles.presetOn : ""}`}
              onClick={() => onChange(p.params)}
              aria-pressed={activePreset === p.id}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {activePreset
            ? PRESETS.find((p) => p.id === activePreset)?.hint
            : "下の項目を変えると、自分好みに調整できます"}
        </p>
      </section>

      <hr className="dottedRule" />

      {/* 1. スタイル: 最初の一手。ここだけで完結する人が多いので大きく置く */}
      <section className={styles.section}>
        <h3 className={styles.legend}>スタイル</h3>
        <div className={styles.styleList} role="radiogroup" aria-label="変換スタイル">
          {STYLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={params.style === o.value}
              className={`${styles.styleCard} ${params.style === o.value ? styles.styleOn : ""}`}
              onClick={() => onChange({ style: o.value })}
            >
              <span className={styles.styleName}>{o.label}</span>
              <span className={styles.styleHint}>{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <hr className="dottedRule" />

      {/* 2. 基本: ドットの粗さと色数 */}
      <section className={styles.section}>
        <h3 className={styles.legend}>基本</h3>

        <div className={styles.field}>
          <span className={styles.label} id={`${id}-size`}>
            ドットの粗さ
          </span>
          <div className={styles.chips} role="group" aria-labelledby={`${id}-size`}>
            {PIXEL_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.chip} ${params.pixelSize === s ? styles.chipOn : ""}`}
                onClick={() => onChange({ pixelSize: s })}
                aria-pressed={params.pixelSize === s}
              >
                {s}
              </button>
            ))}
          </div>
          <p className={styles.hint}>数字が大きいほど粗いドットになります</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-palette`}>
            色づかい
          </label>
          <span className={styles.selectWrap}>
            <select
              id={`${id}-palette`}
              className={styles.select}
              value={params.paletteType}
              onChange={(e) =>
                onChange({ paletteType: e.target.value as ConversionParams["paletteType"] })
              }
            >
              {PALETTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </span>
        </div>

        {params.paletteType === "auto" && (
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-colors`}>
              色数
            </span>
            <div className={styles.chips} role="group" aria-labelledby={`${id}-colors`}>
              {COLOR_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.chip} ${params.numColors === n ? styles.chipOn : ""}`}
                  onClick={() => onChange({ numColors: n })}
                  aria-pressed={params.numColors === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <hr className="dottedRule" />

      {/* 3. 詳細: 初見では畳んでおく */}
      <section className={styles.section}>
        <button
          type="button"
          className={styles.disclosure}
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
        >
          <span className={styles.legend}>こだわる</span>
          <IconChevron
            size={18}
            className={`${styles.chevron} ${detailOpen ? styles.chevronOpen : ""}`}
          />
        </button>

        {detailOpen && (
          <div className={styles.detail}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-dither`}>
                ディザリング
              </label>
              <span className={styles.selectWrap}>
                <select
                  id={`${id}-dither`}
                  className={styles.select}
                  value={params.dithering}
                  onChange={(e) =>
                    onChange({ dithering: e.target.value as ConversionParams["dithering"] })
                  }
                >
                  {DITHERING_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </span>
              <p className={styles.hint}>少ない色数でも階調を出す点描のような処理です</p>
            </div>

            {params.paletteType === "auto" && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${id}-extract`}>
                  色の選び方
                </label>
                <span className={styles.selectWrap}>
                  <select
                    id={`${id}-extract`}
                    className={styles.select}
                    value={params.extractMethod}
                    onChange={(e) =>
                      onChange({ extractMethod: e.target.value as ConversionParams["extractMethod"] })
                    }
                  >
                    {EXTRACT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} — {o.hint}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-outline`}>
                輪郭線
              </label>
              <span className={styles.selectWrap}>
                <select
                  id={`${id}-outline`}
                  className={styles.select}
                  value={params.outline}
                  onChange={(e) =>
                    onChange({ outline: e.target.value as ConversionParams["outline"] })
                  }
                >
                  {OUTLINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-sat`}>
                鮮やかさ
                <output className={styles.value}>{params.saturation}%</output>
              </label>
              <input
                id={`${id}-sat`}
                type="range"
                min={0}
                max={200}
                step={5}
                value={params.saturation}
                className={styles.range}
                onChange={(e) => onChange({ saturation: Number(e.target.value) })}
              />
            </div>

            {isIllustration && (
              <>
                <Toggle
                  id={`${id}-contrast`}
                  label="コントラストを強める"
                  hint="ぼんやりした写真をはっきりさせます"
                  checked={params.enhanceContrast}
                  onChange={(v) => onChange({ enhanceContrast: v })}
                />
                <Toggle
                  id={`${id}-shadow`}
                  label="影を飛ばす"
                  hint="陰影を平らにしてイラストらしくします"
                  checked={params.removeShadow}
                  onChange={(v) => onChange({ removeShadow: v })}
                />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <label className={styles.toggleLabel} htmlFor={id}>
        <span>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
}
