// The Agent37 DriverModules: the kit's driver over the adapter, bound to the real transport here and
// nowhere else. Both runtimes are the same module; `agent37-vm` adds `type: "vm"` at create. Tests
// lower the same module over a fake router through `vendorDriver`.

import { coverage, defineVendorDriver } from "@sandbox-benchmarks/driver/vendor";
import { AGENT37_PROVENANCE } from "./provenance.ts";
import {
	AGENT37_INSTANCE_ID,
	agent37Vendor,
	CONTROL_TIMEOUT_MS,
	CREATE_TIMEOUT_MS,
	EXEC_TIMEOUT_MS,
	OFFERED_SHAPES,
	shapeFor,
	TEMPLATE_TIMEOUT_MS,
} from "./vendor.ts";

const READY_TIMEOUT_MS = 5 * 60_000;
const DELETE_TIMEOUT_MS = 5 * 60_000;

export function defineAgent37Driver<P extends "agent37" | "agent37-vm">(provider: P) {
	return defineVendorDriver(provider, {
		provenance: AGENT37_PROVENANCE,
		sandboxId: AGENT37_INSTANCE_ID,
		// CPU and RAM are set exactly. Disk is clamped to the shape's ceiling (see resourcesFor) and
		// `prepare` checks every axis against what the control plane reports.
		coverage: coverage({ vcpus: "mapped", memoryGb: "mapped", diskGb: "mapped" }),
		unsupported: ({ spec }) =>
			shapeFor(spec)
				? undefined
				: `Agent37 sells no ${spec.vcpus} vCPU / ${spec.memoryGb} GB shape (offered: ${OFFERED_SHAPES})`,
		// No file API; exec is buffered with a ~780s ceiling, so long steps detach and are polled.
		execution: { syncCapMs: 60_000, durable: "shell-detach" },
		// Every bound one create can spend: the template check, the POST, readiness, prepare and teardown.
		createBudget: {
			owner: "harness",
			timeoutMs:
				TEMPLATE_TIMEOUT_MS +
				CREATE_TIMEOUT_MS +
				READY_TIMEOUT_MS +
				EXEC_TIMEOUT_MS +
				DELETE_TIMEOUT_MS,
		},
		timing: {
			pollMs: 2_000,
			readyTimeoutMs: READY_TIMEOUT_MS,
			deleteTimeoutMs: DELETE_TIMEOUT_MS,
			controlTimeoutMs: CONTROL_TIMEOUT_MS,
		},
		// Each create is named by its marker; the workspace listing returns every instance's name.
		markerKey: "name",
		// A create whose response was lost may still have started a sandbox.
		recovery: { provesAbsence: false },
		vendor: (context) =>
			agent37Vendor(context, globalThis.fetch, provider === "agent37-vm" ? { type: "vm" } : {}),
	});
}
