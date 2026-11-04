// Agent37's vendor adapter: translation only, over the documented /v1 REST API (no client library).
// Readiness, cleanup confirmation, recovery, inventory and the file fallback live in the driver kit.
//
// POST /v1/instances takes a template name, never an image ref, so the adapter boots a workspace
// template registered over the resolved toolchain image with entrypoint `sleep infinity` (the
// image's own command exits, and the sandbox is driven entirely through exec). The template is
// registered once per account on first use and checked once per bound vendor before any create.
//
// The sold disk is the instance's data tree, mounted at `mount_path` (the image user's home); the
// writable root layer around it is capped at 10 GB on every shape. As the Blaxel image does for its
// volume, `prepare` seeds the baked PTS tree onto the data tree and links it back, so the suites
// write to the disk the shape sells.

import type { CreateRequest } from "@sandbox-benchmarks/driver";
import type { Phase, Vendor, VendorRecord } from "@sandbox-benchmarks/driver/vendor";
import {
	abortableDelay,
	bounded,
	httpClassifiers,
	httpStatus,
	isMintedMarker,
} from "@sandbox-benchmarks/driver/vendor";
import { type } from "arktype";

const API_BASE = "https://api.agent37.com/v1";
/** The bound on one control request. */
export const CONTROL_TIMEOUT_MS = 30_000;
/** A create returns once the sandbox has started, which includes a cold image pull on the host. */
export const CREATE_TIMEOUT_MS = 20 * 60_000;
/** Registering a template copies the image into Agent37's registry mirror. */
export const TEMPLATE_TIMEOUT_MS = 15 * 60_000;
/** Exec has a hard ~780s server ceiling; bounded just past it. */
export const EXEC_TIMEOUT_MS = 15 * 60_000;
/**
 * `{"error":{"code":"try_again"}}` means the request did not run (a route still settling, a
 * relay cut before the host answered), so it is always safe to resend.
 */
const TRY_AGAIN_ATTEMPTS = 30;
const TRY_AGAIN_DELAY_MS = 2_000;

export const AGENT37_INSTANCE_ID = type(/^[a-z0-9]{10}$/);
export const AGENT37_ENTRYPOINT = ["sleep", "infinity"] as const;
export const PTS_DATA_DIR = "/var/lib/phoronix-test-suite";
const MOUNT_PATH = type(/^\/[A-Za-z0-9._/-]+$/);

/** Move the baked PTS tree onto the data tree at `mountPath` once, then print its size in GiB. */
export function seedPtsCommand(mountPath: string): string {
	const target = `${mountPath.replace(/\/+$/, "")}/.benchmark-volume/pts`;
	return [
		"set -e",
		`if [ "$(readlink ${PTS_DATA_DIR} || true)" != "${target}" ]; then`,
		`  mkdir -p ${target}`,
		`  cp -a ${PTS_DATA_DIR}/. ${target}/`,
		`  rm -rf ${PTS_DATA_DIR}`,
		`  ln -s ${target} ${PTS_DATA_DIR}`,
		"fi",
		`df -Pk ${PTS_DATA_DIR}/ | awk 'NR==2 { printf "%.1f\\n", $2 / 1048576 }'`,
	].join("\n");
}

/** The vCPU / GB RAM pairs Agent37 sells, each with the largest disk it allows. */
export const AGENT37_SHAPES = [
	{ cpu: 2, memory: 4, maxDiskGb: 12 },
	{ cpu: 4, memory: 8, maxDiskGb: 20 },
	{ cpu: 4, memory: 16, maxDiskGb: 40 },
	{ cpu: 4, memory: 32, maxDiskGb: 80 },
] as const;

export const OFFERED_SHAPES = AGENT37_SHAPES.map(
	(shape) => `${shape.cpu} vCPU / ${shape.memory} GB`,
).join(", ");

export function shapeFor(spec: Pick<CreateRequest["spec"], "vcpus" | "memoryGb">) {
	return AGENT37_SHAPES.find((shape) => shape.cpu === spec.vcpus && shape.memory === spec.memoryGb);
}

/**
 * The resources a create asks for. CPU and RAM are exact; disk is the request clamped to the
 * shape's ceiling (20 GB at the 4 vCPU / 8 GB target), and the observed disk is recorded.
 */
export function resourcesFor(spec: CreateRequest["spec"]) {
	const shape = shapeFor(spec);
	if (!shape) throw new Error(`Agent37 sells no ${spec.vcpus} vCPU / ${spec.memoryGb} GB shape`);
	return {
		cpu: shape.cpu,
		memory: shape.memory,
		disk: Math.min(spec.diskGb ?? shape.maxDiskGb, shape.maxDiskGb),
	};
}

/**
 * The workspace template a toolchain ref boots: its repository's last segment and tag (or the head
 * of its digest), e.g. `sandbox-benchmarks-toolchain-v8`. Template names are 2-63 characters of
 * lowercase letters, digits and hyphens.
 */
export function templateNameFor(ref: string): string {
	const image = ref.slice(ref.lastIndexOf("/") + 1).toLowerCase();
	const name = image
		.replace(/@sha256:([a-f0-9]{12})[a-f0-9]*$/, "-$1")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return name.slice(0, 63).replace(/-+$/, "");
}

const instance = type({
	id: AGENT37_INSTANCE_ID,
	status: "string",
	"status_reason?": "string | null",
	"template?": "string",
	"image_ref?": "string | null",
	"type?": "string",
	"name?": "string | null",
	"resources?": type({ cpu: "number", memory: "number", disk: "number" }).onUndeclaredKey("ignore"),
	"mount_path?": "string | null",
}).onUndeclaredKey("ignore");
type Instance = typeof instance.infer;
const list = type({ data: instance.array() }).onUndeclaredKey("ignore");
const template = type({
	name: "string",
	"image_ref?": "string | null",
	"entrypoint?": "string[] | null",
}).onUndeclaredKey("ignore");
const execResult = type({
	"stdout?": "string",
	"stderr?": "string",
	"exit_code?": "number | null",
	"truncated?": "boolean",
}).onUndeclaredKey("ignore");
const errorBody = type({
	error: type({ "code?": "string", "message?": "string" }).onUndeclaredKey("ignore"),
}).onUndeclaredKey("ignore");

/** A non-2xx answer, carrying Agent37's `{error: {code, message}}`. */
export class Agent37Error extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		message: string,
	) {
		super(`Agent37 ${status}${code ? ` ${code}` : ""}: ${message}`);
		this.name = "Agent37Error";
	}
}
const status = httpStatus(Agent37Error, (error) => error.status);
const classifiers = httpClassifiers(status);
const tryAgain = (error: unknown) => error instanceof Agent37Error && error.code === "try_again";

/**
 * A sleeping sandbox keeps its memory and any exec wakes it, so it reads as ready. A stopped one
 * holds no compute and cannot run a benchmark: owned ones are torn down.
 */
export function agent37Phase(state: string): Phase {
	switch (state) {
		case "running":
		case "sleeping":
			return "ready";
		case "failed":
		case "stopping":
		case "stopped":
			return "failed";
		case "deleting":
			return "deleting";
		case "deleted":
			return "gone";
		default:
			return "pending";
	}
}

function record(row: Instance): VendorRecord<Instance> {
	return {
		id: row.id,
		phase: agent37Phase(row.status),
		...(row.name && isMintedMarker(row.name) && { marker: row.name }),
		...((row.status === "stopped" || row.status === "stopping") && { stopped: true }),
		...(row.status_reason && { detail: row.status_reason }),
		raw: row,
	};
}

/** What the adapter reads from either variant's driver context. */
export interface Agent37Context {
	readonly env: { readonly AGENT37_API_KEY: string };
	readonly resolvedArtifact: { readonly ref: string };
}

export interface Agent37VendorOptions {
	/** `"vm"` selects a VM; omitted is Agent37's default sandbox. */
	readonly type?: "vm";
	readonly delay?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** The adapter over one transport: production binds `globalThis.fetch`, tests a fake router. */
export function agent37Vendor(
	{ env, resolvedArtifact }: Agent37Context,
	transport: typeof globalThis.fetch,
	{ type: runtime, delay = abortableDelay }: Agent37VendorOptions = {},
): Vendor<Instance, Instance> {
	const once = (
		method: string,
		path: string,
		{ body, signal, timeoutMs }: { body?: unknown; signal?: AbortSignal; timeoutMs: number },
	): Promise<unknown> =>
		bounded(signal, timeoutMs, async (within) => {
			const response = await transport(`${API_BASE}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${env.AGENT37_API_KEY}`,
					...(body !== undefined && { "Content-Type": "application/json" }),
				},
				...(body !== undefined && { body: JSON.stringify(body) }),
				signal: within,
			});
			const text = await response.text();
			let parsed: unknown;
			try {
				parsed = text ? JSON.parse(text) : undefined;
			} catch {
				parsed = undefined;
			}
			if (response.ok) return parsed;
			const error = errorBody(parsed);
			const { code, message } = error instanceof type.errors ? {} : error.error;
			throw new Agent37Error(
				response.status,
				code,
				message ?? (text.slice(0, 200) || response.statusText),
			);
		});
	const request = async (
		method: string,
		path: string,
		options: { body?: unknown; signal?: AbortSignal; timeoutMs: number },
	): Promise<unknown> => {
		for (let attempt = 1; ; attempt++) {
			try {
				return await once(method, path, options);
			} catch (error) {
				if (!tryAgain(error) || attempt >= TRY_AGAIN_ATTEMPTS) throw error;
				await delay(TRY_AGAIN_DELAY_MS, options.signal);
			}
		}
	};
	const control = (method: string, path: string, signal: AbortSignal) =>
		request(method, path, { signal, timeoutMs: CONTROL_TIMEOUT_MS });
	const execIn = async (id: string, command: string, signal?: AbortSignal) => {
		const result = execResult.assert(
			await request("POST", `/instances/${id}/exec`, {
				body: { command, user: "root" },
				...(signal && { signal }),
				timeoutMs: EXEC_TIMEOUT_MS,
			}),
		);
		// The vendor port has no truncation field, so partial output must not pass as success.
		if (result.truncated)
			throw new Error("Agent37 exec output exceeded its 512 KB limit and was truncated");
		return result;
	};

	const ref = resolvedArtifact.ref;
	const name = templateNameFor(ref);
	const readTemplate = async (signal: AbortSignal) => {
		try {
			return template.assert(await control("GET", `/templates/${name}`, signal));
		} catch (error) {
			if (status(error) === 404) return undefined;
			throw error;
		}
	};
	const registerTemplate = async (signal: AbortSignal) => {
		let current = await readTemplate(signal);
		if (!current) {
			try {
				await request("POST", "/templates", {
					body: {
						name,
						image_ref: ref,
						entrypoint: AGENT37_ENTRYPOINT,
						description: "sandbox-benchmarks toolchain, driven over exec",
					},
					signal,
					timeoutMs: TEMPLATE_TIMEOUT_MS,
				});
			} catch (error) {
				// Another process registered it first; the read below checks what it registered.
				if (status(error) !== 409) throw error;
			}
			current = await readTemplate(signal);
		}
		if (
			current?.image_ref !== ref ||
			JSON.stringify(current.entrypoint) !== JSON.stringify(AGENT37_ENTRYPOINT)
		)
			throw new Error(
				`Agent37 template ${name} must boot ${ref} with entrypoint ${JSON.stringify(AGENT37_ENTRYPOINT)}; it has ${current?.image_ref} and ${JSON.stringify(current?.entrypoint)}`,
			);
	};
	// One check per bound vendor, shared by concurrent creates; a failed one is asked again.
	let checked: Promise<void> | undefined;
	const ensureTemplate = (signal: AbortSignal) => {
		if (!checked) {
			const pending = registerTemplate(signal);
			checked = pending;
			pending.catch(() => {
				if (checked === pending) checked = undefined;
			});
		}
		return checked;
	};

	return {
		control: {
			// Create answers once the sandbox has started (the sandbox or VM boot returned).
			create: async ({ request: { spec }, marker }, { signal }) => {
				await ensureTemplate(signal);
				return record(
					instance.assert(
						await request("POST", "/instances", {
							body: {
								template: name,
								...(runtime && { type: runtime }),
								resources: resourcesFor(spec),
								name: marker,
								auto_sleep: false,
								metadata: { harness: "sandbox-benchmarks" },
							},
							signal,
							timeoutMs: CREATE_TIMEOUT_MS,
						}),
					),
				);
			},
			get: async (id, { signal }) =>
				record(instance.assert(await control("GET", `/instances/${id}`, signal))),
			// A delete answers `{deleted: true}`; the kit reads on until the GET answers 404.
			remove: async (id, { signal }) => {
				await control("DELETE", `/instances/${id}`, signal);
				return "accepted";
			},
			// The whole workspace in one page; every create is named by its marker.
			page: async (_cursor, { signal }) => ({
				records: list.assert(await control("GET", "/instances", signal)).data.map(record),
			}),
			...classifiers,
			admit: ({ raw }) =>
				(raw.type ?? "default") === (runtime ?? "default")
					? undefined
					: `requested a ${runtime ?? "default"} sandbox but the instance is ${raw.type}`,
		},
		data: {
			attach: ({ raw }) => raw,
			// The control plane reports the allocated resources and the image the template boots.
			prepare: async ({ record: { raw } }, { spec }, { signal }) => {
				const want = resourcesFor(spec);
				const got = raw.resources;
				if (got?.cpu !== want.cpu || got.memory !== want.memory || got.disk !== want.disk)
					return {
						status: "unsupported",
						detail: `requested ${want.cpu} vCPU / ${want.memory} GB / ${want.disk} GB disk but the instance reports ${got?.cpu} / ${got?.memory} / ${got?.disk}`,
					};
				const mount = MOUNT_PATH(raw.mount_path);
				if (mount instanceof type.errors)
					throw new Error(`Agent37 instance ${raw.id} reports no usable mount_path`);
				const seeded = await execIn(raw.id, seedPtsCommand(mount), signal);
				const seededGb = Number(seeded.stdout?.trim());
				if (seeded.exit_code !== 0 || !(seededGb >= want.disk * 0.9))
					throw new Error(
						`Agent37 could not place ${PTS_DATA_DIR} on the ${want.disk} GB data tree (exit ${seeded.exit_code}, ${seededGb} GiB): ${seeded.stderr ?? ""}`.trim(),
					);
				return raw.image_ref
					? { status: "honored", reportedArtifact: { kind: "image", ref: raw.image_ref } }
					: { status: "honored" };
			},
			exec: async (native, command, options) => {
				const result = await execIn(native.id, command, options?.signal);
				return {
					...(typeof result.exit_code === "number" && { exitCode: result.exit_code }),
					stdout: result.stdout ?? "",
					stderr: result.stderr ?? "",
				};
			},
		},
	};
}
