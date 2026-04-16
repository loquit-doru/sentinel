#!/usr/bin/env python3
"""Build a low-token retrieval layer on top of the contest projects SQLite DB.

This script creates compact idea cards + canonical tags + FTS indexes so an AI
assistant can search efficiently without loading large raw descriptions.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Set, Tuple


CANONICAL_DOMAIN_RULES: Dict[str, Sequence[str]] = {
    "ai_agents": ("agent", "multi-agent", "autonomous", "llm", "assistant", "langgraph"),
    "defi": ("defi", "dex", "yield", "liquidity", "lending", "borrow", "amm", "staking"),
    "payments": ("payment", "paywall", "x402", "invoice", "checkout", "stablecoin", "usdc"),
    "trading": ("trading", "market making", "alpha", "portfolio", "signal", "quant"),
    "security": ("security", "audit", "fraud", "phishing", "kyc", "compliance", "risk"),
    "infra": ("infrastructure", "rpc", "indexer", "rollup", "zk", "bridge", "oracle"),
    "data_analytics": ("analytics", "dashboard", "insight", "metrics", "visualization", "dataset"),
    "identity": ("identity", "credential", "passport", "attestation", "soulbound"),
    "gaming": ("game", "gaming", "quest", "nft game", "leaderboard"),
    "social": ("social", "community", "creator", "messaging", "chat", "dao forum"),
    "education": ("education", "learning", "school", "course", "training"),
    "health": ("health", "medical", "patient", "clinic", "wellness"),
    "developer_tools": ("sdk", "api", "devtool", "framework", "plugin", "cli"),
}

CANONICAL_STACK_RULES: Dict[str, Sequence[str]] = {
    "python": ("python",),
    "typescript": ("typescript", "ts", "node", "next.js", "vite"),
    "javascript": ("javascript", "js"),
    "solidity": ("solidity", "evm", "smart contract"),
    "rust": ("rust", "solana"),
    "move": ("move", "aptos", "sui"),
    "react": ("react",),
    "cloudflare": ("cloudflare", "worker", "wrangler"),
    "llm": ("llm", "gpt", "claude", "langchain", "rag", "embedding"),
    "telegram": ("telegram", "bot"),
    "postgres": ("postgres", "postgresql"),
    "sqlite": ("sqlite",),
}

FALLBACK_DOMAIN = "general"


def clean_text(value: str) -> str:
    text = value or ""
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"[#*_>|-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clip(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    clipped = text[: max_chars - 1].rstrip()
    return f"{clipped}..."


def first_sentence(text: str, max_chars: int) -> str:
    cleaned = clean_text(text)
    if not cleaned:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    best = parts[0] if parts else cleaned
    return clip(best, max_chars)


def extract_tags(haystack: str, rules: Dict[str, Sequence[str]]) -> List[str]:
    lowered = haystack.lower()
    tags: List[str] = []
    for tag, needles in rules.items():
        if any(n in lowered for n in needles):
            tags.append(tag)
    return tags


def infer_risk(has_code: bool, has_demo: bool, content: str) -> str:
    lowered = content.lower()
    flags = 0
    if not has_code:
        flags += 1
    if not has_demo:
        flags += 1
    if any(w in lowered for w in ("experimental", "prototype", "todo", "coming soon", "wip")):
        flags += 1

    if flags <= 0:
        return "Low implementation risk: code and demo are available."
    if flags == 1:
        return "Moderate risk: one delivery signal is missing (code or demo)."
    return "Higher execution risk: limited delivery proof (missing code/demo or marked experimental)."


def build_short_fields(
    name: str,
    summary: str,
    vision: str,
    description: str,
    track: str,
    tags: Sequence[str],
    stack: Sequence[str],
    has_code: bool,
    has_demo: bool,
) -> Tuple[str, str, str, str, str, str, int]:
    combined = " ".join(x for x in (summary, vision, description) if x)
    combined = clean_text(combined)

    problem = first_sentence(summary or description or combined, 180)
    if not problem:
        problem = "Addresses a practical workflow pain-point in its target market."

    solution = first_sentence(vision or description or combined, 180)
    if not solution:
        solution = f"{name} proposes a focused implementation for this use case."

    novelty = "Combines "
    novelty += ", ".join(tags[:2] + list(stack[:2])) if (tags or stack) else "a compact idea with practical execution"
    novelty += " in a hackathon-ready format."
    novelty = clip(novelty, 170)

    risk = infer_risk(has_code, has_demo, combined)

    applicability = "Useful for teams needing a quick MVP blueprint in "
    applicability += tags[0] if tags else track or "general product"
    applicability += "."
    applicability = clip(applicability, 150)

    card = {
        "name": name,
        "problem": problem,
        "solution": solution,
        "novelty": novelty,
        "risk": risk,
        "applicability": applicability,
        "tags": list(tags),
        "stack": list(stack),
    }
    card_json = json.dumps(card, ensure_ascii=True, separators=(",", ":"))
    token_estimate = math.ceil(len(card_json.split()) * 1.3)

    return problem, solution, novelty, risk, applicability, card_json, token_estimate


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS idea_cards (
          contest_slug TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          track_name TEXT,
          domain_tags TEXT NOT NULL,
          stack_tags TEXT NOT NULL,
          problem_1l TEXT NOT NULL,
          solution_1l TEXT NOT NULL,
          novelty_1l TEXT NOT NULL,
          risk_1l TEXT NOT NULL,
          applicability_1l TEXT NOT NULL,
          card_json TEXT NOT NULL,
          token_estimate INTEGER NOT NULL,
          has_code INTEGER NOT NULL,
          has_demo INTEGER NOT NULL,
          updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
          PRIMARY KEY (contest_slug, project_id)
        );

        CREATE TABLE IF NOT EXISTS idea_card_tags (
          contest_slug TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          tag TEXT NOT NULL,
          tag_type TEXT NOT NULL,
          PRIMARY KEY (contest_slug, project_id, tag, tag_type)
        );

        CREATE INDEX IF NOT EXISTS idx_idea_cards_domain_tags ON idea_cards(domain_tags);
        CREATE INDEX IF NOT EXISTS idx_idea_cards_stack_tags ON idea_cards(stack_tags);
        CREATE INDEX IF NOT EXISTS idx_idea_cards_token_estimate ON idea_cards(token_estimate);
        CREATE INDEX IF NOT EXISTS idx_idea_card_tags_tag ON idea_card_tags(tag, tag_type);

        CREATE VIRTUAL TABLE IF NOT EXISTS idea_cards_fts USING fts5(
          contest_slug UNINDEXED,
          project_id UNINDEXED,
          name,
          track_name,
          problem_1l,
          solution_1l,
          novelty_1l,
          domain_tags,
          stack_tags,
          content,
          tokenize='porter unicode61'
        );

        CREATE VIEW IF NOT EXISTS v_low_token_cards AS
        SELECT
          contest_slug,
          project_id,
          name,
          track_name,
          domain_tags,
          stack_tags,
          token_estimate,
          problem_1l,
          solution_1l,
          novelty_1l,
          risk_1l,
          applicability_1l,
          card_json
        FROM idea_cards;
        """
    )


def refresh_data(conn: sqlite3.Connection) -> Tuple[int, int]:
    rows = conn.execute(
        """
        SELECT
          contest_slug,
          project_id,
          name,
          COALESCE(track_name, ''),
          COALESCE(idea_summary, ''),
          COALESCE(vision, ''),
          COALESCE(project_description, ''),
          COALESCE(github_page, ''),
          COALESCE(demo_link, ''),
          COALESCE(demo_video, '')
        FROM projects
        """
    ).fetchall()

    conn.execute("DELETE FROM idea_cards")
    conn.execute("DELETE FROM idea_card_tags")
    conn.execute("DELETE FROM idea_cards_fts")

    card_count = 0
    total_tokens = 0

    for (
        contest_slug,
        project_id,
        name,
        track_name,
        idea_summary,
        vision,
        description,
        github_page,
        demo_link,
        demo_video,
    ) in rows:
        name_c = clean_text(name)
        track_c = clean_text(track_name)
        summary_c = clean_text(idea_summary)
        vision_c = clean_text(vision)
        desc_c = clean_text(description)
        text_for_tags = " ".join([name_c, track_c, summary_c, vision_c, desc_c])

        domain_tags = extract_tags(text_for_tags, CANONICAL_DOMAIN_RULES)
        stack_tags = extract_tags(text_for_tags + f" {github_page} {demo_link} {demo_video}", CANONICAL_STACK_RULES)

        if not domain_tags:
            domain_tags = [FALLBACK_DOMAIN]

        domain_tags = sorted(set(domain_tags))[:8]
        stack_tags = sorted(set(stack_tags))[:8]

        has_code = 1 if github_page.strip() else 0
        has_demo = 1 if (demo_link.strip() or demo_video.strip()) else 0

        (
            problem,
            solution,
            novelty,
            risk,
            applicability,
            card_json,
            token_estimate,
        ) = build_short_fields(
            name=name_c,
            summary=summary_c,
            vision=vision_c,
            description=desc_c,
            track=track_c,
            tags=domain_tags,
            stack=stack_tags,
            has_code=bool(has_code),
            has_demo=bool(has_demo),
        )

        conn.execute(
            """
            INSERT INTO idea_cards (
              contest_slug, project_id, name, track_name,
              domain_tags, stack_tags,
              problem_1l, solution_1l, novelty_1l, risk_1l, applicability_1l,
              card_json, token_estimate, has_code, has_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                contest_slug,
                project_id,
                name_c,
                track_c,
                ",".join(domain_tags),
                ",".join(stack_tags),
                problem,
                solution,
                novelty,
                risk,
                applicability,
                card_json,
                token_estimate,
                has_code,
                has_demo,
            ),
        )

        for tag in domain_tags:
            conn.execute(
                "INSERT INTO idea_card_tags (contest_slug, project_id, tag, tag_type) VALUES (?, ?, ?, 'domain')",
                (contest_slug, project_id, tag),
            )
        for tag in stack_tags:
            conn.execute(
                "INSERT INTO idea_card_tags (contest_slug, project_id, tag, tag_type) VALUES (?, ?, ?, 'stack')",
                (contest_slug, project_id, tag),
            )

        fts_content = " | ".join([name_c, track_c, problem, solution, novelty, ",".join(domain_tags), ",".join(stack_tags)])
        conn.execute(
            """
            INSERT INTO idea_cards_fts (
              rowid, contest_slug, project_id, name, track_name,
              problem_1l, solution_1l, novelty_1l, domain_tags, stack_tags, content
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                card_count + 1,
                contest_slug,
                project_id,
                name_c,
                track_c,
                problem,
                solution,
                novelty,
                ",".join(domain_tags),
                ",".join(stack_tags),
                fts_content,
            ),
        )

        card_count += 1
        total_tokens += token_estimate

    return card_count, total_tokens


def write_outputs(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    taxonomy = {
        "domain_tags": sorted(CANONICAL_DOMAIN_RULES.keys()) + [FALLBACK_DOMAIN],
        "stack_tags": sorted(CANONICAL_STACK_RULES.keys()),
    }
    (output_dir / "canonical_tags.json").write_text(
        json.dumps(taxonomy, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )

    query_text = """-- Low-token retrieval queries (SQLite)

-- 1) Fast lexical + semantic shortlist (recommended first step)
-- Replace :q with query text, e.g. 'ai trading risk engine'
SELECT
  ic.contest_slug,
  ic.project_id,
  ic.name,
  ic.domain_tags,
  ic.stack_tags,
  ic.token_estimate,
  snippet(idea_cards_fts, 10, '[', ']', '...', 12) AS match_preview
FROM idea_cards_fts
JOIN idea_cards ic ON ic.rowid = idea_cards_fts.rowid
WHERE idea_cards_fts MATCH :q
ORDER BY rank
LIMIT 30;

-- 2) Budget gate: send only compact cards to LLM
SELECT
  contest_slug,
  project_id,
  name,
  card_json,
  token_estimate
FROM v_low_token_cards
WHERE token_estimate <= 220
ORDER BY token_estimate ASC
LIMIT 12;

-- 3) Domain+stack filter before semantic ranking
SELECT
  contest_slug,
  project_id,
  name,
  domain_tags,
  stack_tags,
  token_estimate,
  problem_1l,
  solution_1l
FROM v_low_token_cards
WHERE domain_tags LIKE '%' || :domain || '%'
  AND stack_tags LIKE '%' || :stack || '%'
ORDER BY token_estimate ASC
LIMIT 40;

-- 4) Final context pack (top-k cards, deterministic order)
-- Provide only these rows to the model.
SELECT
  contest_slug,
  project_id,
  name,
  problem_1l,
  solution_1l,
  novelty_1l,
  risk_1l,
  applicability_1l,
  domain_tags,
  stack_tags,
  token_estimate
FROM v_low_token_cards
WHERE project_id IN (
  -- fill with selected IDs from step #1/#3
  0
)
ORDER BY token_estimate ASC;

-- 5) Quick health checks
SELECT COUNT(*) AS cards, AVG(token_estimate) AS avg_tokens, MAX(token_estimate) AS max_tokens
FROM idea_cards;

SELECT tag, COUNT(*) AS c
FROM idea_card_tags
WHERE tag_type = 'domain'
GROUP BY tag
ORDER BY c DESC;
"""
    (output_dir / "search_queries_low_token.sql").write_text(query_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build low-token search layer for contest KB")
    parser.add_argument(
        "--db-path",
        default=r"C:\Users\quit\Desktop\contest-projects-kb\contest_projects.db",
        help="Path to contest projects SQLite DB",
    )
    parser.add_argument(
        "--output-dir",
        default=r"C:\Users\quit\Desktop\contest-projects-kb",
        help="Where to write helper files",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path)
    if not db_path.exists():
        raise SystemExit(f"DB not found: {db_path}")

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        cards, total_tokens = refresh_data(conn)
        conn.commit()

    write_outputs(Path(args.output_dir))

    avg_tokens = (total_tokens / cards) if cards else 0.0
    print(f"Low-token layer built: cards={cards} avg_tokens={avg_tokens:.1f} total_tokens={total_tokens}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
