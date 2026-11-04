// Agent37 tested at the vendor seam: the adapter's translation, the port contract over a fake REST
// router, and sessions through the package's own modules. Kit behaviour (convergence, deadlines,
// the inventory partition, recovery mechanics) is tested once in the driver package.

import { describe, expect, test } from "bun:test";
import type { CreateRequest, DriverContext } from "@sandbox-benchmarks/driver";
import type { VendorTiming } from "@sandbox-benchmarks/driver/vendor";
import { restStub, vendorContract, vendorDriver } from "@sandbox-benchmarks/driver/vendor/testing";
import { getProvider, hourlyCostAtTargetSpec } from "@sandbox-benchmarks/schema/providers";
import { TARGET_SPEC } from "@sandbox-benchmarks/schema/target-spec";
import sandbox from "./sandbox.ts";
import {
	agent37Phase,
	agent37Vendor,
	resourcesFor,
	seedPtsCommand,
	templateNameFor,
} from "./vendor.ts";
import vm from "./vm.ts";

const IMAGE = "ghcr.io/starslingdev/sandbox-benchmarks-toolchain:v8";
const TEMPLATE = "sandbox-benchmarks-toolchain-v8";
const context: DriverContext<"agent37"> = {
	env: { AGENT37_API_KEY: "sk_live_test" },
	artifact: { kind: "image" },
	resolvedArtifact: { kind: "image", ref: IMAGE },
};
const vmContext: DriverContext<"agent37-vm"> = { ...context };
const request: CreateRequest = {
	spec: TARGET_SPEC,
	artifact: { kind: "image", ref: IMAGE },
	deadlineMs: 300_000,
};

const json = (value: unknown, status = 200) => Response.json(value, { status });
const notFound = () => json({ error: { code: "not_found", message: "Instance not found." } }, 404);

interface Row {
	readonly id: string;
	readonly name: string | null;
	status: string;
	type: string;
	image_ref: string | null;
	resources: { cpu: number; memory: number; disk: number };
	mount_path: string;
	gets: number;
}

/**
 * A fake `/v1` API: a create answers `starting` or `running`, GETs reach `running` after
 * `readyAfterGets`, a delete answers `{deleted: true}` and the next GET 404s.
 */
function agent37Server(
	options: {
		readonly readyAfterGets?: number;
		/** The workspace already holds the template, with these fields. */
		readonly template?: { image_ref: string; entrypoint: string[] | null };
		/** The control plane reports these resources whatever was asked. */
		readonly allocates?: { cpu: number; memory: number; disk: number };
		/** Exec answers try_again this many times before running. */
		readonly tryAgain?: number;
		readonly truncate?: boolean;
		/** GiB the data tree reports once PTS is seeded onto it. */
		readonly seededGb?: number;
	} = {},
) {
	let templates = new Map(
		options.template ? [[TEMPLATE, { name: TEMPLATE, ...options.template }]] : [],
	);
	let busy = options.tryAgain ?? 0;
	const view = ({ gets: _gets, ...row }: Row) => row;
	const stub = restStub<Row>(
		{
			"GET /v1/templates/:name": ({ params }) =>
				templates.get(params.name ?? "") ??
				json({ error: { code: "not_found", message: "Template not found." } }, 404),
			"POST /v1/templates": ({ body }) => {
				if (templates.has(body.name))
					return json({ error: { code: "template_conflict", message: "exists" } }, 409);
				templates = new Map([...templates, [body.name, body]]);
				return json(body, 201);
			},
			"POST /v1/instances": ({ body, add }) => {
				if (!templates.has(body.template))
					return json({ error: { code: "invalid_request", message: "no template" } }, 400);
				const row = add({
					name: body.name,
					status: (options.readyAfterGets ?? 0) > 0 ? "starting" : "running",
					type: body.type ?? "default",
					image_ref: templates.get(body.template)?.image_ref ?? null,
					resources: options.allocates ?? body.resources,
					mount_path: "/root",
					gets: 0,
				});
				return json(view(row), 201);
			},
			"GET /v1/instances": ({ rows }) => ({ data: [...rows.values()].map(view) }),
			"GET /v1/instances/:id": ({ row }) => {
				row.gets += 1;
				if (row.status === "starting" && row.gets >= (options.readyAfterGets ?? 0))
					row.status = "running";
				return view(row);
			},
			"DELETE /v1/instances/:id": ({ row, rows }) => {
				rows.delete(row.id);
				return { id: row.id, deleted: true };
			},
			"POST /v1/instances/:id/exec": ({ body, run }) => {
				if (busy > 0) {
					busy -= 1;
					return json({ error: { code: "try_again", message: "route settling" } }, 503);
				}
				if (body.command === "fixture") return { stdout: "out\n", stderr: "err\n", exit_code: 7 };
				if (body.command === seedPtsCommand("/root"))
					return { stdout: `${options.seededGb ?? 20}\n`, stderr: "", exit_code: 0 };
				const { stdout, stderr, exitCode } = run(body.command);
				return {
					stdout,
					stderr,
					exit_code: exitCode,
					...(options.truncate && { truncated: true }),
				};
			},
		},
		{
			newId: (n) => `a37test${String(n).padStart(3, "0")}`,
			missing: notFound,
		},
	);
	return {
		...stub,
		templates: () => templates,
		creates: () =>
			stub.calls.filter((call) => call.method === "POST" && call.path === "/v1/instances"),
	};
}

const FAST: Partial<VendorTiming> = { pollMs: 0, readyTimeoutMs: 500, deleteTimeoutMs: 500 };
const noDelay = () => Promise.resolve();
const vendorOver = (server: ReturnType<typeof agent37Server>, type?: "vm") =>
	agent37Vendor(context, server.fetch, { ...(type && { type }), delay: noDelay });

vendorContract("agent37 adapter", sandbox, () => vendorOver(agent37Server()));

test("the target maps to the 4/8 shape with disk clamped to its 20 GB ceiling", () => {
	expect(resourcesFor(TARGET_SPEC)).toEqual({ cpu: 4, memory: 8, disk: 20 });
	expect(resourcesFor({ vcpus: 4, memoryGb: 8, diskGb: 10 })).toEqual({
		cpu: 4,
		memory: 8,
		disk: 10,
	});
	expect(() => resourcesFor({ vcpus: 8, memoryGb: 16 })).toThrow("no 8 vCPU / 16 GB");
});

test("a toolchain ref names its template by repository and tag or digest", () => {
	expect(templateNameFor(IMAGE)).toBe(TEMPLATE);
	expect(templateNameFor(`${IMAGE}-candidate`)).toBe(`${TEMPLATE}-candidate`);
	expect(
		templateNameFor(`ghcr.io/starslingdev/sandbox-benchmarks-toolchain@sha256:${"ab".repeat(32)}`),
	).toBe("sandbox-benchmarks-toolchain-abababababab");
});

test("the VM runtime is priced at 2.5x the default compute rate", () => {
	const defaultHourly = hourlyCostAtTargetSpec(getProvider("agent37"));
	expect(defaultHourly).toBeCloseTo((4 * 0.8 + 8 * 0.7) / 730, 10);
	expect(hourlyCostAtTargetSpec(getProvider("agent37-vm"))).toBeCloseTo(
		2.5 * (defaultHourly ?? 0),
		10,
	);
});

test("a sleeping sandbox is ready (exec wakes it); a stopped one holds no compute", () => {
	expect(agent37Phase("sleeping")).toBe("ready");
	expect(agent37Phase("stopped")).toBe("failed");
	expect(agent37Phase("provisioning")).toBe("pending");
	expect(agent37Phase("deleted")).toBe("gone");
});

describe("Agent37 end to end through its modules", () => {
	test("a session registers the template once, creates the target, executes, and is destroyed", async () => {
		const server = agent37Server({ readyAfterGets: 2 });
		const driver = vendorDriver(sandbox, context, {
			vendor: vendorOver(server),
			timing: FAST,
		});
		const [first, second] = await Promise.all([driver.create(request), driver.create(request)]);
		expect(server.templates().get(TEMPLATE)).toMatchObject({
			image_ref: IMAGE,
			entrypoint: ["sleep", "infinity"],
		});
		expect(
			server.calls.filter((call) => call.method === "POST" && call.path === "/v1/templates"),
		).toHaveLength(1);
		const body = server.creates()[0]?.body;
		expect(body).toMatchObject({
			template: TEMPLATE,
			resources: { cpu: 4, memory: 8, disk: 20 },
			auto_sleep: false,
		});
		expect(body).not.toHaveProperty("type");
		expect((body as { name: string }).name).toMatch(/^benchmark-[0-9a-f-]{36}$/);

		const result = await first?.exec("fixture");
		expect(result?.exit).toEqual({ kind: "exited", code: 7 });
		expect([result?.stdout, result?.stderr]).toEqual(["out\n", "err\n"]);
		expect(server.calls.find((call) => call.path.endsWith("/exec"))?.body).toMatchObject({
			user: "root",
		});
		await first?.destroy();
		await second?.destroy();
		expect(server.rows.size).toBe(0);
	});

	test("agent37-vm creates a VM", async () => {
		const server = agent37Server();
		const session = await vendorDriver(vm, vmContext, {
			vendor: vendorOver(server, "vm"),
			timing: FAST,
		}).create(request);
		expect(server.creates()[0]?.body).toMatchObject({ type: "vm" });
		await session.destroy();
	});

	test("a template over another image is refused before any create", async () => {
		const server = agent37Server({
			template: { image_ref: "ghcr.io/example/other:v1", entrypoint: ["sleep", "infinity"] },
		});
		await expect(
			vendorDriver(sandbox, context, { vendor: vendorOver(server), timing: FAST }).create(request),
		).rejects.toThrow();
		expect(server.creates()).toHaveLength(0);
	});

	test("a shape Agent37 does not sell is refused before any vendor call", async () => {
		const server = agent37Server();
		await expect(
			vendorDriver(sandbox, context, { vendor: vendorOver(server), timing: FAST }).create({
				...request,
				spec: { ...TARGET_SPEC, vcpus: 8, memoryGb: 16 },
			}),
		).rejects.toMatchObject({ code: "invalid-create-request" });
		expect(server.calls).toEqual([]);
	});

	test("PTS is seeded onto the data tree, and a tree short of the sold disk fails the create", async () => {
		const server = agent37Server();
		const session = await vendorDriver(sandbox, context, {
			vendor: vendorOver(server),
			timing: FAST,
		}).create(request);
		expect(server.calls.map((call) => call.body)).toContainEqual({
			command: seedPtsCommand("/root"),
			user: "root",
		});
		await session.destroy();

		const small = agent37Server({ seededGb: 9.7 });
		await expect(
			vendorDriver(sandbox, context, { vendor: vendorOver(small), timing: FAST }).create(request),
		).rejects.toThrow("could not place /var/lib/phoronix-test-suite");
		expect(small.rows.size).toBe(0);
	});

	test("an allocation reporting other resources is refused and torn down", async () => {
		const server = agent37Server({ allocates: { cpu: 2, memory: 4, disk: 20 } });
		await expect(
			vendorDriver(sandbox, context, { vendor: vendorOver(server), timing: FAST }).create(request),
		).rejects.toThrow();
		expect(server.rows.size).toBe(0);
	});

	test("try_again is resent, and truncated output is never returned as a result", async () => {
		const server = agent37Server({ tryAgain: 2 });
		const session = await vendorDriver(sandbox, context, {
			vendor: vendorOver(server),
			timing: FAST,
		}).create(request);
		expect((await session.exec("fixture")).exit).toEqual({ kind: "exited", code: 7 });
		await session.destroy();

		const truncating = vendorOver(agent37Server({ truncate: true }));
		const op = { signal: new AbortController().signal };
		const { raw } = await truncating.control.create(
			{ request, marker: "benchmark-00000000-0000-4000-8000-000000000001" },
			op,
		);
		await expect(truncating.data.exec(raw, "echo hi")).rejects.toThrow("truncated");
	});
});
