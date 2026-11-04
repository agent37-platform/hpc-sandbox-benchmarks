import { defineProviderMeta } from "../provider-meta.ts";
import { AGENT37_MATURITY_NOTES, agent37Pricing, agent37Transport } from "./_agent37.ts";

export default defineProviderMeta("agent37-vm", {
	displayName: "Agent37 (VM)",
	vendor: "Agent37",
	quotaDomain: "agent37",
	website: "https://www.agent37.com",
	sdkPackage: "Agent37 REST API",
	package: { directory: "agent37", entry: "vm" },
	artifact: { kind: "image" },
	inputs: ["AGENT37_API_KEY"],
	isolation: {
		class: "microVM",
		technology: "Agent37 VM",
		notes:
			'An Agent37 VM per sandbox (create with `type: "vm"`), created at exactly 4 vCPU / 8 GB. Same API, template and image as the default sandbox.',
	},
	pricing: agent37Pricing(2.5),
	maturity: {
		status: "beta",
		notes: `Isolation variant sharing credentials and the driver with agent37; adds \`type: "vm"\` at create. ${AGENT37_MATURITY_NOTES}`,
	},
	specPinning: "settable",
	transport: agent37Transport,
});
