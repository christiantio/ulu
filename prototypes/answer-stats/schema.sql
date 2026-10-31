-- THROWAWAY PROTOTYPE (issue #17). Not production code.
-- D1 (SQLite) schema for anonymous answer stats. See docs/adr/001-answer-stats-backend.md.
--
-- Two kinds of data:
--   * submissions, guesses: raw, one row per device per prompt per day. They exist only to dedupe while a
--     day is open, and the cron deletes them once the day closes (so they live about a day).
--   * answer_counts, guess_counts: aggregates with no device information, kept by triggers in the same
--     transaction as the raw insert. answer_counts is kept indefinitely; guess_counts for 30 days.

-- First submission wins: the primary key is the dedupe rule (one per device per prompt per day)
CREATE TABLE IF NOT EXISTS submissions (
  date        TEXT    NOT NULL,  -- Singapore date of the dive, YYYY-MM-DD
  prompt_id   TEXT    NOT NULL,
  device_hash TEXT    NOT NULL,  -- HMAC-SHA256(secret, date + ':' + deviceId), first 32 hex chars
  answer_key  TEXT    NOT NULL,  -- normalize(canonical name); '' for a miss
  created_at  INTEGER NOT NULL,  -- unix ms
  PRIMARY KEY (date, prompt_id, device_hash)
) WITHOUT ROWID;

-- Rejected guesses, counted once per device per prompt per day
CREATE TABLE IF NOT EXISTS guesses (
  date        TEXT NOT NULL,
  prompt_id   TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  guess_key   TEXT NOT NULL,     -- normalize(guess)
  guess_text  TEXT NOT NULL,     -- trimmed, at most 40 chars, scrubbed of email/phone/NRIC shapes
  PRIMARY KEY (date, prompt_id, device_hash, guess_key)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS answer_counts (
  date       TEXT    NOT NULL,
  prompt_id  TEXT    NOT NULL,
  answer_key TEXT    NOT NULL,   -- '' counts misses
  count      INTEGER NOT NULL,
  PRIMARY KEY (date, prompt_id, answer_key)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS guess_counts (
  date       TEXT    NOT NULL,
  prompt_id  TEXT    NOT NULL,
  guess_key  TEXT    NOT NULL,
  guess_text TEXT    NOT NULL,   -- the first spelling seen
  devices    INTEGER NOT NULL,
  PRIMARY KEY (date, prompt_id, guess_key)
) WITHOUT ROWID;

-- Counters move only when a raw row is actually inserted, so a duplicate (INSERT OR IGNORE) never counts
CREATE TRIGGER IF NOT EXISTS count_submission AFTER INSERT ON submissions
BEGIN
  INSERT INTO answer_counts (date, prompt_id, answer_key, count)
  VALUES (NEW.date, NEW.prompt_id, NEW.answer_key, 1)
  ON CONFLICT (date, prompt_id, answer_key) DO UPDATE SET count = count + 1;
END;

CREATE TRIGGER IF NOT EXISTS count_guess AFTER INSERT ON guesses
BEGIN
  INSERT INTO guess_counts (date, prompt_id, guess_key, guess_text, devices)
  VALUES (NEW.date, NEW.prompt_id, NEW.guess_key, NEW.guess_text, 1)
  ON CONFLICT (date, prompt_id, guess_key) DO UPDATE SET devices = devices + 1;
END;

-- Unrecognised guesses worth a human look, over the 30 days guess_counts is kept: typed by at least
-- 5 different devices AND by at least 1% of that prompt's plays over the same days
DROP VIEW IF EXISTS review_queue;
CREATE VIEW review_queue AS
WITH plays AS (
  SELECT prompt_id, SUM(count) AS plays
  FROM answer_counts
  WHERE date >= date('now', '+8 hours', '-30 days')
  GROUP BY prompt_id
),
g AS (
  SELECT prompt_id, guess_key, MIN(guess_text) AS example, SUM(devices) AS devices
  FROM guess_counts
  WHERE date >= date('now', '+8 hours', '-30 days')
  GROUP BY prompt_id, guess_key
)
SELECT g.prompt_id, g.guess_key, g.example, g.devices, p.plays,
       ROUND(100.0 * g.devices / p.plays, 1) AS pct_of_plays
FROM g JOIN plays p USING (prompt_id)
WHERE g.devices >= 5 AND g.devices * 100 >= p.plays
ORDER BY g.devices DESC;
