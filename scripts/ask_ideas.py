#!/usr/bin/env python3
"""Query compact idea cards from the contest KB with strict token budgeting.

Designed for AI assistants: returns only concise, high-signal context packs.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

DEFAULT_DB = r"C:\Users\quit\Desktop\contest-projects-kb\contest_projects.db"
DEFAULT_MEMORY = r"C:\Users\quit\Desktop\contest-projects-kb\ask_ideas_memory.json"


def normalize_fts_query(query: str) -> str:
    # Keep FTS syntax simple and resilient to punctuation (e.g. multi-agent).
    tokens = re.findall(r"[a-zA-Z0-9_]+", query.lower())
    if not tokens:
        return ""
    return " ".join(tokens)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Low-token idea search for AI")
    parser.add_argument("query", nargs="?", default="", help="Search query for ideas")
    parser.add_argument("--db-path", default=DEFAULT_DB, help="Path to contest KB SQLite")
    parser.add_argument("--chat", action="store_true", help="Start interactive conversational mode")
    parser.add_argument("--memory-path", default=DEFAULT_MEMORY, help="Path for chat/query memory JSON")
    parser.add_argument("--reset-memory", action="store_true", help="Reset saved query memory before running")
    parser.add_argument("--domain", default="", help="Optional domain tag filter, e.g. ai_agents")
    parser.add_argument("--stack", default="", help="Optional stack tag filter, e.g. python")
    parser.add_argument("--shortlist", type=int, default=40, help="FTS shortlist size before token packing")
    parser.add_argument("--max-items", type=int, default=12, help="Max cards included in final pack")
    parser.add_argument("--max-tokens", type=int, default=2200, help="Hard token budget for final pack")
    parser.add_argument("--out", default="", help="Optional output JSON file path")
    parser.add_argument(
        "--format",
        choices=["json", "prompt"],
        default="json",
        help="Output format: machine JSON or prompt-ready text",
    )
    return parser.parse_args()


def fetch_shortlist(
    conn: sqlite3.Connection,
    query: str,
    shortlist: int,
    domain: str,
    stack: str,
) -> List[Dict[str, Any]]:
    safe_query = normalize_fts_query(query)
    if not safe_query:
        return []

    sql = """
    SELECT
      ic.contest_slug,
      ic.project_id,
      ic.name,
      ic.track_name,
      ic.domain_tags,
      ic.stack_tags,
      ic.token_estimate,
      ic.problem_1l,
      ic.solution_1l,
      ic.novelty_1l,
      ic.risk_1l,
      ic.applicability_1l,
      bm25(idea_cards_fts) AS score
    FROM idea_cards_fts
    JOIN idea_cards ic ON ic.rowid = idea_cards_fts.rowid
    WHERE idea_cards_fts MATCH ?
      AND (? = '' OR ic.domain_tags LIKE '%' || ? || '%')
      AND (? = '' OR ic.stack_tags LIKE '%' || ? || '%')
    ORDER BY score ASC, ic.token_estimate ASC
    LIMIT ?
    """

    cur = conn.execute(sql, (safe_query, domain, domain, stack, stack, shortlist))
    cols = [d[0] for d in cur.description]
    out: List[Dict[str, Any]] = []
    for row in cur.fetchall():
        out.append(dict(zip(cols, row)))
    return out


def pack_by_budget(rows: List[Dict[str, Any]], max_items: int, max_tokens: int) -> List[Dict[str, Any]]:
    picked: List[Dict[str, Any]] = []
    used_tokens = 0

    for row in rows:
        t = int(row.get("token_estimate") or 0)
        if len(picked) >= max_items:
            break
        if used_tokens + t > max_tokens:
            continue
        picked.append(row)
        used_tokens += t

    return picked


def build_payload(
    query: str,
    domain: str,
    stack: str,
    shortlist_rows: List[Dict[str, Any]],
    selected_rows: List[Dict[str, Any]],
    max_items: int,
    max_tokens: int,
) -> Dict[str, Any]:
    used_tokens = sum(int(r.get("token_estimate") or 0) for r in selected_rows)

    compact_cards = []
    for r in selected_rows:
        compact_cards.append(
            {
                "id": f"{r['contest_slug']}:{r['project_id']}",
                "name": r["name"],
                "contest": r["contest_slug"],
                "track": r.get("track_name") or "",
                "domain_tags": (r.get("domain_tags") or "").split(",") if r.get("domain_tags") else [],
                "stack_tags": (r.get("stack_tags") or "").split(",") if r.get("stack_tags") else [],
                "problem": r["problem_1l"],
                "solution": r["solution_1l"],
                "novelty": r["novelty_1l"],
                "risk": r["risk_1l"],
                "applicability": r["applicability_1l"],
                "token_estimate": r["token_estimate"],
                "source_url": f"https://dorahacks.io/buidl/{r['project_id']}",
            }
        )

    return {
        "query": query,
        "filters": {
            "domain": domain,
            "stack": stack,
            "max_items": max_items,
            "max_tokens": max_tokens,
        },
        "stats": {
            "shortlist_count": len(shortlist_rows),
            "selected_count": len(selected_rows),
            "selected_tokens": used_tokens,
        },
        "instruction_for_ai": (
            "Use only the selected cards below. First synthesize patterns, then propose 5 ideas "
            "grounded in these examples. Do not assume details outside provided cards."
        ),
        "selected_cards": compact_cards,
    }


def to_prompt(payload: Dict[str, Any]) -> str:
    lines = []
    lines.append("SYSTEM INPUT: LOW-TOKEN IDEA PACK")
    lines.append(f"Query: {payload['query']}")
    lines.append(
        "Filters: "
        f"domain={payload['filters']['domain'] or '-'} "
        f"stack={payload['filters']['stack'] or '-'} "
        f"budget={payload['filters']['max_tokens']}"
    )
    lines.append(
        "Selected: "
        f"{payload['stats']['selected_count']} cards / "
        f"{payload['stats']['selected_tokens']} tokens"
    )
    lines.append("Task: Extract repeatable patterns and generate actionable idea variants.")
    lines.append("")

    for i, card in enumerate(payload["selected_cards"], start=1):
        lines.append(f"[{i}] {card['name']} ({card['contest']})")
        lines.append(f"Problem: {card['problem']}")
        lines.append(f"Solution: {card['solution']}")
        lines.append(f"Novelty: {card['novelty']}")
        lines.append(f"Tags: {', '.join(card['domain_tags'] + card['stack_tags'])}")
        lines.append(f"Risk: {card['risk']}")
        lines.append(f"Source: {card['source_url']}")
        lines.append("")

    return "\n".join(lines).strip()


def load_memory(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return raw
    except Exception:
        pass
    return {}


def save_memory(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True), encoding="utf-8")


def run_once(
    db_path: Path,
    query: str,
    domain: str,
    stack: str,
    shortlist: int,
    max_items: int,
    max_tokens: int,
    output_format: str,
) -> str:
    with sqlite3.connect(db_path) as conn:
        shortlist_rows = fetch_shortlist(
            conn=conn,
            query=query,
            shortlist=shortlist,
            domain=domain,
            stack=stack,
        )

    selected_rows = pack_by_budget(
        rows=shortlist_rows,
        max_items=max_items,
        max_tokens=max_tokens,
    )

    payload = build_payload(
        query=query,
        domain=domain,
        stack=stack,
        shortlist_rows=shortlist_rows,
        selected_rows=selected_rows,
        max_items=max_items,
        max_tokens=max_tokens,
    )

    text = json.dumps(payload, indent=2, ensure_ascii=True)
    if output_format == "prompt":
        text = to_prompt(payload)
    return text


def print_chat_help() -> None:
    print("Commands:")
    print("  /help                 Show commands")
    print("  /state                Show current memory/filters")
    print("  /domain <tag|->       Set/clear domain filter")
    print("  /stack <tag|->        Set/clear stack filter")
    print("  /budget <num>         Set max token budget")
    print("  /items <num>          Set max selected items")
    print("  /shortlist <num>      Set shortlist size")
    print("  /format <json|prompt> Set output format")
    print("  /reset                Reset in-memory session state")
    print("  /exit                 Quit chat mode")
    print("Tip: write a normal sentence to run search using current filters.")


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        # Some project titles include characters outside cp1252.
        print(text.encode("ascii", errors="replace").decode("ascii"))


def run_chat(args: argparse.Namespace, db_path: Path, memory_path: Path) -> int:
    memory = load_memory(memory_path)
    state = {
        "last_query": memory.get("last_query", args.query.strip()),
        "domain": args.domain.strip() or memory.get("domain", ""),
        "stack": args.stack.strip() or memory.get("stack", ""),
        "shortlist": int(args.shortlist or memory.get("shortlist", 40)),
        "max_items": int(args.max_items or memory.get("max_items", 12)),
        "max_tokens": int(args.max_tokens or memory.get("max_tokens", 2200)),
        "format": args.format or memory.get("format", "json"),
        "history": memory.get("history", []),
    }

    print("ask_ideas chat mode active. Type /help for commands.")
    while True:
        prompt = (
            f"query[{state['last_query'] or '-'}] "
            f"domain[{state['domain'] or '-'}] "
            f"stack[{state['stack'] or '-'}] > "
        )
        try:
            raw = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting chat mode.")
            break

        if not raw:
            if not state["last_query"]:
                print("No query yet. Type a query or /help.")
                continue
            raw = state["last_query"]

        if raw.startswith("/"):
            parts = raw.split(maxsplit=1)
            cmd = parts[0].lower()
            value = parts[1].strip() if len(parts) > 1 else ""

            if cmd in {"/exit", "/quit"}:
                break
            if cmd == "/help":
                print_chat_help()
                continue
            if cmd == "/state":
                print(json.dumps({k: state[k] for k in state if k != "history"}, indent=2, ensure_ascii=True))
                print(f"history_count={len(state['history'])}")
                continue
            if cmd == "/reset":
                state.update(
                    {
                        "last_query": "",
                        "domain": "",
                        "stack": "",
                        "shortlist": 40,
                        "max_items": 12,
                        "max_tokens": 2200,
                        "format": "json",
                    }
                )
                print("Session state reset.")
                continue
            if cmd == "/domain":
                state["domain"] = "" if value in {"", "-", "none"} else value
                print(f"domain={state['domain'] or '-'}")
                continue
            if cmd == "/stack":
                state["stack"] = "" if value in {"", "-", "none"} else value
                print(f"stack={state['stack'] or '-'}")
                continue
            if cmd == "/budget":
                try:
                    state["max_tokens"] = max(1, int(value))
                    print(f"max_tokens={state['max_tokens']}")
                except ValueError:
                    print("Invalid number for /budget")
                continue
            if cmd == "/items":
                try:
                    state["max_items"] = max(1, int(value))
                    print(f"max_items={state['max_items']}")
                except ValueError:
                    print("Invalid number for /items")
                continue
            if cmd == "/shortlist":
                try:
                    state["shortlist"] = max(1, int(value))
                    print(f"shortlist={state['shortlist']}")
                except ValueError:
                    print("Invalid number for /shortlist")
                continue
            if cmd == "/format":
                if value not in {"json", "prompt"}:
                    print("/format expects json or prompt")
                else:
                    state["format"] = value
                    print(f"format={state['format']}")
                continue

            print("Unknown command. Use /help.")
            continue

        state["last_query"] = raw
        text = run_once(
            db_path=db_path,
            query=state["last_query"],
            domain=state["domain"],
            stack=state["stack"],
            shortlist=state["shortlist"],
            max_items=state["max_items"],
            max_tokens=state["max_tokens"],
            output_format=state["format"],
        )
        safe_print(text)

        state["history"].append(
            {
                "query": state["last_query"],
                "domain": state["domain"],
                "stack": state["stack"],
                "format": state["format"],
                "max_items": state["max_items"],
                "max_tokens": state["max_tokens"],
            }
        )
        state["history"] = state["history"][-50:]
        save_memory(memory_path, state)

    save_memory(memory_path, state)
    return 0


def main() -> int:
    args = parse_args()
    db_path = Path(args.db_path)
    if not db_path.exists():
        raise SystemExit(f"DB not found: {db_path}")

    memory_path = Path(args.memory_path)
    if args.reset_memory and memory_path.exists():
        memory_path.unlink()

    if args.chat:
        return run_chat(args, db_path, memory_path)

    query = args.query.strip()
    if not query:
        raise SystemExit("Query is required in non-chat mode. Provide query or use --chat.")

    text = run_once(
        db_path=db_path,
        query=query,
        domain=args.domain.strip(),
        stack=args.stack.strip(),
        shortlist=args.shortlist,
        max_items=args.max_items,
        max_tokens=args.max_tokens,
        output_format=args.format,
    )

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
    else:
        print(text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
