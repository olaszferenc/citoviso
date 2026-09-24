// Read-only probe for the parallel gate phase (hooks/pre-commit + scripts/lib/gate-runner.mjs).
//
// In the parallel phase every gate runs with PGOPTIONS='-c default_transaction_read_only=on',
// so Postgres itself refuses any write (SQLSTATE 25006). That alone makes the phase SAFE —
// no gate can disturb another gate's rows — but not yet HONEST: a gate may catch the refused
// write, carry on and go green on a fixture it never managed to set up. So the runner must
// learn about EVERY refused write, whether the gate reports it or not.
//
// This module is loaded through NODE_OPTIONS=--import (inherited by every node process the
// gate spawns, servers included) and wraps pg's Client#query: any error with SQLSTATE 25006
// is appended to $CIT_GATE_RO_MARK. The runner discards the parallel verdict of such a gate
// and re-runs it in the serial writer phase, without the read-only option.
//
// The wrapper only OBSERVES: the original promise / callback / error travel unchanged.

import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";

const MARK = process.env.CIT_GATE_RO_MARK;

function note(err) {
  if (!err || err.code !== "25006") return;
  try {
    appendFileSync(MARK, `${process.pid} ${String(err.message).slice(0, 200)}\n`);
  } catch {
    // The marker dir is gone only after the runner finished — nothing left to tell.
  }
}

if (MARK) {
  let pg = null;
  try {
    pg = createRequire(`${process.cwd()}/`)("pg");
  } catch {
    pg = null;
  }
  const proto = pg && pg.Client && pg.Client.prototype;
  if (proto && !proto.__citRoProbe) {
    const orig = proto.query;
    proto.query = function citRoProbeQuery(...args) {
      const last = args[args.length - 1];
      if (typeof last === "function") {
        args[args.length - 1] = function (err, ...rest) {
          note(err);
          return last.call(this, err, ...rest);
        };
        return orig.apply(this, args);
      }
      const cfg = args[0];
      if (cfg && typeof cfg === "object" && typeof cfg.callback === "function") {
        const cb = cfg.callback;
        cfg.callback = function (err, ...rest) {
          note(err);
          return cb.call(this, err, ...rest);
        };
      }
      const res = orig.apply(this, args);
      if (res && typeof res.then === "function") res.then(undefined, note);
      else if (res && typeof res.on === "function") res.on("error", note);
      return res;
    };
    proto.__citRoProbe = true;
  }
}
