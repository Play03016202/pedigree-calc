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

## 設計根拠

本ツールのアルゴリズムと UI は 10 本以上の査読済み論文の調査に基づいて設計されています。

- 近交係数の計算: Henderson (1976) Tabular Method / Boyce (1983)
- レイアウト: Sugiyama フレームワーク
- UI 設計: Ballweg et al. (2017), Federico & Miksch (2016) の知覚研究に基づく

詳細: [設計調査レポート](docs/pedigree_inbreeding_research.md) | [開発仕様書](docs/pedigree-inbreeding-app.md)

## アルゴリズム参考文献
- Henderson, C.R. (1976). A simple method for computing the inverse of a numerator relationship matrix.
