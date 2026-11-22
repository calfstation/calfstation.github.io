#!/usr/bin/env python3
"""Safely create Firebase RTDB counter rows for newly published CALF patch posts.

Source: home-feed.json['patchArchive'] (the COMPLETE Korean patch archive).
Existing /items children, including 25 historical estimates, are never modified.
A service-account credential is needed to create new rows; client rules stay closed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

DB_URL = "https://calf-station-default-rtdb.asia-southeast1.firebasedatabase.app"
PROJECT_ID = "calf-station"
POST_PATH = re.compile(r"^/([1-9][0-9]{0,7})$")
DEFAULT_FEED = Path(__file__).resolve().parents[1] / "home-feed.json"
# Twenty-five records established on 2026-11-17. Fail closed instead of
# accidentally duplicating them if a legacy data migration went wrong.
LEGACY_POST_IDS = {
    "6", "8", "17", "20", "39", "40", "54", "55", "56", "57", "58",
    "61", "65", "66", "75", "76", "80", "81", "86", "93", "95",
    "97", "98", "103", "104",
}


def feed_posts(feed: dict) -> dict[str, dict]:
    """Only trusted, uniquely numbered posts from the full patch archive."""
    if not isinstance(feed, dict):
        raise ValueError("home-feed.json must contain an object")
    posts = feed.get("patchArchive")
    if not isinstance(posts, list) or not posts:
        raise ValueError("patchArchive is missing/empty; do not seed from 'patch' (latest 3)")
    summary = feed.get("patchSummary")
    if not isinstance(summary, dict) or summary.get("total") != len(posts):
        raise ValueError("patchSummary.total != patchArchive size; refusing partial feed")

    found: dict[str, dict] = {}
    for post in posts:
        if not isinstance(post, dict):
            raise ValueError("patchArchive entry is not an object")
        path = post.get("path")
        match = POST_PATH.fullmatch(path) if isinstance(path, str) else None
        if not match:
            raise ValueError(f"Invalid patch article path: {path!r}")
        post_id = match.group(1)
        if post_id in found:
            raise ValueError(f"Duplicate patch article: {path}")
        title = post.get("title")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"Missing title for {path}")
        found[post_id] = {
            "postPath": path,
            "title": title.strip()[:180],
            "initialEstimate": 0,
            "trackedSuccesses": 0,
            "source": "calf-home-feed-auto",
        }
    return found


def indexed_items(value: object) -> dict[str, dict]:
    """Convert the legacy numeric array or an object with mixed keys to a dict."""
    if isinstance(value, list):
        return {str(i): row for i, row in enumerate(value) if row is not None}
    if isinstance(value, dict):
        return value
    raise ValueError("Firebase /items is not an existing array/object; refusing initialization")


def find_existing_paths(items: dict[str, dict]) -> dict[str, str]:
    result: dict[str, str] = {}
    for key, row in items.items():
        if not isinstance(row, dict):
            continue
        path = row.get("postPath")
        match = POST_PATH.fullmatch(path) if isinstance(path, str) else None
        if not match:
            continue
        post_id = match.group(1)
        if post_id in result:
            raise ValueError(f"Duplicate Firebase postPath {path}: {result[post_id]}, {key}")
        result[post_id] = str(key)
    return result


def sync(feed: dict, items_ref: object, *, apply: bool = False) -> dict:
    desired = feed_posts(feed)
    original = indexed_items(items_ref.get())
    if len(original) < 25:
        raise ValueError(f"Existing Firebase /items has only {len(original)} rows (<25); aborting")
    registered = find_existing_paths(original)
    missing_legacy = LEGACY_POST_IDS - set(registered)
    if missing_legacy:
        raise ValueError(
            "Legacy Firebase postIds missing; no writes allowed: "
            + ", ".join(sorted(missing_legacy, key=int))
        )

    missing = sorted(set(desired) - set(registered), key=int)
    print(f"[CALF] archive={len(desired)}, existing_items={len(original)}, new={len(missing)}")
    created, already = [], []
    for post_id in missing:
        path = f"/items/post_{post_id}"
        node = items_ref.child(f"post_{post_id}")
        value, etag = node.get(etag=True)
        if value is not None:
            if not isinstance(value, dict) or value.get("postPath") != f"/{post_id}":
                raise RuntimeError(f"Refusing to overwrite existing {path}")
            already.append(post_id)
            continue
        if not apply:
            print(f"[DRY RUN] CREATE {path} (0 + 0)")
            continue
        payload = dict(desired[post_id])
        payload["registeredAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        ok, current, _ = node.set_if_unchanged(etag, payload)
        if ok:
            created.append(post_id)
            print(f"[CREATED] {path}")
        elif isinstance(current, dict) and current.get("postPath") == f"/{post_id}":
            already.append(post_id)
            print(f"[RACE: ALREADY PRESENT] {path}")
        else:
            raise RuntimeError(f"Concurrent change at {path}; no overwrite performed")
    print(f"[CALF] created={len(created)}, already_existing={len(registered) + len(already)}, pending={len(missing) - len(created) - len(already) if not apply else 0}")
    return {"archive": len(desired), "existing": len(original), "missing": missing, "created": created, "already": already}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", type=Path, default=DEFAULT_FEED)
    parser.add_argument("--apply", action="store_true", help="Actually create new rows (default: dry run)")
    args = parser.parse_args()
    feed = json.loads(args.feed.read_text(encoding="utf-8"))
    feed_posts(feed)  # fail closed before loading credentials

    raw_secret = os.environ.get("CALF_FIREBASE_SA_JSON", "")
    if not raw_secret:
        raise SystemExit("Missing GitHub Actions secret CALF_FIREBASE_SA_JSON")
    cert = json.loads(raw_secret)
    if cert.get("project_id") != PROJECT_ID or cert.get("type") != "service_account":
        raise SystemExit("Service account must belong to Firebase project 'calf-station'")

    # Imported only on the trusted GitHub Actions runner, never in web-facing JS.
    import firebase_admin
    from firebase_admin import credentials, db

    app = firebase_admin.initialize_app(
        credentials.Certificate(cert), {"databaseURL": DB_URL}, name="calf-auto-patch-counter"
    )
    try:
        sync(feed, db.reference("/items", app=app), apply=args.apply)
    finally:
        firebase_admin.delete_app(app)


if __name__ == "__main__":
    main()
