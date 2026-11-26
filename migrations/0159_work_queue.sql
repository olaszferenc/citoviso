-- A scrape / felderítés job leírása a futás SAJÁT során (tulaj 2026-11-26: „a deploy prioritást élvez”).
-- Eddig a futó jobot csak a konzol memóriája (scrapeJob.ts) és a gyerek argv-je írta le: egy konzol-restart
-- (deploy, összeomlás) vagy a deploy szabályos leállítása után senki nem tudta, mit kell újraindítani.
--   job         — a run.ts maga írja indításkor (régió, --scout csempe, --cap, hányadik próbálkozás, melyik
--                 megszakadt futást folytatja); bárki indította (konzol, ssh-szkript).
--   resumed_at  — a konzol folytatója (src/console/scrapeResume.ts) ekkor vette kézbe a megszakadt futást;
--                 NULL = még folytatásra vár. A run.ts minden induláskor NULL-ra állítja a saját során.
-- Régi (job nélküli) futást a folytató sosem indít újra.
ALTER TABLE scrape_run
  ADD COLUMN IF NOT EXISTS job jsonb,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

CREATE INDEX IF NOT EXISTS scrape_run_resume_idx ON scrape_run (finished_at)
  WHERE job IS NOT NULL AND resumed_at IS NULL AND status = 'failed';

-- A KÜLÖN DOLGOZÓ feladatsora (citoviso-worker.service, src/worker/main.ts). A konzol csak sort tesz bele és
-- állapotot olvas; a konzol újraindítása (deploy) a dolgozót nem érinti.
--   dedupe_key — egy élő (queued/running) feladat egy kulcsra (pl. 'scout:<csempe>'): kétszeri sorba tétel = egy munka.
--   log        — a gyerekfolyamat utolsó sorai (a konzol élő naplója; a tartós rekord a scrape_run).
CREATE TABLE IF NOT EXISTS work_job (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('scrape', 'scout')),
  payload      jsonb NOT NULL,
  dedupe_key   text,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'interrupted')),
  attempts     integer NOT NULL DEFAULT 0,
  enqueued_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  heartbeat_at timestamptz,
  exit_code    integer,
  error        text,
  log          jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS work_job_live_key ON work_job (dedupe_key) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS work_job_queue_idx ON work_job (created_at) WHERE status = 'queued';

-- A dolgozó életjele: melyik kód-verzió fut (git HEAD indításkor), mikor vert utoljára, mit csinál.
-- A deploy GATE 4-e ezt méri a restart után (él-e, átállt-e az új kódra, vagy a folyó lépés végén áll át).
CREATE TABLE IF NOT EXISTS worker_state (
  name        text PRIMARY KEY,
  pid         integer NOT NULL,
  code_sha    text,
  started_at  timestamptz NOT NULL,
  beat_at     timestamptz NOT NULL,
  draining    boolean NOT NULL DEFAULT false,
  current_job uuid
);
