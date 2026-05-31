# PedigreeCalc

家畜・ペット・育種などの家系図を視覚化し、近交係数（F値）を計算するブラウザツールです。

## 機能
- 家系図の視覚的表示
- Wright近交係数（F値）の算出 — Henderson (1976) Tabular Method
- ECG（等価完全世代数）の計算
- 交配シミュレーション（予測F値）
- CSV / JSON インポート対応

## 使い方
[デモページ](https://play03016202.github.io/pedigree-calc/) をブラウザで開くだけで動作します。インストール不要。

## アルゴリズム参考文献
 - Boyce (1983) — 表形式法の標準実装（NRM）
 - Ballweg et al. (2017) — DAG 知覚研究（階層明確化が最優先）
 - Federico & Miksch (2016) — 隣接ハイライトの有効性実証
 - Wallinger et al. (2021) — エッジバンドリング手法
 - Leroy (2011) — 育種実務の F 値閾値と Ne 警告値
 - PedigreeOnline (2021) — HTML5 Canvas ベース先行事例
 - Talbot et al. (2026) — 猫ブリーダー向け最新インタラクティブツール


詳細: [設計調査レポート](docs/pedigree_inbreeding_research.md) | [開発仕様書](docs/pedigree-inbreeding-app.md)
