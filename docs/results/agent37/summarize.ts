#!/usr/bin/env bun
// Agent37's standing on the pooled leaderboard: per-dimension rank tables and CPU per dollar, read
// from the same `buildLeaderboard` ranking LEADERBOARD.md renders, so nothing here is hand-ranked.
//
// usage: bun docs/results/agent37/summarize.ts <manifest.json> <cohort review>

import type { LeaderboardMetric, LeaderboardRow } from "@sandbox-benchmarks/results";
import { buildLeaderboard } from "@sandbox-benchmarks/results";
import { loadLeaderboardInput } from "../../../apps/cli/src/lib/leaderboard-input.ts";

const OURS = ["agent37", "agent37-vm"] as const;
const [manifest, review] = process.argv.slice(2);
if (!manifest || !review) throw new Error("usage: summarize.ts <manifest.json> <cohort review>");
const board = buildLeaderboard(await loadLeaderboardInput(manifest, review));

const fmt = (value: number) =>
	Math.abs(value) >= 1000
		? Math.round(value).toLocaleString("en-US")
		: Number(value.toPrecision(4)).toString();
const better = (metric: LeaderboardMetric) =>
	metric.metric.direction === "HIB" ? "higher" : "lower";
const rowOf = (metric: LeaderboardMetric, id: string) =>
	metric.rows.find((row) => row.providerId === id);
const cell = (metric: LeaderboardMetric, id: string) => {
	const row = rowOf(metric, id);
	return row ? `${fmt(row.value)} (#${row.rank} of ${metric.rows.length})` : "not run";
};
const leader = (metric: LeaderboardMetric) => {
	const top = metric.rows.find((row) => !OURS.includes(row.providerId as (typeof OURS)[number]));
	return top ? `${top.displayName} ${fmt(top.value)}` : "-";
};

const lines: string[] = [];
const podium: string[] = [];
for (const dimension of board.dimensions) {
	const metrics = dimension.metrics.filter((metric) => OURS.some((id) => rowOf(metric, id)));
	if (metrics.length === 0) continue;
	lines.push(
		`### ${dimension.dimension}`,
		"",
		"| Metric | Better | Agent37 | Agent37 VM | Best other provider |",
		"| --- | --- | ---: | ---: | --- |",
	);
	for (const metric of metrics) {
		const { label: name, unit } = metric.metric;
		const label = name.includes(`(${unit})`) ? name : `${name} (${unit})`;
		lines.push(
			`| ${label} | ${better(metric)} | ${cell(metric, "agent37")} | ${cell(metric, "agent37-vm")} | ${leader(metric)} |`,
		);
		for (const id of OURS) {
			const row = rowOf(metric, id);
			if (row && row.rank <= 3)
				podium.push(
					`| ${row.displayName} | ${label} | ${fmt(row.value)} | #${row.rank} of ${metric.rows.length} |`,
				);
		}
	}
	lines.push("");
}

const rowsOf = (metricId: string) => {
	const metric = board.dimensions
		.flatMap((dimension) => dimension.metrics)
		.find((entry) => entry.metric.id === metricId);
	return new Map((metric?.rows ?? []).map((row: LeaderboardRow) => [row.providerId, row]));
};
const cpu = rowsOf("node_web_tooling_runs_per_s");
const price = rowsOf("usd_per_hour");
const perDollar = [...cpu.values()]
	.flatMap((row) => {
		const usd = price.get(row.providerId)?.value;
		return usd ? [{ name: row.displayName, runs: row.value, usd, ratio: row.value / usd }] : [];
	})
	.sort((a, b) => b.ratio - a.ratio);

const pipeline = board.dimensions.flatMap((dimension) =>
	dimension.metrics.filter((metric) => metric.metric.label.startsWith("Better-Auth:")),
);
const pipelineTotals = [
	...new Set(pipeline.flatMap((metric) => metric.rows.map((row) => row.providerId))),
]
	.flatMap((id) => {
		const rows = pipeline.map((metric) => rowOf(metric, id));
		if (rows.some((row) => !row)) return [];
		return [
			{ name: rows[0]!.displayName, seconds: rows.reduce((sum, row) => sum + row!.value, 0) },
		];
	})
	.sort((a, b) => a.seconds - b.seconds);

console.log(
	[
		"## Where Agent37 places #1 to #3",
		"",
		"| Runtime | Metric | Median | Rank |",
		"| --- | --- | ---: | ---: |",
		...podium,
		"",
		"## CPU per dollar",
		"",
		"Node.js web tooling median runs/s divided by the hourly price at 4 vCPU / 8 GB, for every provider with both.",
		"",
		"| Rank | Provider | Runs/s | USD/hour | Runs/s per USD/hour |",
		"| ---: | --- | ---: | ---: | ---: |",
		...perDollar.map(
			(row, at) =>
				`| ${at + 1} | ${row.name} | ${fmt(row.runs)} | ${row.usd.toPrecision(3)} | ${fmt(row.ratio)} |`,
		),
		"",
		"## Better-Auth pipeline total",
		"",
		`Sum of the ${pipeline.length} Better-Auth task medians (clone, install, lint, typecheck, build), for every provider with all of them.`,
		"",
		"| Rank | Provider | Total (Seconds) |",
		"| ---: | --- | ---: |",
		...pipelineTotals.map((row, at) => `| ${at + 1} | ${row.name} | ${fmt(row.seconds)} |`),
		"",
		"## Every metric we ran, by dimension",
		"",
		"Value is the median across sandboxes; rank is out of every provider measured on that metric.",
		"",
		...lines,
	].join("\n"),
);
