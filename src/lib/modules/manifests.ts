/**
 * Every module known to the app. Adding a module = one import + one entry
 * here (keep one line per module so parallel branches merge cleanly).
 * Server-only: manifests import their API clients.
 */
import type { AnyModuleManifest } from "./types";
import { cpanelWhmModule } from "./server/cpanel-whm";
import { virtualizorModule } from "./server/virtualizor";
import { griModule } from "./registrar/gri";
import { cloudflareModule } from "./dns/cloudflare";
import { iyzicoModule, kuveytTurkModule, paytrModule, stripeModule } from "./payment";
import { parasutModule, uyumsoftModule } from "./einvoice";
import { iletiMerkeziModule, netgsmModule } from "./sms";

export const MODULE_MANIFESTS: readonly AnyModuleManifest[] = [
  // server
  cpanelWhmModule,
  virtualizorModule,
  // registrar
  griModule,
  // dns
  cloudflareModule,
  // payment (settings-backed)
  kuveytTurkModule,
  paytrModule,
  iyzicoModule,
  stripeModule,
  // einvoice (settings-backed)
  uyumsoftModule,
  parasutModule,
  // sms (settings-backed)
  netgsmModule,
  iletiMerkeziModule,
];
