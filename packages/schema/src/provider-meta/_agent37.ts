import type { ProviderPricing } from "../provider-pricing.ts";
import type { ProviderTransport } from "../providers.ts";

/** Agent37's rate card is monthly over a 730-hour month (agent37.com/pricing). */
const HOURS_PER_MONTH = 730;
const USD_PER_VCPU_MONTH = 0.8;
const USD_PER_GB_RAM_MONTH = 0.7;
const USD_PER_GB_DISK_MONTH = 0.09;

/**
 * The published list rates shared by both runtimes. The VM runtime bills the compute half (vCPU and
 * RAM) at a published multiple; disk is never multiplied and, like every provider's disk, stays out
 * of the exact hourly cost.
 */
export function agent37Pricing(computeMultiplier: 1 | 2.5): ProviderPricing {
	const multiple = computeMultiplier === 1 ? "" : ` x ${computeMultiplier} for the VM runtime`;
	return {
		model: "published",
		components: [
			{
				id: "cpu",
				resource: "cpu",
				billingBasis: "provisioned",
				vendorUnit: "vCPU",
				usdPerUnitHour: (USD_PER_VCPU_MONTH * computeMultiplier) / HOURS_PER_MONTH,
				quantityRule: { kind: "linear", dimension: "vcpus", unitsPerTargetUnit: 1 },
				notes: `$${USD_PER_VCPU_MONTH}/vCPU-month${multiple}, over a ${HOURS_PER_MONTH}-hour month.`,
			},
			{
				id: "memory",
				resource: "memory",
				billingBasis: "provisioned",
				vendorUnit: "GB RAM (GiB to the guest)",
				usdPerUnitHour: (USD_PER_GB_RAM_MONTH * computeMultiplier) / HOURS_PER_MONTH,
				quantityRule: { kind: "linear", dimension: "memoryGb", unitsPerTargetUnit: 1 },
				notes: `$${USD_PER_GB_RAM_MONTH}/GB-month${multiple}, over a ${HOURS_PER_MONTH}-hour month.`,
			},
			{
				id: "disk",
				resource: "disk",
				billingBasis: "provisioned",
				vendorUnit: "GB",
				usdPerUnitHour: USD_PER_GB_DISK_MONTH / HOURS_PER_MONTH,
				quantityRule: { kind: "linear", dimension: "diskGb", unitsPerTargetUnit: 1 },
				notes: `$${USD_PER_GB_DISK_MONTH}/GB-month on either runtime.`,
			},
		],
		targetHourlyCost: { kind: "exact", componentIds: ["cpu", "memory"] },
		notes:
			"Published list rates, metered per minute from a prepaid balance while a sandbox runs; no plan fee or seat charge. A stopped or sleeping sandbox pays disk only.",
		sources: [
			{ label: "Agent37 pricing", url: "https://www.agent37.com/pricing", checkedAt: "2026-11-03" },
		],
	};
}

/**
 * POST /v1/instances/{id}/exec is a buffered request/response with a hard ~780s ceiling and named,
 * deduplicated resends. The common 60s policy bound applies; longer steps detach and are polled.
 */
export const agent37Transport: ProviderTransport = {
	streaming: false,
	syncCapMs: 60_000,
	detachedPoll: true,
};

/**
 * POST /v1/instances takes a template name, never an image ref. The driver boots a workspace
 * template it registers once over the requested toolchain image, with entrypoint `sleep infinity`
 * (the toolchain image's own command exits). At 4 vCPU / 8 GB the largest disk sold is 20 GB, so
 * the 40 GB target is clamped there and the observed disk is recorded. The sold disk is the data
 * tree at the image user's home; the writable root layer is a separate 10 GB on every shape, so the
 * driver seeds the baked PTS tree onto the data tree and links it back (as the Blaxel image does).
 */
export const AGENT37_MATURITY_NOTES =
	"REST driver (fetch only, no SDK). Boots a workspace template registered once over the shared toolchain image (entrypoint `sleep infinity`), so the guest runs the same Debian 13 image as the other OCI providers. vCPU and RAM are set exactly at create. Disk is 20 GB, the most sold at the 4 vCPU / 8 GB shape, so the 40 GB target cannot be met: the request is clamped, the observed disk is recorded, and suites needing more than 20 GB free skip as coverage gaps. The 20 GB is the data tree mounted at the image user's home, and the writable root layer is a separate 10 GB, so the driver seeds the baked PTS tree onto the data tree and links /var/lib/phoronix-test-suite to it, as the Blaxel image does for its volume. Teardown is delete.";
