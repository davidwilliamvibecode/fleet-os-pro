/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as drivers from "../drivers.js";
import type * as errors from "../errors.js";
import type * as export_ from "../export.js";
import type * as fleet from "../fleet.js";
import type * as housekeeping from "../housekeeping.js";
import type * as http from "../http.js";
import type * as limits from "../limits.js";
import type * as logbook from "../logbook.js";
import type * as maintenance from "../maintenance.js";
import type * as rateLimit from "../rateLimit.js";
import type * as schema from "../schema.js";
import type * as support from "../support.js";
import type * as team from "../team.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  access: typeof access;
  auth: typeof auth;
  constants: typeof constants;
  crons: typeof crons;
  drivers: typeof drivers;
  errors: typeof errors;
  export: typeof export_;
  fleet: typeof fleet;
  housekeeping: typeof housekeeping;
  http: typeof http;
  limits: typeof limits;
  logbook: typeof logbook;
  maintenance: typeof maintenance;
  rateLimit: typeof rateLimit;
  schema: typeof schema;
  support: typeof support;
  team: typeof team;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
