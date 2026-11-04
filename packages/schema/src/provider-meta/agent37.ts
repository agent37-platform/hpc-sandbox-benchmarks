import { defineProviderMeta } from "../provider-meta.ts";
import { AGENT37_MATURITY_NOTES, agent37Pricing, agent37Transport } from "./_agent37.ts";

export default defineProviderMeta("agent37", {
	displayName: "Agent37",
	vendor: "Agent37",
	quotaDomain: "agent37",
	website: "https://www.agent37.com",
	// No client library: the driver targets the documented /v1 REST API.
	sdkPackage: "Agent37 REST API",
	package: { directory: "agent37", entry: "sandbox" },
	artifact: { kind: "image" },
	inputs: ["AGENT37_API_KEY"],
	isolation: {
		class: "userspace",
		technology: "Agent37 sandbox",
		notes:
			"Agent37's default sandbox, created at exactly 4 vCPU / 8 GB.",
	},
	pricing: agent37Pricing(1),
	maturity: { status: "beta", notes: AGENT37_MATURITY_NOTES },
	specPinning: "settable",
	transport: agent37Transport,
});
