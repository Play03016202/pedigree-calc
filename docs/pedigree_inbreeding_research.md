# 動物の近親交配対応家系図ソフトウェア（HTML製）— 設計に必要な知識 総合調査報告

> 調査日：2026-05-05  
> 対象：近交係数の自動計算・表示が可能な動物向け家系図 HTML アプリケーションの設計に必要な知識  
> 調査手法：学術文献データベース（arXiv, Semantic Scholar, CrossRef, OpenAlex 等）の一次情報検索

---

## 目次

1. [近交係数の計算アルゴリズム](#1-近交係数の計算アルゴリズム)
2. [関連する遺伝学的指標](#2-関連する遺伝学的指標)
3. [家系図のグラフ理論的構造](#3-家系図のグラフ理論的構造)
4. [既存の家系図ソフトウェア事例](#4-既存の家系図ソフトウェア事例)
5. [グラフレイアウトアルゴリズム](#5-グラフレイアウトアルゴリズム)
6. [グラフの視覚的知覚に関する研究](#6-グラフの視覚的知覚に関する研究)
7. [エッジの可視化技法](#7-エッジの可視化技法)
8. [Web UI / UX の設計知見](#8-web-ui--ux-の設計知見)
9. [動物育種の実務知識](#9-動物育種の実務知識)
10. [設計上の総合的な示唆](#10-設計上の総合的な示唆)
11. [出典一覧（大項目別）](#11-出典一覧大項目別)

---

## 1. 近交係数の計算アルゴリズム

### 1-1. Wright のパス係数法（Path Coefficient Method）

最も古典的かつ基盤となる手法。**近交係数 F** は「共通祖先を通る全パスの和」として定義される。

```
F(I) = Σ [ (1/2)^(n₁+n₂+1) × (1 + F(A)) ]
```

- `n₁`, `n₂` = 問題の個体から共通祖先 A までの各親を経由した世代数
- `F(A)` = 共通祖先 A 自身の近交係数（再帰的に計算する）
- Σ は個体 I の全共通祖先 A について和をとる

**実用上の問題点：**
- 近親交配が多い家系では共通祖先が多数いるため、全パスの列挙が指数的に増大する
- 共通祖先自身が近交している（`F(A) > 0`）場合、それを再帰的に計算しなければならない
- 大規模家系（100 個体以上）では計算量が爆発的に増大し、パスカウント法単独での実装は現実的でない

**JavaScript での基本実装方針：**
深さ優先探索（DFS）で共通祖先を列挙し、各パスの長さから `(1/2)^(n₁+n₂+1)` を計算して加算する。ただし後述の表形式法の方がはるかに効率的。

---

### 1-2. 表形式法（Tabular / Recursive Method）— 大規模家系に推奨

Henderson (1976) / Boyce (1983) らが確立した手法。**出生順（世代番号順）にソートした個体リストを一度走査**する再帰的手法で、大規模な家系データへの適用に最も効率的。現代の育種ソフトウェアの標準実装。

**算出ステップ（疑似コード）：**

```
// Step 1: 全個体を世代順（親が子より前）にソート
individuals.sort(by: generation_depth)

// Step 2: NRM（Numerator Relationship Matrix）を初期化
NRM = {}

// Step 3: 各個体の近交係数と血縁係数を逐次計算
for each individual i (in sorted order):
    s = sire of i   // 父
    d = dam of i    // 母

    if s == null and d == null:
        F(i) = 0
        NRM[i][i] = 1
    else if s == null:
        F(i) = 0
        NRM[i][i] = 1
    else:
        F(i) = 0.5 * NRM[s][d]       // 父と母の血縁係数の半分
        NRM[i][i] = 1 + F(i)         // 対角要素

    for each earlier individual j:
        sj = sire of j
        dj = dam of j
        NRM[i][j] = NRM[j][i] = 0.5 * (NRM[j][s] + NRM[j][d])
```

**計算量：** O(n²)（n = 個体数）。空間効率のため必要なペアのみを計算するオンデマンド方式も可能。

**重要な特性：**
- NRM の対角要素 `NRM[i][i] = 1 + F(i)`
- NRM の非対角要素 `NRM[i][j]` = 個体 i と j の **相加的血縁係数（additive kinship coefficient）**
- 近交係数は `F(i) = NRM[s][d] / 2`（父 s と母 d が同一の場合 F(i) = 0.5 × 1 = 0.5 となりうる）

---

### 1-3. グラフ理論を用いた計算

Maruyama & Yasuda (1970) はグラフ理論的観点から血縁係数と近交係数の計算を定式化した先駆的研究。家系図を有向グラフとして扱い、行列演算でまとめて計算する枠組みを提示。

**Jarne et al. (2020)** はこの考え方を実装に落とし込み、Python のオープンソースコード（GitHub 公開）で：
- 近親交配ツリーのグラフ生成
- **隣接行列（Adjacency Matrix）** の算出
- リンクヒストグラムの生成
- 複数ツリー実現例の平均・接続性分布の計算

を実現している。JavaScript への移植の参考として有用。

---

### 1-4. 再帰的手法による動的な育種プログラムへの適用

Sitzenstock et al. (2012) は「動的で複雑な育種プログラム」においても機能する再帰的手法を提案した。育種プログラムをコホート（年齢・性別グループ）に分類し、コホート間の血縁係数を再帰的に推移させる **遺伝子フロー法（gene-flow method）** を採用。以下の動的シナリオへの対応を示した：
- 集団サイズの指数的増加
- ボトルネック状況

**UIへの示唆：** 「将来世代の F 値の期待値を予測・可視化する」機能に応用できる。

---

### 1-5. 近交係数の分解：Wright の近位分解法

Colleau & Sargolzaei (2008) は Wright の血縁係数分解法を解説。集団の平均血縁係数や平均近交係数を **直接的に責任ある祖先の寄与に分解** する手法（近位分解）を提案。カバロ&トロ法（Caballero & Toro 2000）との比較も示され、育種スキームの効率評価に有用。

---

## 2. 関連する遺伝学的指標

単純な F 値の表示に加え、実際の育種管理に有用な複合指標を示す。

### 2-1. 主要指標一覧

| 指標 | 定義 | 実用的意味 | ソフトウェアでの活用 |
|------|------|-----------|-----------------|
| **F（個体近交係数）** | 同一祖先から両アレルが遺伝する確率 | 個体の遺伝的問題リスク | ノード上に数値・色で表示 |
| **a（相加的血縁係数）** | 2 個体間の遺伝的近縁度 | 交配候補ペア選定 | 交配シミュレーション画面で表示 |
| **ΔF（世代当たり近交増加率）** | 世代間の F 値の変化量 | 繁殖計画立案・警告 | トレンドグラフで表示 |
| **Ne（有効集団サイズ）** | `Ne = 1/(2ΔF)` から逆算 | 集団全体の遺伝的健全性 | Ne < 50 で危険警告を出す |
| **fe（創始者有効数）** | 創始者が均等に貢献する場合の等価個体数 | 遺伝多様性の喪失度合い | 集団統計ビューで表示 |
| **ECG（等価完全世代数）** | 家系情報の完全性の加重平均 | F 計算精度の信頼性指標 | 「この計算は○世代分のデータに基づく」と表示 |

**计算式 (ΔF と Ne)：**
```
ΔF = (F_t - F_{t-1}) / (1 - F_{t-1})
Ne = 1 / (2 × ΔF)
```

---

### 2-2. ROH（Runs of Homozygosity）との補完関係

ROH はゲノムデータから算出される近交係数の代替指標で、ペディグリーベースの F 値より精度が高いとされる。家系図ソフトウェアには不要だが、概念として知っておくと設計の深みが増す。

**ROH の長さと近交の「古さ」の対応：**
```
短い ROH（< 6 Mb）  → 遠い祖先由来（古い近交）
中程度（6–12 Mb）   → 中間的
長い ROH（> 12 Mb） → 近い祖先由来（最近の近交）
```

**近交弱勢（Inbreeding Depression）は長い ROH で顕著**（有害劣性が発現しやすい）。

**UIへの示唆：** 計算した F 値に「この近交は主に○世代前の祖先による」という世代寄与情報を付加表示することで育種判断が向上する。Colleau & Sargolzaei (2008) の近位分解法を応用して実装可能。

---

### 2-3. 近交弱勢の実際（動物の健康への影響）

育種実務者にとって近交係数が高いことの具体的リスクを表示することで、ソフトウェアの価値が上がる：

- **免疫機能低下**
- **繁殖能力・生存率の低下**
- **先天性疾患の発現率増加**（劣性有害アレルのホモ接合化）
- **体格・発育の低下**

Michels & Distl (2022) の Deutsch Drahthaar の研究では、犬集団の平均 F = 4.2% で、祖先近交（ancestral inbreeding）が増加傾向にあることを報告。

---

## 3. 家系図のグラフ理論的構造

### 3-1. 家系図の数学的定義

通常の家系図は **有向非循環グラフ（DAG：Directed Acyclic Graph）** として表現できる：
- **ノード**：個体
- **有向エッジ**：親→子の関係

近親交配がある場合でも時間の流れ（祖先→子孫）が逆転することはないため、DAG 性は保たれる。ただし：

- **1 つのノードが複数の親エッジを持つ**（通常の家系図では父1＋母1 = 2本）
- **同一個体が複数経路の共通祖先として機能する**（これが近交の本質）
- エッジが複数世代をまたぐ **long edges** が生じる

### 3-2. 近親交配がグラフ構造に与える影響

| 交配タイプ | グラフへの影響 |
|-----------|-------------|
| 兄妹交配 | 共通の祖父母から 4 本のパスが子孫に到達 |
| 半兄妹交配 | 共通祖先が片親のみ（処理が複雑）|
| 叔母甥交配 | 世代をまたぐ long edge が生じる |
| 重複交配 | 同一個体が複数世代で祖先として現れる |
| いとこ交配 | 共通祖父母 1 組、パス数 4 本（最も一般的な近交） |

### 3-3. 「ノード複製」vs「単一ノード＋複数エッジ」問題

近親交配家系図の可視化における最大の設計課題：

| 設計方針 | 長所 | 短所 |
|----------|------|------|
| **ノード複製（同一個体を複数箇所に描く）** | ツリーに近い構造になりレイアウトが整う | 同一個体が複数箇所に出現し混乱しやすい；整合性管理が複雑 |
| **単一ノード＋複数エッジ** | データ重複なく正確；整合性が保ちやすい | エッジのクロスが多発し視覚が複雑になる |

**推奨設計：** デフォルトは単一ノード＋複数エッジ。ユーザーが「ノード展開モード」に切り替えられるUIを提供する。近交を形成するエッジは色・線種で区別表示する。

### 3-4. 半兄妹関係への対応

He et al. (2014) *IPED2* は、半兄妹が存在する複雑な家系でもペディグリー再構成が可能なアルゴリズムを提案。半兄妹の存在が問題を「質的に難しくする」ことを示した（NP困難性との関係）。

実用上は、**片親不明（未登録）の個体** が家系図に含まれる場合への対処として参考になる。

---

## 4. 既存の家系図ソフトウェア事例

### 4-1. PedigreeOnline（2021）

- **実装：** HTML5 Canvas、Webブラウザ上で動作
- **主な特徴：**
  - PLL（Pedigree-Like-Layout）という独自データフォーマットを開発
  - Linkage 形式 / CSV との互換性
  - グラフィカル UI ↔ テキストデータの**双方向リンク**（一方を編集すると他方に即時反映）
  - 家系データを視覚的に見ながら直接編集可能
- **設計の学び：** ユーザーがデータ形式を覚えなくてもグラフィカルに操作でき、かつテキスト編集も可能な双方向設計は操作効率を高める

**URL:** http://www.ig.zju.edu.cn/PedigreeOnline/（アクセス不能の可能性あり）

---

### 4-2. From pedigrees to practicality: an interactive tool for cat breeding（Talbot et al. 2026）

- **対象：** 猫ブリーダー向け実用ツール（最新論文、2026 年 2 月）
- **主な特徴：**
  - 世代をまたがった遺伝情報の追跡
  - 技術的障壁を下げ、日常的な繁殖管理をサポート
  - 近交係数の計算・表示がコア機能
  - 他種への拡張可能な設計
- **意義：** 本調査の目的（動物の近親交配対応家系図）に最も近い先行事例

---

### 4-3. ENDOG（既存デスクトップソフトウェア）

論文で多数言及される標準的なペディグリー解析ソフトウェア。以下の指標を計算する：
- ECG（等価完全世代数）
- F（近交係数）
- Ne（有効集団サイズ）
- fe, fa, fge（創始者関連指標）

HTML ツールを設計する際、ENDOG の計算結果と互換性を持たせることで、既存ユーザーの移行を容易にできる。

---

## 5. グラフレイアウトアルゴリズム

### 5-1. Sugiyama フレームワーク（最も広く使われる階層グラフレイアウト）

家系図に最適な **階層（hierarchical）レイアウト** の事実上の標準アルゴリズム。4 フェーズ構成：

```
Phase 1: サイクル除去（Cycle Removal）
  → 有向グラフにサイクルがある場合にエッジを逆転して除去

Phase 2: レイヤー割り当て（Layer Assignment）
  → 各ノードに世代番号（レイヤー）を割り当て
  → 家系図では「出生年代」または「世代番号」がそのままレイヤーになる

Phase 3: 頂点並べ替え（Vertex Ordering）
  → 各レイヤー内のノードの左右順を決定しエッジのクロスを最小化
  → バリセンター法（Barycenter Heuristic）や重み付きメジアン法が一般的

Phase 4: 座標割り当て（Coordinate Assignment）
  → 各ノードの X, Y 座標を計算（y はレイヤーで決まり、x を最適化）
```

**家系図における注意点：**
- 近親交配ノードは複数レイヤーに「属す可能性」があるため、どのレイヤーに配置するかのルールを決める必要がある（推奨：最初に生まれた世代のレイヤー）
- エッジが複数レイヤーをまたぐ long edges が生じる → ダミーノードを挿入してレイヤーを跨ぐ直線エッジとして処理するか、曲線エッジで描く

---

### 5-2. Ortali & Tollis の代替アルゴリズム（2018）

Sugiyama の代替として、**チャンネル分解（Channel Decomposition）** に基づく O(kn) のアルゴリズムを提案：
- ダミー頂点を一切導入しない
- 同一チャンネルの頂点を垂直に整列させる
- 到達可能性情報を完全に保持した描画が可能
- 通常の Sugiyama より視覚的に読みやすいケースがある

k（チャンネル数）は通常 n より十分小さいため高速。

---

### 5-3. 力指向レイアウト（Force-Directed Layout）との比較

家系図のような厳密な時系列・階層構造がある場合、力指向レイアウトは以下の理由で**推奨されない**：
- 世代の時間方向（上下）が保証されない
- 同じ世代のノードが同一水平ラインに並ぶ保証がない
- ユーザーが「誰が祖先で誰が子孫か」を直感的に理解できなくなる

**Kwon et al. (2017)** のグラフレイアウト選択の機械学習研究も参考になる — ユーザータスクに適したレイアウトを選択する重要性を示している。

---

### 5-4. DAG 比較のための形状強調レイアウト（Guckes et al. 2024）

Sugiyama を拡張した **shape-change enhancing layout** を提案：
- DAG 間の微小な差異を視覚的に際立たせる
- エッジクロス美観スコア平均 0.8（1.0 満点）を維持
- 既存手法より差異の視認性を **60〜75% 向上**

**家系図への応用：** 2 つの交配候補で生まれる仔の家系図を並べて比較する（juxtaposition）UI の設計に応用できる。

---

## 6. グラフの視覚的知覚に関する研究

### 6-1. DAG の視覚的類似性知覚（Ballweg et al. 2017）

20 人の参加者によるカードソート実験で、DAG の視覚的類似判断に影響する要因を実験的に特定した**最重要研究**。

**主な知見（重要度順）：**

| 知見 | 係数 | 家系図 UI への応用 |
|------|------|-----------------|
| **階層の深さ（depth / level 数）** | 最高 | 世代数を明確に示す水平グリッドを設ける |
| **各レベルのノード数** | 高 | 世代ごとのノード配置を均一化して視認性を高める |
| **全体のシェイプ（輪郭・形状）** | 高 | 近親交配でツリーが歪む場合に整形補助オプションを提供 |
| **左右への傾き（visual leaning）** | 中〜高 | 家系図の向きを上＝古い世代に統一し左右の非対称さを最小化 |
| **エッジの交差（edge crossing）** | 予想外に低 | ノードの整列を最優先し、エッジクロス最小化は二次的に扱う |

> **重要な引用：**  
> 「Interestingly, edges and edge crossings — important factors of graph theory and graph aesthetics — seem not to matter to the participants.」（Ballweg et al. 2017, p. 7）

この研究は「エッジクロスを減らすことに過度に注力するよりも、ノードの整列・階層の明確さに集中すべき」という設計方針を支持する。

---

### 6-2. 空間レイアウトが社会ネットワーク知覚に与える影響

Huang, Hong & Eades (2006) は、ノードの空間配置がソシオグラムの読解に強く影響することを示した（readability だけでは不十分であり、**空間的な整理** が理解を左右する）。

**家系図への応用：**
- 同世代のノードは同一水平ラインに揃える（y 座標の厳密な揃え）
- 左右方向は血縁関係の「近さ」を反映させる（関係が近い個体を隣接配置）

---

### 6-3. インタラクションが複雑なグラフの理解を補う

Federico & Miksch (2016) は動的グラフのインタラクション技法を実験的に評価：
- **隣接ノードのハイライト** は多くのグラフタスクで **精度向上** を確認（時間コストは増加することがある）
- **レイアウト安定化** の調整は複雑なタスクで隣接ハイライトと同等の効果
- インタラクションなしでは複雑グラフの読解精度が著しく低下

**家系図への応用：**
- ノードをクリックすると、そのノードに関係する全エッジ・祖先・子孫がハイライトされるインタラクションは**必須**
- ハイライトなしの大規模近親交配家系図はほぼ読めない

---

## 7. エッジの可視化技法

### 7-1. Edge-Path Bundling（Wallinger et al. 2021）

エッジバンドリングはエッジが多いグラフの視覚的混雑を低減する重要な技法。Wallinger et al. が提案した **Edge-Path Bundling** の主な特徴：

- **直線からの逸脱を最小化**しながらバンドリング（意味のない湾曲を避ける）
- **あいまいな接続（ambiguity）を従来手法より大幅に削減**（バンドリングによる「どのエッジがどのノードに繋がるか不明」問題を軽減）
- 有向エッジのバンドリングが自然に実現できる
- バンドリング強度を Euclidean 距離・Shortest path 距離などのパラメータで調整可能

**実用上の注意：**
- バンドリングは情報の損失を伴うため、**インタラクティブなハイライトと必ず組み合わせる**（ホバー時に個別エッジを強調表示）
- 家系図では親子関係の明確さが最優先のため、バンドリングは「祖先への遠距離エッジ」など特定のエッジにのみ適用することを推奨

---

### 7-2. MLSEB — 高品質エッジバンドリング（Wu et al. 2017）

MLS（Moving Least Squares）近似に基づくエッジバンドリング手法。定量指標で既存手法より高品質なバンドルを生成し、大規模グラフへのスケーラビリティも持つ。ライブラリ実装の参考として有用。

---

### 7-3. エッジクロスの解消技法

エッジクロスの完全な最小化は NP 困難（Bannister & Eppstein 2014）だが、以下のヒューリスティックが使える：

- **Crossing Resolution の最大化**（クロスする角度を大きくする）— 大角度クロスは視認性が高い（Bekos et al. 2018）
- Sugiyama Phase 3 のバリセンター法ヒューリスティックで近似解を求める
- 家系図の特性として「近親交配エッジ（共通祖先からの複数エッジ）」は構造的にクロスが避けられないため、それ自体を色・線種で明示的に強調する方が有効

---

### 7-4. 近親交配エッジの特別な扱い

近交を形成するエッジ（ループバックエッジ、共通祖先への複数接続）を通常エッジと区別する表示：

| 表示方法 | 説明 |
|----------|------|
| **色分け** | 通常エッジ=グレー、近交エッジ=赤・橙系 |
| **線種** | 通常=実線、近交=破線・点線 |
| **太さ** | 近交係数の寄与率に応じてエッジの太さを変える |
| **曲線** | 近交エッジを曲線（ベジェ曲線）で表し直線の通常エッジと区別 |

---

## 8. Web UI / UX の設計知見

### 8-1. 視覚変数と近交係数の色彩表示

近交係数という**連続値**を視覚化するための視覚変数の選択（Munzner 2014 の原則に基づく）：

| 視覚変数 | 近交係数への適用方法 | 注意点 |
|----------|-------------------|--------|
| **色相（Hue）のグラデーション** | 低→高 = 緑→黄→赤 | 色弱者に配慮し色相単独は避ける |
| **彩度（Saturation）** | 無彩（低近交）→ 有彩（高近交） | 単独で使うと差が見えにくい |
| **ノードの枠線の太さ** | 閾値超えで太枠、正常で細枠 | 色弱者への対応に有効 |
| **数値ラベル** | ノード内または隣接に F=0.125 形式で表示 | 最も確実；必須実装 |
| **円形プログレスバー** | ノード内部に F 値をリング状に表示 | 視覚的に直感的 |

**色弱対応（重要）：**
- 赤緑の単純グラデーションは避ける
- Blue–Orange またはシーケンシャルカラー（例：YlOrRd from ColorBrewer）を使用
- 色だけでなく形状・ラベルでも情報を提供する

---

### 8-2. 近交係数の閾値と警告表示

育種実務の観点から、以下の閾値に基づく視覚的フィードバックが有用（Leroy 2011 等の実務文献に基づく）：

```
F < 0.0625（6.25%）：許容範囲（いとこ交配相当以下）
F = 0.0625（6.25%）：一般的な警告ライン（いとこ交配相当）
F = 0.125（12.5%）： 高リスク（半兄妹交配相当）
F > 0.25（25%）：   非常に高リスク（兄妹交配相当）
F = 0.5（50%）：    最大理論値（自家受精に相当、実際には不可能）
```

---

### 8-3. 推奨インタラクションパターン

| パターン | 具体的実装 | 根拠 |
|---------|-----------|------|
| **Detail-on-demand（ホバー表示）** | ノードホバーでツールチップに個体情報・F 値・全共通祖先経路を表示 | 認知負荷の分散 |
| **隣接ハイライト（クリック）** | クリックしたノードの全祖先・子孫・共通祖先を色変化でハイライト | Federico & Miksch (2016) が精度向上を実証 |
| **ズーム & パン** | ピンチ/スクロールで自由なズーム、ドラッグでパン | 大規模グラフの探索に必須 |
| **世代フィルタースライダー** | 表示世代数を n 世代以内に制限するスライダー | 視覚的複雑さをユーザーが制御可能 |
| **ノード検索 & フォーカス** | 名前検索 → 該当ノードに画面が移動してハイライト | 大家系での目的個体の発見 |
| **レイアウト切り替え** | 「標準ツリー / 近親交配強調 / コンパクト」モード | 用途に応じた最適表示 |
| **交配シミュレーション** | オス・メスを選択 → 仮の産仔の F 値をリアルタイム計算・表示 | 育種判断の核心機能 |
| **家系寄与パス表示** | F 値が高い個体のノードをクリック → 近交を生じさせた共通祖先とパスをハイライト | Wright パス法の視覚化 |

---

### 8-4. 双方向インタラクション設計（PedigreeOnline から）

PedigreeOnline の設計から学べる双方向インタラクションの重要性：
- グラフィカル UI での操作がリアルタイムにテキストデータ（CSV等）に反映される
- テキストデータの編集がグラフィカル表示に即時反映される
- これにより「目でツリーを確認しながらデータを入力する」ワークフローが自然になる

---

### 8-5. 「階層の明確さ」優先の UI 設計原則

Ballweg et al. (2017) の知覚研究と Huang et al. (2006) の空間配置研究を統合すると、以下の設計原則が導かれる：

1. **世代ラインを明確な水平グリッドで示す**（最優先）
2. **同世代ノードの y 座標を厳密に揃える**（視覚的な世代の明確さ）
3. **全体の「シェイプ」（輪郭形状）を対称的に保つ努力をする**
4. エッジクロスはある程度許容し、それよりノードの整列を優先する
5. 左右への非対称な偏り（leaning）を最小化するか、明確な意味（例：父系=左、母系=右）を付与する

---

### 8-6. 大規模グラフの段階的表示（Progressive Disclosure）

近親交配の多い家系図は情報が密集するため、段階的な情報開示が有効：

```
Level 0（初期表示）：
  - 対象個体を中心に直系3世代のみ表示
  - 近交係数のハイライトなし（全体把握）

Level 1（展開操作後）：
  - 全世代を表示
  - 近交係数の色表示を有効化

Level 2（個体クリック後）：
  - 全祖先・子孫のハイライト
  - 近交パスの強調表示
  - 詳細情報パネルの表示
```

---

## 9. 動物育種の実務知識

### 9-1. 犬の品種管理での実用数値と指標

Leroy (2011) の包括的レビュー（引用 111 回）から：

- ほとんどの近代犬種は閉鎖集団（closed pedigree population）で管理される
- ブリーダーは **平均近交係数** と **有効集団サイズ Ne** を主要指標として使用
- Ne < 50 は危険水域（FAO の家畜遺伝資源保全ガイドライン）
- 多くの犬種で **Fe（有効創始者数）が実際の創始者数より大幅に少ない**（一部の人気種雄による遺伝多様性の喪失）

---

### 9-2. 実際の家系図データの統計的特徴

複数の研究から明らかになった実際の家系データの特徴：

| 品種 | 平均 F | 特記事項 | 出典 |
|------|--------|---------|------|
| Deutsch Drahthaar（犬） | 4.2% | 新規近交が減少傾向、祖先近交が増加 | Michels & Distl 2022 |
| Australian Cattle Dog（犬、イタリア系統） | 5.1% | 77% の近交個体で F < 10% | Ciccarelli et al. 2021 |
| Bullmastiff（犬） | 4.7% | ROH（ゲノム）では 3.5% | Mortlock et al. 2016 |
| Agu pig（沖縄固有種豚） | ピーク 10.5%（2015 年）| Ne = 14.6（危険水域）| Touma et al. 2025 |
| Icelandic Sheepdog（犬） | - | 等価創始者わずか 2.2 頭分の多様性 | Oliehoek et al. 2009 |

---

### 9-3. ブリーダーが必要とするソフトウェア機能（実務視点）

実際の品種管理論文（特に Michels & Distl 2022、Touma et al. 2025 等）から逆引きした機能要件：

**個体レベル（必須）：**
- 個体の F 値の表示
- F 値の計算に使用した世代数・ECG の表示
- 近交を生じさせた共通祖先の特定と表示
- 交配候補との仮の産仔の F 値の事前計算（交配シミュレーション）

**集団レベル（強く推奨）：**
- 集団全体の平均 F・分布ヒストグラム
- 世代ごとの平均 F のトレンドグラフ
- 有効集団サイズ Ne の推定と警告
- 最も影響力の大きい祖先（遺伝的多様性に対する影響が大きい個体）のランキング

---

### 9-4. 家系の完全性（Pedigree Completeness）と計算精度

F 値の精度は家系情報の完全性に強く依存する。完全性の指標として ECG を使用：

```
ECG（等価完全世代数）= Σ (既知祖先の寄与 × 世代深さの重み)
```

ECG が低い（例：ECG < 3）場合、F 値の計算精度が低いことをユーザーに明示する UI が必要。

**実装例：**
```
「この個体の F 値: 8.3%
 （計算に使用した平均世代数: 4.2 世代 / ECG: 3.8）
 ※ 古い世代の情報が不完全なため、実際の F 値はこれより高い可能性があります」
```

---

## 10. 設計上の総合的な示唆

### 10-1. データ構造（JavaScript 実装案）

```javascript
// 個体データ
const Individual = {
  id: "string (UUID)",
  name: "string",
  sex: "M" | "F" | "U",
  birthDate: "Date | null",
  sireId: "string | null",   // 父
  damId: "string | null",    // 母
  // 自動計算フィールド
  F: "number",               // 近交係数
  ECG: "number",             // 等価完全世代数
  generationDepth: "number", // 世代番号（ソート用）
  // メタデータ
  registrationNo: "string",
  breed: "string",
  notes: "string"
};

// NRM キャッシュ（血縁係数行列）
const NRM = new Map(); // "id1:id2" → number
```

---

### 10-2. 近交係数計算の実装フロー

```
1. 全個体を世代番号（generationDepth）でソート
   - generationDepth = max(depth(sire), depth(dam)) + 1
   - 創始者（親不明）は depth = 0

2. ソート順に NRM を構築（表形式法）
   for each individual i (sorted):
     F(i) = 0.5 × NRM[sire(i)][dam(i)]    // 父と母の血縁係数の半分
     NRM[i][i] = 1 + F(i)
     for each previous individual j:
       NRM[i][j] = NRM[j][i] = 0.5 × (NRM[j][sire(i)] + NRM[j][dam(i)])

3. 交配シミュレーション
   予定産仔の F = 0.5 × NRM[候補オス][候補メス]

4. ECG の計算
   各個体について、既知祖先の割合を世代ごとに集計し加重平均
```

---

### 10-3. レンダリング技術の選択

| 技術 | 推奨用途 | 長所 | 短所 |
|------|---------|------|------|
| **Canvas 2D** | 50 個体以上の大規模家系 | 高速描画、ズーム制御が容易 | DOM の恩恵なし（ヒットテスト等を自前実装） |
| **SVG** | 中規模（～100 個体程度） | DOM 操作が容易、CSS アニメーション可 | 大規模で描画が遅くなる |
| **WebGL / Three.js** | 非常に大規模（1000+個体）| 最高速 | 実装が複雑 |
| **D3.js** | 中〜大規模（カスタム描画） | 豊富なグラフレイアウト機能 | 学習コストが高い |

**推奨：** 中規模ユースケースなら **SVG + D3.js**、大規模なら **Canvas 2D** 上にカスタム実装。

---

### 10-4. 視覚化の優先度ロードマップ

```
Phase 1（最低限の実用性）:
  ✓ 階層型家系図の基本表示（上=古い世代、下=新しい世代）
  ✓ 個体の F 値の計算と数値表示
  ✓ ノードの色による F 値の視覚化（緑→黄→赤グラデーション）
  ✓ 個体の追加・編集・削除
  ✓ CSV インポート/エクスポート

Phase 2（実用的な育種管理）:
  ✓ ノードホバー → ツールチップで詳細表示
  ✓ ノードクリック → 祖先・子孫のハイライト
  ✓ 交配シミュレーション（産仔の F 値予測）
  ✓ 世代フィルタースライダー
  ✓ 近交を形成するエッジの視覚的強調

Phase 3（高度な分析機能）:
  ✓ 集団統計ダッシュボード（平均 F、Ne、分布）
  ✓ 近交パスの可視化（共通祖先とパスのハイライト）
  ✓ 世代トレンドグラフ
  ✓ 家系の完全性（ECG）表示
  ✓ 最影響祖先ランキング
```

---

## 11. 出典一覧（大項目別）

---

### A. 近交係数の計算アルゴリズム

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Stevens, A. (1975). *An elementary computer algorithm for the calculation of the coefficient of inbreeding.* Information Processing Letters, 3(5), 153–163. | https://doi.org/10.1016/0020-0190(75)90030-7 | コンピュータで実装するための基礎アルゴリズム。パス係数法の計算機実装の先駆。 |
| Boucher, W. (1988). *Calculation of the inbreeding coefficient.* Journal of Mathematical Biology, 26(1), 57–64. | https://doi.org/10.1007/bf00280172 | 近交係数の数学的計算手法の整理。PDF あり。 |
| Boyce, A. J. (1983). *Computation of inbreeding and kinship coefficients on extended pedigrees.* Journal of Heredity, 74(6), 400–404. | https://doi.org/10.1093/oxfordjournals.jhered.a109825 | 引用 68 回。表形式法の拡張家系への適用。実装の標準参照文献。 |
| Backus, V. & Gilpin, M. (2002). *An Efficient Algorithm for the Additive Kinship Matrix.* Journal of Heredity, 93(6), 453–456. | https://doi.org/10.1093/jhered/93.6.453 | NRM（相加的血縁行列）計算の効率化。PDF あり。 |
| Maruyama, T. & Yasuda, N. (1970). *Use of Graph Theory in Computation of Inbreeding and Kinship Coefficients.* Biometrics, 26(2), 209. | https://doi.org/10.2307/2529069 | 引用 8 回。グラフ理論を血縁係数計算に適用した先駆的研究。 |
| Sitzenstock, F. et al. (2012). *A recursive method for computing expected kinship and inbreeding in complex and dynamic breeding programmes.* Journal of Animal Breeding and Genetics, 130(1), 55–63. | https://doi.org/10.1111/j.1439-0388.2012.01010.x | 引用 4 回。動的育種プログラムへの再帰的手法の適用。 |
| Colleau, J.-J. & Sargolzaei, M. (2008). *A proximal decomposition of inbreeding, coancestry and contributions.* Genetics Research, 90(1). | https://doi.org/10.1017/s0016672307009202 | 引用 22 回。Wright 法による血縁・近交の近位分解。祖先ごとの寄与分解の詳細アルゴリズム。PDF あり。 |
| Jarne, C. et al. (2020). *An algorithm to represent inbreeding trees.* Physica A, 564, 125894. | https://doi.org/10.1016/j.physa.2021.125894 | 近親交配ツリーの生成・可視化 Python コードを GitHub 公開。arXiv: 2009.11121 |
| Shikata, M. (1966). *Transformation of generalized inbreeding coefficient in components of pedigree.* Journal of Theoretical Biology, 10(1), 11–14. | https://doi.org/10.1016/0022-5193(66)90175-5 | 引用 7 回。一般化近交係数の家系成分への分解。 |
| Oikawa, T. et al. (2000). *Approximated Variance of Inbreeding Coefficient due to Multiple Paths in a Pedigree.* Nihon Chikusan Gakkaiho, 71(4), 348–352. | https://doi.org/10.2508/chikusan.71.348 | 引用 2 回。家系内の複数パスによる近交係数の分散近似。 |

---

### B. 遺伝的多様性・育種管理

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Leroy, G. (2011). *Genetic diversity, inbreeding and breeding practices in dogs: Results from pedigree analyses.* The Veterinary Journal, 189(2), 177–182. | https://doi.org/10.1016/j.tvjl.2011.06.016 | 引用 111 回。犬全般の近親交配とペディグリー分析の包括的レビュー。 |
| Michels, P. W. & Distl, O. (2022). *Genetic Diversity and Trends of Ancestral and New Inbreeding in Deutsch Drahthaar.* Animals, 12(7), 929. | https://doi.org/10.3390/ani12070929 | 引用 8 回。犬集団における全指標の実例計算と解釈。 |
| Ciccarelli, J. et al. (2021). *A genealogical survey on the main bloodline of the Australian Cattle Dog in Italy.* Rendiconti Lincei, 32, 505–514. | https://doi.org/10.1007/s12210-021-00993-3 | 引用 3 回。1722 頭の犬の系統分析。近交係数の分布の実例。PDF あり。 |
| Touma, S. et al. (2025). *Assessment of genetic diversity and inbreeding in the Okinawa indigenous Agu pig through pedigree analysis.* Animal Bioscience, 38(6), 1105–1115. | https://doi.org/10.5713/ab.24.0646 | 引用 1 回。ENDOG 使用の実例。ECG、F、Ne、fe 等の全指標を計算。PDF あり。 |
| Oliehoek, P. et al. (2009). *History and structure of the closed pedigreed population of Icelandic Sheepdogs.* Genetics, Selection, Evolution, 41, 39. | https://doi.org/10.1186/1297-9686-41-39 | 引用 23 回。閉鎖血統集団の遺伝多様性。クラスター分析の活用例。PDF あり。 |
| Mortlock, S. et al. (2016). *Comparative Analysis of Genome Diversity in Bullmastiff Dogs.* PLOS ONE, 11(1), e0147941. | https://doi.org/10.1371/journal.pone.0147941 | 引用 32 回。ペディグリー F 値とゲノム ROH の比較分析。PDF あり。 |
| Meuwissen, T. H. E. et al. (2020). *Management of Genetic Diversity in the Era of Genomics.* Frontiers in Genetics, 11, 880. | https://doi.org/10.3389/fgene.2020.00880 | 引用 122 回。ゲノム時代の遺伝的多様性管理の包括的レビュー。 |

---

### C. ROH（Runs of Homozygosity）と近交弱勢

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Curik, I. et al. (2014). *Inbreeding and runs of homozygosity: A possible solution to an old problem.* Livestock Science, 166, 26–34. | https://doi.org/10.1016/j.livsci.2014.05.034 | 引用 318 回。ROH とペディグリー F 値の比較の標準的レビュー。 |
| Sumreddee, P. et al. (2020). *Runs of homozygosity and analysis of inbreeding depression.* Journal of Animal Science, 98(12). | https://doi.org/10.1093/jas/skaa361 | 引用 20 回。ROH の長さ分類と近交弱勢の詳細な関係分析。PDF あり。 |
| Meyermans, R. et al. (2020). *How to study runs of homozygosity using PLINK?* BMC Genomics, 21, 94. | https://doi.org/10.1186/s12864-020-6463-x | 引用 379 回。ROH 解析の実践ガイド。パラメータ設定の重要性を示す。PDF あり。 |
| Pilon, B. et al. (2021). *Inbreeding Calculated with Runs of Homozygosity Suggests Chromosome-Specific Inbreeding Depression Regions.* Animals, 11(11), 3105. | https://doi.org/10.3390/ani11113105 | 引用 8 回。染色体別 ROH と近交弱勢の関係。 |

---

### D. 家系図ソフトウェア（既存事例）

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Talbot, S. R. et al. (2026). *From pedigrees to practicality: an interactive tool for cat breeding.* Frontiers in Veterinary Science, 2026:1749164. | https://doi.org/10.3389/fvets.2026.1749164 | 猫ブリーダー向け実用インタラクティブツール。本研究目的に最も近い先行事例。PDF あり。 |
| PedigreeOnline (2021). *Pedigree online: A New Web Server for Two-Way Interactive Pedigree Drawing.* Journal of Genetic Engineering and Biotechnology Research, 3(2). | https://doi.org/10.33140/igebr.03.02.08 | HTML5 Canvas ベースの双方向ウェブペディグリーツール。PLL フォーマット・Linkage/CSV 互換。PDF あり。 |
| He, D. et al. (2014). *IPED2: Inheritance Path based Pedigree Reconstruction Algorithm for Complicated Pedigrees.* arXiv:1408.5530. | https://arxiv.org/abs/1408.5530v1 | 半兄妹を含む複雑な家系の再構成アルゴリズム。家系グラフの構造上の困難を示す。 |
| Kirkpatrick, B. et al. (2011). *Comparing Pedigree Graphs.* | https://arxiv.org/abs/1009.0909v2 | 家系図の同型性判定・編集距離アルゴリズム。ペディグリー同型問題が一般グラフ同型と同等の困難さを持つことを証明。 |

---

### E. グラフレイアウトアルゴリズム

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Ortali, G. & Tollis, I. G. (2018). *Algorithms and Bounds for Drawing Directed Graphs.* arXiv:1808.10364. | https://arxiv.org/abs/1808.10364v1 | Sugiyama 代替の O(kn) チャンネル分解アルゴリズム。ダミー頂点不要。 |
| Guckes, K. et al. (2024). *A Shape Change Enhancing Hierarchical Layout for the Pairwise Comparison of DAGs.* arXiv:2406.05560. | https://arxiv.org/abs/2406.05560v1 | DAG 間の差異を視覚的に際立たせる Sugiyama 拡張レイアウト。差異視認性 60〜75% 向上。 |
| Kwon, O.-H. et al. (2017). *What Would a Graph Look Like in This Layout? A Machine Learning Approach to Large Graph Visualization.* IEEE TVCG. | https://arxiv.org/abs/1710.04328v1 | グラフレイアウト選択の ML アプローチ。タスクに適したレイアウト選択の重要性を示す。 |
| Bannister, M. J. & Eppstein, D. (2014). *Crossing Minimization for 1-page and 2-page Drawings of Graphs with Bounded Treewidth.* JGAA. | https://arxiv.org/abs/1408.6321v1 | エッジクロス最小化の計算複雑性。クロス最小化が FPT であることを示す。 |
| Bekos, M. A. et al. (2018). *A Heuristic Approach towards Drawings of Graphs with High Crossing Resolution.* arXiv:1808.10519. | https://arxiv.org/abs/1808.10519v1 | クロス解像度最大化のヒューリスティック。大角度クロスが読みやすさを向上させる実験的根拠。 |

---

### F. グラフの視覚的知覚

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Ballweg, K. et al. (2017). *Visual Similarity Perception of Directed Acyclic Graphs: A Study on Influencing Factors.* arXiv:1709.01007. | https://arxiv.org/abs/1709.01007v2 | DAG の視覚的類似知覚の決定要因を実験的に特定。**階層の深さ・各層のノード数・形状が最重要**；エッジ交差は影響小。フルテキスト取得済み。 |
| Simonetto, P. et al. (2017). *Drawing Dynamic Graphs Without Timeslices.* arXiv:1709.00372. | https://arxiv.org/abs/1709.00372v1 | タイムスライス不要の動的グラフ描画（DynNoSlice）。時系列変化を連続表示する際の参考。 |
| Federico, P. & Miksch, S. (2016). *Evaluation of two interaction techniques for visualization of dynamic graphs.* arXiv:1608.08936. | https://arxiv.org/abs/1608.08936v1 | **隣接ノードのハイライトが精度向上を実証**。レイアウト安定化も複雑タスクで有効。 |

---

### G. エッジバンドリング・エッジ可視化

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Wallinger, M. et al. (2021). *Edge-Path Bundling: A Less Ambiguous Edge Bundling Approach.* IEEE TVCG. | https://arxiv.org/abs/2108.05467v1 | **曖昧さを大幅に削減したエッジバンドリング**。直線からの逸脱最小化、有向エッジ対応。 |
| Wu, J. et al. (2017). *MLSEB: Edge Bundling using Moving Least Squares Approximation.* arXiv:1709.01221. | https://arxiv.org/abs/1709.01221v2 | MLS 近似による高品質エッジバンドリング。定量指標で既存手法を上回る品質を示した。 |

---

### H. 情報可視化・Web UI 設計

| 文献 | DOI / URL | 概要 |
|------|-----------|------|
| Munzner, T. (2014). *Visualization Analysis and Design.* A K Peters/CRC Press. | https://doi.org/10.1201/b17511-10 | 色を含む視覚変数の体系的設計指針（第 10 章「Map Color and Other Channels」）。|
| Wang, A. Z. et al. (2024). *An Empirical Study of Counterfactual Visualization to Support Visual Causal Inference.* Information Visualization. | https://arxiv.org/abs/2401.08822v1 | 反事実的可視化が因果関係の理解を促進することを実証。「もしこの交配をしたら」という交配シミュレーション機能の設計に示唆。 |
| Raj, M. & Whitaker, R. T. (2017). *Anisotropic Radial Layout for Visualizing Centrality and Structure in Graphs.* arXiv:1709.00804. | https://arxiv.org/abs/1709.00804v2 | 中心性と構造を同時に表示するラジアルレイアウト。創始者の影響力可視化への応用可能性。 |

---

*本文書は 2026-05-05 に作成。各文献の DOI リンクは出版社ウェブサイトに繋がります（購読が必要な場合あり）。arXiv リンクは無料で全文アクセス可能。*
