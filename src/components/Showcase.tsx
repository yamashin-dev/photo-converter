import styles from "./Showcase.module.css";

/**
 * 写真を選ぶ前に読む部分。
 *
 * ドロップゾーンより「下」に置くのが要点。
 * 上に積むとファーストビューが重くなり、変換を始めるまでが遠くなる。
 */

const EXAMPLES = [
  {
    id: "island",
    style: "ドット絵",
    caption: "粗いドットと16色に落として、レトロゲームの画面のように",
    alt: {
      before: "海に浮かぶ緑の島を撮影した写真",
      after: "同じ写真を16色のドット絵に変換した例。ディザリングで空と海に細かな網目が出ている",
    },
  },
  {
    id: "cape",
    style: "手描き風",
    caption: "影を飛ばして色をまとめ、絵の具で塗ったような質感に",
    alt: {
      before: "岬から海を見下ろした写真。手前にススキが茂っている",
      after: "同じ写真を8色の手描き風イラストに変換した例。陰影が平らになり色面で構成されている",
    },
  },
  {
    id: "harbor",
    style: "ドット絵（くっきり）",
    caption: "決まった色だけで塗り直すと、写真が別の時間帯の絵になる",
    alt: {
      before: "夕暮れの漁港。街灯が水面に映っている写真",
      after: "同じ写真を夕焼けのパレットでドット絵に変換した例。紫からオレンジの階調に置き換わっている",
    },
  },
];

const FAQ = [
  {
    q: "無料ですか。登録は必要ですか。",
    a: "無料です。会員登録もアプリのインストールも必要ありません。回数制限も透かしもありません。",
  },
  {
    q: "写真はどこかに送信されますか。",
    a: "送信されません。変換はすべてお使いの端末の中で行われます。写真を送る仕組み自体がないため、サーバーに保存されることもありません。",
  },
  {
    q: "iPhoneで撮った写真（HEIC）は使えますか。",
    a: "使えます。HEIC・HEIFのほか、JPEG・PNG・GIF・WebPに対応しています。",
  },
  {
    q: "スマートフォンでも使えますか。",
    a: "使えます。ホーム画面に追加すればアプリのように起動でき、一度開いたあとは通信がなくても変換できます。",
  },
  {
    q: "作った画像は自由に使えますか。",
    a: "はい。商用・非商用を問わず自由にお使いいただけます。クレジット表記も不要です。ただし元の写真の権利にはご注意ください。",
  },
  {
    q: "大きな写真でも変換できますか。",
    a: "できます。長辺4096ピクセルまではそのまま処理し、それを超える場合は端末を守るため自動で縮小します。",
  },
];

export function Showcase() {
  return (
    <div className={styles.wrap}>
      <section className={styles.section} aria-labelledby="examples-heading">
        <h2 id="examples-heading" className={styles.heading}>
          こんなふうに変わります
        </h2>
        <p className={styles.lead}>
          写真の色を数えるところからやり直して、限られた色だけで塗り直しています。
          作例はいずれも制作者が撮影した写真です。
        </p>

        <div className={styles.examples}>
          {EXAMPLES.map((ex) => (
            <figure key={ex.id} className={styles.example}>
              <div className={styles.pair}>
                <div className={styles.shot}>
                  {/* 静的エクスポートのためnext/imageの最適化は使えない。WebP化と寸法指定は手動で行っている */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/examples/${ex.id}-before.webp`}
                    alt={ex.alt.before}
                    width={800}
                    height={534}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className={styles.tag}>元の写真</span>
                </div>
                <div className={styles.shot}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/examples/${ex.id}-after.webp`}
                    alt={ex.alt.after}
                    width={800}
                    height={534}
                    loading="lazy"
                    decoding="async"
                    className={styles.pixelated}
                  />
                  <span className={`${styles.tag} ${styles.tagAccent}`}>{ex.style}</span>
                </div>
              </div>
              <figcaption className={styles.caption}>{ex.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="steps-heading">
        <h2 id="steps-heading" className={styles.heading}>
          使い方
        </h2>
        <ol className={styles.steps}>
          <li>
            <b>写真を選ぶ</b>
            ドラッグ＆ドロップ、貼り付け、ファイル選択のどれでも。スマートフォンなら共有メニューからも送れます。
          </li>
          <li>
            <b>仕上がりを選ぶ</b>
            「レトロゲーム」「手描き風」などから選ぶだけ。変えるとその場で見た目が変わります。
          </li>
          <li>
            <b>保存する</b>
            PNGかWebPで書き出せます。気に入った設定はリンクとして共有できます。
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="settings-heading">
        <h2 id="settings-heading" className={styles.heading}>
          設定の意味
        </h2>
        <dl className={styles.glossary}>
          <div>
            <dt>ドットの粗さ</dt>
            <dd>
              いくつの点で1枚を描くかです。数字が大きいほど点が大きくなり、絵は大胆になります。
              顔を残したいときは小さめ、記号的にしたいときは大きめが向きます。
            </dd>
          </div>
          <div>
            <dt>色数</dt>
            <dd>
              使う色を何色まで許すかです。少ないほどイラストらしくなり、多いほど写真に近づきます。
              8〜16色がドット絵らしさと分かりやすさの境目です。
            </dd>
          </div>
          <div>
            <dt>色づかい</dt>
            <dd>
              写真から色を選び出すか、決まった色だけで塗るかを選べます。
              決まった色を選ぶと、写真の時間帯や季節ごと変わったような絵になります。
            </dd>
          </div>
          <div>
            <dt>ディザリング</dt>
            <dd>
              少ない色数でも階調を出すための点描です。誤差拡散はなめらかに、
              パターン系は規則正しい網目になり、レトロゲームらしい質感が出ます。9種類から選べます。
            </dd>
          </div>
          <div>
            <dt>輪郭線</dt>
            <dd>
              被写体の境目に線を足します。やわらかい線は控えめに、はっきりした線はアニメ調に近づきます。
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="faq-heading">
        <h2 id="faq-heading" className={styles.heading}>
          よくある質問
        </h2>
        <dl className={styles.faq}>
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** 検索エンジンとAIに、上のFAQと同じ内容を機械可読な形でも渡す */
export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};
