import { createKitLedger, createUnboardedLedger } from "./kits";
import type { LedgerState } from "./types";

export function createSampleLedger(): LedgerState {
  return createKitLedger({ trade: "tuition", sample: true });
}

export function createBlankLedger(): LedgerState {
  return createKitLedger({ trade: "tuition", sample: false, name: "My business", owner: "", city: "" });
}

export { createUnboardedLedger };
