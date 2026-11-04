# Agent37 on hpc-sandbox-benchmarks

Agent37 sandboxes measured on this repo at upstream `f499e8e` (plus the Agent37 driver), on 2026-11-03, at **4 vCPU / 8 GB RAM**. Two runtimes: `agent37` (the default sandbox) and `agent37-vm` (a VM).

Every other provider's numbers come from the published run [`37073680030`](../../../data/dataset/runs/37073680030.json) of 2026-10-03. Both runs are pooled and ranked by the repo's own `leaderboard` tool; the full board is [LEADERBOARD.md](LEADERBOARD.md) and every table below is generated from it by [summarize.ts](summarize.ts).

## Where Agent37 places #1 to #3

| Runtime | Metric | Median | Rank |
| --- | --- | ---: | ---: |
| Agent37 (VM) | Better-Auth: lint deps (Knip) (Seconds) | 10.49 | #3 of 17 |
| Agent37 (VM) | fio rand write 4KB, O_DIRECT (MB/s) | 1,253 | #3 of 17 |
| Agent37 (VM) | fio rand read 4KB, O_DIRECT (IOPS) | 468,500 | #1 of 17 |
| Agent37 (VM) | fio rand read 4KB, O_DIRECT (MB/s) | 1,919 | #1 of 17 |
| Agent37 (VM) | fio rand write 4KB, O_DIRECT (IOPS) | 306,000 | #3 of 17 |
| Agent37 | fio seq write 1MB, O_DIRECT (IOPS) | 9,286 | #1 of 17 |
| Agent37 | fio seq write 1MB, O_DIRECT (MB/s) | 9,739 | #1 of 17 |
| Agent37 (VM) | Hardlink throughput (bogo ops/s) | 16.8 | #3 of 17 |
| Agent37 (VM) | iperf3 loopback UDP, 10G objective (Mbits/sec) | 9,999 | #1 of 16 |
| Agent37 | Hourly cost (USD/hr) | 0.01205 | #1 of 9 |
| Agent37 (VM) | Hourly cost (USD/hr) | 0.03014 | #2 of 9 |

## CPU per dollar

Node.js web tooling median runs/s divided by the hourly price at 4 vCPU / 8 GB, for every provider with both.

| Rank | Provider | Runs/s | USD/hour | Runs/s per USD/hour |
| ---: | --- | ---: | ---: | ---: |
| 1 | Agent37 | 17.53 | 0.0121 | 1,454 |
| 2 | boat | 28.06 | 0.0360 | 779.4 |
| 3 | Agent37 (VM) | 18.94 | 0.0301 | 628.5 |
| 4 | tama | 18.69 | 0.0740 | 252.6 |
| 5 | Novita | 20.16 | 0.233 | 86.42 |
| 6 | Daytona (VM) | 21.52 | 0.331 | 64.99 |
| 7 | Freestyle | 10.22 | 0.264 | 38.64 |
| 8 | E2B | 11.08 | 0.331 | 33.45 |
| 9 | runloop | 8.93 | 0.634 | 14.09 |

## Better-Auth pipeline total

Sum of the 10 Better-Auth task medians (clone, install, lint, typecheck, build), for every provider with all of them.

| Rank | Provider | Total (Seconds) |
| ---: | --- | ---: |
| 1 | Brezel | 118.1 |
| 2 | boat | 135.8 |
| 3 | Namespace | 150.5 |
| 4 | Daytona (VM) | 156.6 |
| 5 | Modal (VM) | 180.8 |
| 6 | Novita | 181.9 |
| 7 | Microsandbox Cloud | 189.4 |
| 8 | Agent37 (VM) | 193.6 |
| 9 | Blaxel | 198.7 |
| 10 | tama | 220.6 |
| 11 | Vercel Sandbox | 266.3 |
| 12 | E2B | 295.4 |
| 13 | Agent37 | 297.5 |
| 14 | Modal (gVisor) | 326.8 |
| 15 | Freestyle | 351.2 |
| 16 | run.cloud | 366 |
| 17 | runloop | 559.6 |

## Every metric we ran, by dimension

Value is the median across sandboxes; rank is out of every provider measured on that metric.

### realworld

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| Better-Auth: build (Seconds) | lower | 99.8 (#12 of 17) | 65.91 (#5 of 17) | Brezel 42.23 |
| Better-Auth: cold install (Seconds) | lower | 24.12 (#13 of 17) | 14.42 (#4 of 17) | Brezel 8.094 |
| Better-Auth: git clone (Seconds) | lower | 8.305 (#16 of 17) | 1.768 (#9 of 17) | Namespace 0.573 |
| Better-Auth: lint (Biome) (Seconds) | lower | 8.281 (#16 of 17) | 3.152 (#5 of 17) | Brezel 2.2 |
| Better-Auth: lint deps (Knip) (Seconds) | lower | 15.58 (#12 of 17) | 10.49 (#3 of 17) | Brezel 6.851 |
| Better-Auth: lint format (Seconds) | lower | 3.741 (#5 of 17) | 3.109 (#5 of 17) | Brezel 2.023 |
| Better-Auth: lint packages (Seconds) | lower | 5.463 (#14 of 17) | 2.737 (#6 of 17) | Brezel 1.774 |
| Better-Auth: lint spell (Seconds) | lower | 8.988 (#10 of 17) | 7.672 (#6 of 17) | Brezel 4.865 |
| Better-Auth: lint types (Seconds) | lower | 74.22 (#14 of 17) | 38.01 (#10 of 17) | Brezel 20.62 |
| Better-Auth: typecheck (Seconds) | lower | 48.99 (#8 of 17) | 46.37 (#8 of 17) | Brezel 27.57 |

### cpu

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| Node.js web tooling (runs/s) | higher | 17.53 (#7 of 17) | 18.94 (#7 of 17) | Brezel 30.06 |

### disk

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| fio rand write 4KB, O_DIRECT (MB/s) | higher | 318.8 (#13 of 17) | 1,253 (#3 of 17) | Brezel 2,564 |
| fio rand read 4KB, O_DIRECT (IOPS) | higher | 84,100 (#14 of 17) | 468,500 (#1 of 17) | Brezel 443,500 |
| fio rand read 4KB, O_DIRECT (MB/s) | higher | 344.5 (#14 of 17) | 1,919 (#1 of 17) | Brezel 1,816 |
| fio rand write 4KB, O_DIRECT (IOPS) | higher | 77,700 (#13 of 17) | 306,000 (#3 of 17) | Brezel 626,000 |
| fio seq read 1MB, O_DIRECT (IOPS) | higher | 13,250 (#4 of 17) | 9,836 (#7 of 17) | Modal (gVisor) 44,800 |
| fio seq read 1MB, O_DIRECT (MB/s) | higher | 13,905 (#4 of 17) | 10,340 (#7 of 17) | Modal (gVisor) 46,923 |
| fio seq write 1MB, O_DIRECT (IOPS) | higher | 9,286 (#1 of 17) | 6,868 (#4 of 17) | Brezel 7,919 |
| fio seq write 1MB, O_DIRECT (MB/s) | higher | 9,739 (#1 of 17) | 7,203 (#4 of 17) | Brezel 8,305 |
| Hardlink throughput (bogo ops/s) | higher | 3.12 (#16 of 17) | 16.8 (#3 of 17) | Daytona (VM) 24.61 |

### memory

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| STREAM Triad (MB/s) | higher | 30,657 (#17 of 17) | 31,055 (#16 of 17) | Daytona (VM) 176,419 |
| STREAM Add (MB/s) | higher | 30,518 (#17 of 17) | 31,174 (#16 of 17) | tama 189,634 |
| STREAM Copy (MB/s) | higher | 41,127 (#17 of 17) | 42,520 (#15 of 17) | Daytona (VM) 203,597 |
| STREAM Scale (MB/s) | higher | 27,704 (#17 of 17) | 28,296 (#16 of 17) | Daytona (VM) 167,457 |

### network

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| iperf3 WAN download (Mbits/sec) | higher | 3,461 (#5 of 16) | 913.2 (#16 of 16) | Vercel Sandbox 9,138 |
| iperf3 WAN upload (Mbits/sec) | higher | 826.6 (#14 of 16) | 798.1 (#15 of 16) | Modal (VM) 5,906 |
| iperf3 loopback TCP, 1 stream (Mbits/sec) | higher | 33,429 (#13 of 16) | 71,196 (#6 of 16) | Blaxel 165,519 |
| iperf3 loopback TCP, 10 streams (Mbits/sec) | higher | 24,678 (#14 of 16) | 74,443 (#6 of 16) | Brezel 201,826 |
| iperf3 loopback UDP, 10G objective (Mbits/sec) | higher | 281 (#16 of 16) | 9,999 (#1 of 16) | Blaxel 9,999 |
| github.com HTTPS (ms) | lower | 34.3 (#4 of 16) | 77.03 (#9 of 16) | Namespace 22 |
| api.github.com HTTPS (ms) | lower | 22.71 (#4 of 16) | 24.86 (#6 of 16) | Namespace 9.303 |
| raw.githubusercontent.com HTTPS (ms) | lower | 20.34 (#7 of 16) | 14.98 (#4 of 16) | Brezel 9.124 |
| registry.npmjs.org HTTPS (ms) | lower | 34.06 (#8 of 16) | 39.11 (#10 of 16) | Namespace 16.22 |
| pypi.org HTTPS (ms) | lower | 21.97 (#8 of 16) | 16.43 (#5 of 16) | Brezel 9.982 |
| files.pythonhosted.org HTTPS (ms) | lower | 20.09 (#7 of 16) | 15.73 (#6 of 16) | Modal (VM) 9.793 |
| ghcr.io/v2 HTTPS (ms) | lower | 31.1 (#4 of 16) | 105 (#10 of 16) | Namespace 16.3 |
| gcr.io/v2 HTTPS (ms) | lower | 30.19 (#4 of 16) | 46.15 (#6 of 16) | Namespace 14.42 |
| auth.docker.io token HTTPS (ms) | lower | 52.6 (#6 of 16) | 127.6 (#12 of 16) | Namespace 26.75 |
| crates.io HTTPS (ms) | lower | 29.98 (#9 of 16) | 24.98 (#8 of 16) | Modal (VM) 12.27 |
| index.crates.io config HTTPS (ms) | lower | 21.14 (#5 of 16) | 16.96 (#4 of 16) | Modal (VM) 10.05 |
| github.com cold DNS (ms) | lower | 8 (#6 of 16) | 8 (#6 of 16) | Daytona (VM) 4 |
| registry.npmjs.org cold DNS (ms) | lower | 11 (#9 of 16) | 9 (#6 of 16) | Namespace 4 |
| docker.io cold DNS (ms) | lower | 9 (#8 of 16) | 9 (#8 of 16) | Daytona (VM) 4 |
| pypi.org cold DNS (ms) | lower | 25 (#12 of 16) | 28 (#13 of 16) | Namespace 4 |
| rubygems.org cold DNS (ms) | lower | 58 (#6 of 16) | 107 (#15 of 16) | Blaxel 12 |
| Node 22 download (Mbits/sec) | higher | 1,650 (#7 of 16) | 1,848 (#5 of 16) | runloop 2,525 |

### system

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| Git common operations (Seconds) | lower | 58.87 (#12 of 17) | 42.61 (#6 of 17) | Brezel 30.98 |
| pgbench RO (s100, 50c) (TPS) | higher | 35,941 (#17 of 17) | 154,456 (#12 of 17) | Brezel 499,566 |
| pgbench RO latency (s100, 50c) (ms) | lower | 1.397 (#17 of 17) | 0.3265 (#12 of 17) | Brezel 0.1005 |
| pgbench RW (s100, 50c) (TPS) | higher | 4,418 (#17 of 17) | 9,969 (#15 of 17) | Brezel 48,230 |
| pgbench RW latency (s100, 50c) (ms) | lower | 11.36 (#17 of 17) | 5.019 (#15 of 17) | Brezel 1.036 |
| PyBench (Milliseconds) | lower | 584 (#12 of 17) | 560.5 (#11 of 17) | Brezel 361 |
| SQLite Speedtest (Seconds) | lower | 244.6 (#17 of 17) | 48.6 (#8 of 17) | Brezel 27.8 |

### economics

| Metric | Better | Agent37 | Agent37 VM | Best other provider |
| --- | --- | ---: | ---: | --- |
| Hourly cost (USD/hr) | lower | 0.01205 (#1 of 9) | 0.03014 (#2 of 9) | boat 0.036 |

## Read these with care

- Agent37's best disk numbers may include host caching: `O_DIRECT` inside the sandbox may not reach the device.
- Other providers ran their replicates concurrently; Agent37 ran one sandbox per runtime at a time (see below).
- Two Better-Auth replicates failed on an Agent37 control-plane stall (15:49 to 15:51 UTC) and were rerun from scratch; only the clean reruns are counted.
- VM results vary by host; every replicate is a fresh sandbox on whatever host placement picked.
- Price ranks cover only the 9 providers the published run prices.

## How this was run

- Same harness, toolchain image (`sandbox-benchmarks-toolchain:v8`) and suites as the published run, with its fixed PTS passes (2 for synthetic suites, 1 for realworld) and its replicate counts: 5 sandboxes for cpu-node, 3 for memory, disk, system, pgbench and network, 12 for Better-Auth.
- One Agent37 sandbox per runtime at a time. One account's concurrent sandboxes can land on the same host, which would have made replicates compete with each other. The two runtimes use separate host pools and ran side by side. A first pass that overlapped pgbench, network and Better-Auth on one host was discarded and rerun.
- Disk is **20 GB**, the most Agent37 sells at 4 vCPU / 8 GB, against the 40 GB target. That 20 GB is the sandbox's data tree (its home directory); the writable root layer is a separate 10 GB. The driver moves the image's PTS directory onto the data tree, as the Blaxel image does for its volume, so the suites write to the disk that is sold.
- Mastra and OpenClaw need 30 GB and 25 GB free, so the harness's own disk gate skips them on both runtimes. They are coverage gaps, not scores.
- Prices are list rates from agent37.com/pricing: $0.80 per vCPU-month plus $0.70 per GB-RAM-month over 730 hours, 2.5x on the VM runtime, disk excluded as for every provider. Other providers' prices are the ones in their published run.
- Different dates and harness revisions, so run effects are not removed. The in-sandbox producer changed between the two revisions only in comments and a `jc` setup step that is a no-op on the v8 image ([cohort-review.txt](cohort-review.txt)).

## Reproduce

```sh
bun install
export AGENT37_API_KEY=sk_live_...
export BENCH_REPO_REF=f499e8ef8696e07727edf35a49b0203658151f17   # the producer cloned into each sandbox

# One working directory per (provider, suite): shard names carry only the run id.
# BENCH_PTS_PASSES=2 for synthetic suites, 1 for realworld-*.
cell() { mkdir -p "cells/$1-$2" && (cd "cells/$1-$2" && bun "$OLDPWD/apps/cli/src/bin/bench-suite.ts" "$1" "$2" a37-20261103 --replicates "$3" --max-concurrency 1); }
for p in agent37 agent37-vm; do
  BENCH_PTS_PASSES=2 cell $p cpu-node 0,1,2,3,4
  for s in memory disk system pgbench network; do BENCH_PTS_PASSES=2 cell $p $s 0,1,2; done
  BENCH_PTS_PASSES=1 cell $p realworld-better-auth 0,1,2,3,4,5,6,7,8,9,10,11
  for s in realworld-mastra realworld-openclaw; do BENCH_PTS_PASSES=1 cell $p $s 0; done
done

bun apps/cli/src/bin/aggregate.ts a37-20261103 docs/results/agent37 cells/*/data/runs/a37-20261103-r*.json
bunx biome check docs/results/agent37 --write   # the dataset JSON shape, as commit-dataset.yml does
bun apps/cli/src/bin/leaderboard.ts docs/results/agent37/manifest.json docs/results/agent37/LEADERBOARD.md --cohort-review "$(cat docs/results/agent37/cohort-review.txt)"
bun docs/results/agent37/summarize.ts docs/results/agent37/manifest.json "$(cat docs/results/agent37/cohort-review.txt)"
```

The shards this page was built from are in [shards/](shards/), and the aggregated Run is [runs/a37-20261103.json](runs/a37-20261103.json).
