import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { query } from './db';

type SeedItem = {
	code: string;
	name: string;
	unit: string;
	verticals: string[];
	whyItMatters: string;
	complianceRefs: string[];
	underwritingWeight: string;
	simple: boolean;
};

const simpleItems: SeedItem[] = [
	{ code: 'SPD-CHK', name: 'Surge protective device status check', unit: 'ea (per SPD)', verticals: ['All Sites'], whyItMatters: 'Surge protective devices wear each time they clamp a spike. Checking indicator status and terminations ensures the device can still absorb transients to protect sensitive equipment and reduce unplanned outages.', complianceRefs: ['NFPA 70B'], underwritingWeight: 'medium', simple: true },
	{ code: 'PHZ-TAPE', name: 'Apply/refresh phase & feeder ID color tape', unit: 'per termination', verticals: ['All Sites'], whyItMatters: 'Clarity; error reduction', complianceRefs: ['NFPA 70B'], underwritingWeight: 'low-medium', simple: true },
	{ code: 'GEC-CLP', name: 'Replace corroded grounding electrode conductor clamp', unit: 'ea', verticals: ['All Sites'], whyItMatters: 'Fault/lightning return path integrity', complianceRefs: ['NFPA 70B'], underwritingWeight: 'high', simple: true },
	{ code: 'AO-ALCU', name: 'Apply antioxidant on Al-to-Cu terminations', unit: 'ea point', verticals: ['All Sites'], whyItMatters: 'Aluminum-to-copper connections can oxidize and loosen, creating high-resistance heat points. Applying antioxidant and properly re-torquing restores conductivity and helps prevent overheating, nuisance trips, and damage.', complianceRefs: ['NFPA 70B'], underwritingWeight: 'medium-high', simple: true },
	{ code: 'HND-TIE', name: 'Install handle-tie / common trip where required', unit: 'per pair', verticals: ['All Sites'], whyItMatters: 'Multi-wire branch circuits and paired circuits must trip together. Adding handle ties/common-trip breakers prevents hidden backfeed and ensures a worker does not encounter a half-de-energized circuit.', complianceRefs: ['NFPA 70B'], underwritingWeight: 'medium', simple: true },
	{ code: 'TRAY-CLN', name: 'Cable tray housekeeping & securing', unit: 'per tray segment', verticals: ['All Sites'], whyItMatters: 'Overheating/abrasion risk', complianceRefs: ['NFPA 70B'], underwritingWeight: 'medium', simple: true },
	{ code: 'FSTP-PM', name: 'Minor firestop patch at small electrical penetrations', unit: 'ea', verticals: ['All Sites'], whyItMatters: 'Compartmentation', complianceRefs: [], underwritingWeight: 'high', simple: true },
	{ code: 'FAP-CLN', name: 'Fire alarm panel tidy & battery date check', unit: 'ea panel', verticals: ['All Sites'], whyItMatters: 'Egress/notification readiness', complianceRefs: [], underwritingWeight: 'high', simple: true },
	{ code: 'ELV-RM-HK', name: 'Elevator machine room housekeeping/clearance', unit: 'ea room', verticals: ['All Sites'], whyItMatters: 'High-energy equipment room safety', complianceRefs: [], underwritingWeight: 'medium-high', simple: true },
	{ code: 'UPS-BATT-SV', name: 'Small UPS battery terminal clean/test (≤3kVA)', unit: 'ea UPS ≤3kVA', verticals: ['All Sites'], whyItMatters: 'Continuity of operations', complianceRefs: [], underwritingWeight: 'medium', simple: true },
	{ code: 'EVSE-VIS', name: 'EV charger/receptacle visual & labeling', unit: 'ea unit', verticals: ['All Sites'], whyItMatters: 'Site hazards visibility', complianceRefs: [], underwritingWeight: 'low-medium', simple: true },
	{ code: 'ATS-LBL', name: 'Label ATS positions & source ID', unit: 'ea ATS', verticals: ['All Sites'], whyItMatters: 'Resiliency clarity', complianceRefs: [], underwritingWeight: 'medium', simple: true },
	{ code: 'SHUNT-LBL', name: 'Hood shunt-trip/E-STOP signage & breaker ID', unit: 'ea system', verticals: ['Restaurants/Food Service'], whyItMatters: 'Fire suppression coordination', complianceRefs: [], underwritingWeight: 'high', simple: true },
	{ code: 'SPL-GFCI', name: 'Add/test GFCI at dish/prep zones (obvious gaps)', unit: 'ea device', verticals: ['Restaurants/Food Service'], whyItMatters: 'Shock/fire prevention', complianceRefs: [], underwritingWeight: 'high', simple: true },
	{ code: 'TR-RETRO', name: 'Tamper-resistant receptacle retrofit', unit: 'ea', verticals: ['Schools/Offices'], whyItMatters: 'Injury mitigation', complianceRefs: [], underwritingWeight: 'medium', simple: true },
	{ code: 'PMP-GFCI', name: 'Pool pump room GFCI audit & swaps', unit: 'ea circuit', verticals: ['YMCA/Natatorium/Pools'], whyItMatters: 'High moisture shock risk', complianceRefs: [], underwritingWeight: 'high', simple: true },
	{ code: 'WLD-ID', name: 'Welders/receptacles labeling & cover repair', unit: 'ea', verticals: ['Light Manufacturing/Warehouse'], whyItMatters: 'OCPD clarity & enclosure integrity', complianceRefs: [], underwritingWeight: 'medium', simple: true },
	{ code: 'CMP-CLN', name: 'Compressor starter/disconnect dust-out', unit: 'ea', verticals: ['Light Manufacturing/Warehouse'], whyItMatters: 'Dust overheating risk', complianceRefs: [], underwritingWeight: 'medium-high', simple: true },
	{ code: 'RTU-SUP', name: 'Add/repair conduit/whip supports/straps', unit: 'ea run', verticals: ['Rooftop/Exterior'], whyItMatters: 'Mechanical damage & strain relief', complianceRefs: [], underwritingWeight: 'medium', simple: true },
];

const complexItems: SeedItem[] = [
	{ code: 'GES-REMED', name: 'Grounding electrode system remediation (rods/Ufer/bonds)', unit: 'project', verticals: ['All Sites'], whyItMatters: 'Fault/lightning robustness', complianceRefs: ['NFPA 70B'], underwritingWeight: 'high', simple: false },
	{ code: 'IR-WND-INST', name: 'Install IR windows on key gear + method page', unit: 'project', verticals: ['All Sites'], whyItMatters: 'Safer repeat IR', complianceRefs: [], underwritingWeight: 'medium-high', simple: false },
	{ code: 'PQ-STUDY', name: 'Power quality/event monitoring (portable logger week)', unit: 'project', verticals: ['All Sites'], whyItMatters: 'Root cause of nuisance trips', complianceRefs: [], underwritingWeight: 'medium', simple: false },
	{ code: 'TEL-PKG', name: 'Electrical telemetry (meters/CTs + monthly report)', unit: 'project', verticals: ['All Sites'], whyItMatters: 'Trend-based risk visibility', complianceRefs: [], underwritingWeight: 'medium', simple: false },
	{ code: 'SVC-UPG', name: 'Service capacity/gear upgrade', unit: 'project', verticals: ['All Sites'], whyItMatters: 'Retire obsolete gear; capacity/safety', complianceRefs: [], underwritingWeight: 'high', simple: false },
	{ code: 'E-GAS-INT', name: 'Verify/repair gas & electric E-STOP interlocks (kitchen)', unit: 'project', verticals: ['Restaurants/Food Service'], whyItMatters: 'Life-safety interlocks', complianceRefs: [], underwritingWeight: 'high', simple: false },
	{ code: 'UPS-REPL', name: 'UPS battery string replacement (rack/telco)', unit: 'project', verticals: ['Schools/Offices'], whyItMatters: 'Continuity; runtime integrity', complianceRefs: [], underwritingWeight: 'medium', simple: false },
	{ code: 'NEMA-UPG', name: 'Enclosure upgrades to 4/4X w/ stainless hardware (zone)', unit: 'project', verticals: ['YMCA/Natatorium/Pools'], whyItMatters: 'Corrosion resistance in wet zones', complianceRefs: [], underwritingWeight: 'high', simple: false },
	{ code: 'MACH-ESTOP', name: 'Machine E-STOP circuit repair/labeling (per machine)', unit: 'project', verticals: ['Light Manufacturing/Warehouse'], whyItMatters: 'Injury/loss prevention', complianceRefs: [], underwritingWeight: 'high', simple: false },
	{ code: 'PF-PROJ', name: 'Power-factor correction / harmonic filters', unit: 'project', verticals: ['Light Manufacturing/Warehouse'], whyItMatters: 'Efficiency; demand charges', complianceRefs: [], underwritingWeight: 'low-medium', simple: false },
	{ code: 'PV-LBL', name: 'Solar PV labeling & rapid-shutdown signage remediation', unit: 'project', verticals: ['Rooftop/Exterior/Renewables/EV'], whyItMatters: 'Emergency response & code clarity', complianceRefs: [], underwritingWeight: 'medium', simple: false },
	{ code: 'EVSE-LOAD', name: 'EV charger load calc & panel/feed upgrade', unit: 'project', verticals: ['Rooftop/Exterior/Renewables/EV'], whyItMatters: 'Overload/fire risk mitigation', complianceRefs: [], underwritingWeight: 'medium-high', simple: false },
];

async function seed() {
	try {
		for (const item of [...simpleItems, ...complexItems]) {
			await query(
				`insert into catalog_items (code, name, unit, simple, verticals, why_it_matters, compliance_refs, underwriting_weight)
				 values ($1,$2,$3,$4,$5,$6,$7,$8)
				 on conflict (code) do update set name = excluded.name, unit = excluded.unit, simple = excluded.simple, verticals = excluded.verticals, why_it_matters = excluded.why_it_matters, compliance_refs = excluded.compliance_refs, underwriting_weight = excluded.underwriting_weight`,
				[
					item.code,
					item.name,
					item.unit,
					item.simple,
					JSON.stringify(item.verticals),
					item.whyItMatters,
					JSON.stringify(item.complianceRefs),
					item.underwritingWeight,
				],
			);
		}
		console.log('Seeded catalog items');
	} catch (e) {
		console.error(e);
		process.exitCode = 1;
	}
}

seed();


