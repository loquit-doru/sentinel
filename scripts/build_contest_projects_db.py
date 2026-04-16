#!/usr/bin/env python3
"""Build a local contest-project knowledge base from DoraHacks hackathon BUIDLs.

This script fetches all paginated projects for a given hackathon slug and
creates:
1) A SQLite database for fast querying/reuse
2) A JSON export for portability and quick inspection
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_BASE = "https://dorahacks.io/api/hackathon-buidls"


def fetch_json(url: str) -> Dict[str, Any]:
    req = Request(
        url,
        headers={
            "User-Agent": "sentinel-contest-kb/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
    return json.loads(payload)


def fetch_all_projects(slug: str, page_size: int = 24) -> List[Dict[str, Any]]:
    page = 1
    all_rows: List[Dict[str, Any]] = []

    while True:
        query = urlencode({"page": page, "page_size": page_size})
        url = f"{API_BASE}/{slug}/?{query}"
        data = fetch_json(url)

        results = data.get("results", [])
        if not isinstance(results, list):
            raise RuntimeError(f"Unexpected API response format at page={page}")

        all_rows.extend(results)
        if not data.get("next"):
            break
        page += 1

    return all_rows


def first_track_name(project: Dict[str, Any]) -> Optional[str]:
    track_objs = project.get("track_objs")
    if isinstance(track_objs, list) and track_objs:
        first = track_objs[0]
        if isinstance(first, dict):
            name = first.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()

    track_obj = project.get("track_obj")
    if isinstance(track_obj, dict):
        name = track_obj.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()

    return None


def normalize_project(slug: str, p: Dict[str, Any]) -> Dict[str, Any]:
    pid = p.get("id")
    if pid is None:
        raise RuntimeError("Project without id encountered")

    owner = p.get("owner") if isinstance(p.get("owner"), dict) else {}
    pictures = p.get("pictures") if isinstance(p.get("pictures"), list) else []
    social_links = p.get("social_links") if isinstance(p.get("social_links"), list) else []

    vision = (p.get("vision") or "").strip()
    project_description = (p.get("project_description") or "").strip()
    idea_summary = vision if vision else project_description[:320]

    return {
        "contest_slug": slug,
        "project_id": int(pid),
        "name": (p.get("name") or "").strip(),
        "owner_username": owner.get("username"),
        "owner_nick_name": owner.get("nick_name"),
        "idea_summary": idea_summary,
        "vision": vision,
        "project_description": project_description,
        "team_description": (p.get("team_description") or "").strip(),
        "github_page": (p.get("github_page") or "").strip(),
        "demo_link": (p.get("demo_link") or "").strip(),
        "demo_video": (p.get("demo_video") or "").strip(),
        "track_name": first_track_name(p),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),
        "buidl_url": f"https://dorahacks.io/buidl/{int(pid)}",
        "api_source_url": f"{API_BASE}/{slug}/",
        "picture_url": pictures[0] if pictures else None,
        "social_links_json": json.dumps(social_links, ensure_ascii=True),
        "raw_json": json.dumps(p, ensure_ascii=True),
    }


def create_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
          contest_slug TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          owner_username TEXT,
          owner_nick_name TEXT,
          idea_summary TEXT,
          vision TEXT,
          project_description TEXT,
          team_description TEXT,
          github_page TEXT,
          demo_link TEXT,
          demo_video TEXT,
          track_name TEXT,
          created_at TEXT,
          updated_at TEXT,
          buidl_url TEXT NOT NULL,
          api_source_url TEXT NOT NULL,
          picture_url TEXT,
          social_links_json TEXT,
          raw_json TEXT NOT NULL,
          imported_at_utc TEXT NOT NULL,
          PRIMARY KEY (contest_slug, project_id)
        );
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_projects_contest_track
          ON projects(contest_slug, track_name);
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_projects_contest_name
          ON projects(contest_slug, name);
        """
    )


def upsert_projects(conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> None:
    imported_at_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    data = [
        (
            r["contest_slug"],
            r["project_id"],
            r["name"],
            r["owner_username"],
            r["owner_nick_name"],
            r["idea_summary"],
            r["vision"],
            r["project_description"],
            r["team_description"],
            r["github_page"],
            r["demo_link"],
            r["demo_video"],
            r["track_name"],
            r["created_at"],
            r["updated_at"],
            r["buidl_url"],
            r["api_source_url"],
            r["picture_url"],
            r["social_links_json"],
            r["raw_json"],
            imported_at_utc,
        )
        for r in rows
    ]

    conn.executemany(
        """
        INSERT INTO projects (
          contest_slug, project_id, name, owner_username, owner_nick_name,
          idea_summary, vision, project_description, team_description,
          github_page, demo_link, demo_video, track_name,
          created_at, updated_at, buidl_url, api_source_url,
          picture_url, social_links_json, raw_json, imported_at_utc
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
        ON CONFLICT(contest_slug, project_id) DO UPDATE SET
          name=excluded.name,
          owner_username=excluded.owner_username,
          owner_nick_name=excluded.owner_nick_name,
          idea_summary=excluded.idea_summary,
          vision=excluded.vision,
          project_description=excluded.project_description,
          team_description=excluded.team_description,
          github_page=excluded.github_page,
          demo_link=excluded.demo_link,
          demo_video=excluded.demo_video,
          track_name=excluded.track_name,
          created_at=excluded.created_at,
          updated_at=excluded.updated_at,
          buidl_url=excluded.buidl_url,
          api_source_url=excluded.api_source_url,
          picture_url=excluded.picture_url,
          social_links_json=excluded.social_links_json,
          raw_json=excluded.raw_json,
          imported_at_utc=excluded.imported_at_utc;
        """,
        data,
    )


def write_json_export(path: Path, rows: List[Dict[str, Any]]) -> None:
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "count": len(rows),
        "projects": rows,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build SQLite/JSON contest knowledge base from DoraHacks BUIDLs"
    )
    parser.add_argument("--slug", default="genlayer-bradbury", help="Hackathon slug")
    parser.add_argument(
        "--raw-json",
        default="data/contest-kb/genlayer-bradbury-raw.json",
        help="Optional pre-fetched raw JSON (if present, importer reads from it)",
    )
    parser.add_argument(
        "--db-path",
        default="data/contest-kb/contest_projects.db",
        help="Output SQLite path",
    )
    parser.add_argument(
        "--json-path",
        default="data/contest-kb/genlayer-bradbury-projects.json",
        help="Output JSON export path",
    )
    args = parser.parse_args()

    try:
        raw_json_path = Path(args.raw_json)
        if raw_json_path.exists():
            raw_payload = json.loads(raw_json_path.read_text(encoding="utf-8"))
            raw = raw_payload.get("projects", [])
            if not isinstance(raw, list):
                raise RuntimeError(f"Invalid projects array in {raw_json_path}")
        else:
            raw = fetch_all_projects(args.slug)
        rows = [normalize_project(args.slug, p) for p in raw]

        db_path = Path(args.db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            create_schema(conn)
            upsert_projects(conn, rows)
            conn.commit()

        write_json_export(Path(args.json_path), rows)

        print(
            f"Imported {len(rows)} projects for '{args.slug}' -> "
            f"DB: {db_path} | JSON: {args.json_path}"
        )
        return 0
    except Exception as exc:
        print(f"Failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
