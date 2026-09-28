import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * O login de convidado não tem limite de cadastros, então a base é podada todo
 * dia: contas anônimas que nunca criaram um espaço de trabalho e têm mais de
 * sete dias vão embora, com sessões e códigos pendentes.
 */
crons.interval(
  "limpar convidados abandonados",
  { hours: 24 },
  internal.housekeeping.pruneAbandonedGuests,
  {},
);

export default crons;
