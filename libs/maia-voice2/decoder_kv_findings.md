# decoder_kv.onnx Model Inspection Findings

**Model path:** `public/Moonshine-Streaming-medium/decoder_kv.onnx` (Moonshine-Streaming-medium)

**Inspection date:** 2025-02-27

**Tool used:** Python `onnx` package (v1.18.0)

---

## 1. All Input Names

| Input Name  | Type    | Shape                      | Rank |
|------------|---------|----------------------------|------|
| `token`    | int64   | `[1, 's82']`               | 2    |
| `k_self`   | float32 | `[14, 1, 10, 's9', 64]`    | 5    |
| `v_self`   | float32 | `[14, 1, 10, 's25', 64]`   | 5    |
| `out_k_cross` | float32 | `[14, 1, 10, 's40', 64]` | 5    |
| `out_v_cross` | float32 | `[14, 1, 10, 's40', 64]` | 5    |

---

## 2. Token Input Details

**Input name:** `token`

- **Expected shape:** `[batch, sequence]` -> `[1, 's82']`
- **Type:** int64
- **Dynamic dimension:** `s82` = variable sequence length (tokens per step)
- **Fixed dimensions:** batch=1, sequence length is dynamic

---

## 3. Rank and Dimensions Summary

| Input       | Rank | Dimensions (fixed vs dynamic) |
|------------|------|-------------------------------|
| `token`    | 2    | [1, seq_len] - batch fixed at 1, sequence dynamic |
| `k_self`   | 5    | [14, 1, 10, past_seq, 64] - 14 layers, 1 batch, 10 heads, past_kv_len dynamic, head_dim 64 |
| `v_self`   | 5    | [14, 1, 10, past_seq, 64] - same structure as k_self |
| `out_k_cross` | 5 | [14, 1, 10, cross_seq, 64] - cross-attention keys |
| `out_v_cross` | 5 | [14, 1, 10, cross_seq, 64] - cross-attention values |

**Fixed constants inferred:**
- 14 decoder layers
- 10 attention heads
- 64 head dimension
- 32768 vocabulary size (from logits output shape)

---

## Outputs (for reference)

| Output Name   | Shape                       |
|---------------|-----------------------------|
| `logits`      | `[1, s82, 32768]`           |
| `out_k_self`  | `[14, 1, 10, s82+s9, 64]`   |
| `out_v_self`  | `[14, 1, 10, s25+s82, 64]`  |
| `out_k_cross` | `[14, 1, 10, s40, 64]`      |
| `out_v_cross` | `[14, 1, 10, s40, 64]`      |
