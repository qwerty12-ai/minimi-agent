# MiniMi Agent — M6 Performance Baseline

## Measurement conditions

- Benchmark suite: `tests/performance-benchmark.test.ts`
- Warmup iterations: 5 per benchmark
- Measured iterations: 30 per benchmark
- Measurement tool: Node.js `performance` API
- Date: 2026-11-14
- Dependencies: mocked providers and repositories

## Results

| Operation | Average (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|
| Memory retrieval | 0.037 | 0.030 | 0.082 |
| Research execution | 0.043 | 0.037 | 0.085 |
| Grounded synthesis | 0.090 | 0.081 | 0.135 |
| Complete agent execution | 2.214 | 1.947 | 4.316 |

## Interpretation

These measurements establish a local synthetic performance baseline for the
application pipeline.

The benchmarks use mocked external dependencies. They do not measure actual
network latency, live SearXNG response times, or Ollama inference latency.

Results are environment-dependent and should be treated as a comparison
baseline rather than production performance guarantees.

## M6 verification

- Evaluation scenarios: 10
- Evaluation metrics: 5
- Failure-recovery tests: 5
- Performance benchmarks: 4
- Full test suite: 341 tests passed across 37 files
- TypeScript typecheck: passed
- Production build: passed
