# Chat Answer-Quality Report

- Judge model: `gpt-5.1`
- Dataset: `D:\artinazma-expert-assistant\docs\evals\chat_eval_set.json`
- Total: `3` | Passed: `3` | Failed: `0`
- Avg overall: `93.67` / 100
- Avg groundedness: `5.0` / 5 | citation: `5.0` / 5 | relevance: `5.0` / 5
- Hallucination rate: `0.0`
- Duration: `92.13s`

| Status | Case | Overall | Ground | Cite | Rel | Issues |
|---|---|---|---|---|---|---|
| PASS | `fa-standard-astm-d4294` | 95 | 5 | 5 | 5 | - |
| PASS | `fa-standard-astm-d2622` | 92 | 5 | 5 | 5 | missing: جدول مقایسه; rubric fail: comparison-table |
| PASS | `fa-equipment-sulfur-lpg` | 94 | 5 | 5 | 5 | - |
