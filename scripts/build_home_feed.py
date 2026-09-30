#!/usr/bin/env python3
"""
CALF STATION home-feed.json generator
=====================================

이 스크립트는 GitHub Actions에서 실행됩니다.
방문자 브라우저가 무거운 Tistory 페이지 여러 장을 읽지 않도록,
서버 측에서 미리 HOME 데이터만 아주 작은 JSON으로 압축합니다.

출력:
- 오늘의 꽃송아지 2
- 게시물 댓글 + 방명록 원글 최신 2
- 한글화 3
- NEXT 전체 + 분석/한글화/검수/평균 진행률
- 프로젝트 히스토리 3

방문자 HOME은 이 JSON 1개만 읽습니다.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://calfstation.tistory.com"
OUT = Path(__file__).resolve().parents[1] / "home-feed.json"

URLS = {
    "home": BASE + "/",
    "patch": BASE + "/category/%ED%95%9C%EA%B8%80%ED%99%94",
    "next": BASE + "/category/NEXT",
    "history": BASE + "/category/%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%20%ED%9E%88%EC%8A%A4%ED%86%A0%EB%A6%AC",
    "daily": BASE + "/category/%EC%98%A4%EB%8A%98%EC%9D%98%20%EA%BD%83%EC%86%A1%EC%95%84%EC%A7%80",
    "guestbook": BASE + "/guestbook",
}

OWNER_NAMES = {"꽃송아지", "CALF STATION"}

LEGACY_PATCH_SHORT = {
    "/6": "열혈피구 한글패치",
    "/8": "더블 드래곤 2 한글패치",
    "/17": "열혈하키 한글패치",
    "/20": "열혈축구2 한글패치",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "CALF-STATION-HomeFeed/1.0 (+https://calfstation.tistory.com/)",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
})

KST = timezone(timedelta(hours=9))


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fetch_soup(url: str) -> BeautifulSoup:
    response = SESSION.get(url, timeout=25)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def path_from_href(href: str) -> str:
    parsed = urlparse(urljoin(BASE, href or ""))
    return parsed.path.rstrip("/") or "/"


def parse_post_list(soup: BeautifulSoup, limit: int) -> list[dict]:
    posts = []
    for link in soup.select(".list-card .post-list > .post-item > a[href]"):
        href = link.get("href", "")
        path = path_from_href(href)
        strong = link.select_one(".post-text strong")
        em = link.select_one(".post-text em")
        title = clean(
            link.get("data-tiara-copy")
            or link.get("data-tiara-name")
            or (strong.get_text(" ", strip=True) if strong else "")
        )
        if not path or not title:
            continue
        posts.append({
            "url": path,
            "path": path,
            "title": title,
            "date": clean(em.get_text(" ", strip=True) if em else ""),
        })
        if len(posts) >= limit:
            break
    return posts


def parse_paginated_post_list(
    url: str,
    limit: int,
    max_pages: int = 10,
) -> list[dict]:
    """
    Tistory category pagination collector.

    /category/NEXT is paged, so fetching only the first document silently
    truncates the project feed. Read successive ?page=N documents, dedupe by
    post path, and stop when Tistory returns no new posts (including the case
    where it repeats the last page).
    """
    posts: list[dict] = []
    seen: set[str] = set()

    for page in range(1, max_pages + 1):
        separator = "&" if "?" in url else "?"
        soup = fetch_soup(f"{url}{separator}page={page}")
        page_posts = parse_post_list(soup, limit)

        if not page_posts:
            break

        added = 0

        for post in page_posts:
            path = post.get("path", "")
            if not path or path in seen:
                continue

            seen.add(path)
            posts.append(post)
            added += 1

            if len(posts) >= limit:
                return posts

        if added == 0:
            break

    return posts


PLATFORM_META = {
    "fc": ("패미컴", "FC"),
    "sfc": ("슈퍼 패미컴", "SFC"),
    "md": ("메가 드라이브", "MD"),
    "sms": ("세가 마스터 시스템", "SMS"),
    "pce": ("PC 엔진", "PCE"),
    "gg": ("게임 기어", "GG"),
    "gb": ("게임보이", "GB"),
    "gbc": ("게임보이 컬러", "GBC"),
    "gba": ("게임보이 어드밴스", "GBA"),
    "nds": ("닌텐도 DS", "NDS"),
    "3ds": ("닌텐도 3DS", "3DS"),
    "n64": ("닌텐도 64", "N64"),
    "gc": ("게임큐브", "GC"),
    "wii": ("Wii", "Wii"),
    "ps1": ("플레이스테이션", "PS1"),
    "ps2": ("플레이스테이션 2", "PS2"),
    "psp": ("PSP", "PSP"),
    "sat": ("세가 새턴", "SAT"),
    "dc": ("드림캐스트", "DC"),
    "ng": ("네오지오", "NG"),
    "ngp": ("네오지오 포켓", "NGP"),
    "ngpc": ("네오지오 포켓 컬러", "NGPC"),
    "ws": ("원더스완", "WS"),
    "wsc": ("원더스완 컬러", "WSC"),
}

PLATFORM_ALIASES = {
    "famicom": "fc",
    "familycomputer": "fc",
    "superfamicom": "sfc",
    "snes": "sfc",
    "megadrive": "md",
    "genesis": "md",
    "mastersystem": "sms",
    "pcengine": "pce",
    "gamegear": "gg",
    "gameboy": "gb",
    "gameboycolor": "gbc",
    "gameboyadvance": "gba",
    "ds": "nds",
    "nintendods": "nds",
    "nintendo3ds": "3ds",
    "nintendo64": "n64",
    "gamecube": "gc",
    "playstation": "ps1",
    "psx": "ps1",
    "playstation2": "ps2",
    "segasaturn": "sat",
    "saturn": "sat",
    "dreamcast": "dc",
    "neogeo": "ng",
    "neogeopocket": "ngp",
    "neogeopocketcolor": "ngpc",
    "wonderswan": "ws",
    "wonderswancolor": "wsc",
}


def platform_meta_from_raw(value: str | None) -> dict:
    raw = clean(value)
    if not raw:
        return {
            "code": "fc",
            "label": PLATFORM_META["fc"][0],
            "short": PLATFORM_META["fc"][1],
            "raw": "",
        }

    parts = [clean(v) for v in raw.split("/", 1)]
    head = parts[0]
    label_hint = parts[1] if len(parts) > 1 else ""

    compact = re.sub(r"[^a-z0-9]+", "", head.lower())
    code = PLATFORM_ALIASES.get(compact, compact)

    whole = re.sub(r"[^a-z0-9]+", "", raw.lower())
    if not re.fullmatch(r"[a-z0-9]{2,8}", code or ""):
        code = PLATFORM_ALIASES.get(whole, "")

    known_text = raw.lower()
    if not code:
        checks = [
            ("게임보이 컬러", "gbc"),
            ("게임보이 어드밴스", "gba"),
            ("게임보이", "gb"),
            ("슈퍼 패미컴", "sfc"),
            ("슈퍼패미컴", "sfc"),
            ("패미컴", "fc"),
            ("메가 드라이브", "md"),
            ("메가드라이브", "md"),
            ("세가 마스터 시스템", "sms"),
            ("pc 엔진", "pce"),
            ("pc엔진", "pce"),
            ("게임 기어", "gg"),
            ("게임기어", "gg"),
            ("닌텐도 ds", "nds"),
            ("닌텐도 3ds", "3ds"),
            ("닌텐도 64", "n64"),
            ("게임큐브", "gc"),
            ("플레이스테이션 2", "ps2"),
            ("플레이스테이션", "ps1"),
            ("세가 새턴", "sat"),
            ("드림캐스트", "dc"),
        ]
        for needle, candidate in checks:
            if needle in known_text:
                code = candidate
                break

    if not code or not re.fullmatch(r"[a-z0-9]{2,8}", code):
        code = "other"

    if code in PLATFORM_META:
        known_label, known_short = PLATFORM_META[code]
    else:
        known_label, known_short = code.upper(), code.upper()

    return {
        "code": code,
        "label": label_hint or known_label,
        "short": head if re.fullmatch(r"[A-Za-z0-9]{2,8}", head) else known_short,
        "raw": raw,
    }


def enrich_patch_archive(post: dict) -> dict:
    result = dict(post)

    try:
        soup = fetch_soup(urljoin(BASE, post["url"]))

        block = soup.select_one(".calf-patch-auto")
        declared = clean(
            (
                block.get("data-platform-code")
                or block.get("data-platform")
                or ""
            )
            if block
            else ""
        )

        platform = platform_meta_from_raw(declared or "FC / 패미컴")

        # 배포글 생성기가 이미 명시한 대표 커버를 가장 우선합니다.
        # og:image는 티스토리 대표이미지/비공개 상태에 따라 다른 이미지가 잡힐 수 있어
        # 아카이브 카드용으로는 data-cover-image가 더 정확합니다.
        cover_image = clean(block.get("data-cover-image", "")) if block else ""
        thumbnail = clean(block.get("data-thumbnail", "")) if block else ""
        image_node = soup.select_one('meta[property="og:image"]')
        og_image = clean(image_node.get("content", "")) if image_node else ""
        image = cover_image or thumbnail or og_image

        saved = clean(block.get("data-home-card-title", "")) if block else ""
        result.update({
            "image": image,
            "platform": declared,
            "platformCode": platform["code"],
            "platformLabel": platform["label"],
            "platformShort": platform["short"],
            "displayTitle": saved or post["title"],
        })
        return result

    except Exception as exc:
        print(f"[patch-archive] detail failed {post['url']}: {exc}", file=sys.stderr)
        platform = platform_meta_from_raw("FC / 패미컴")
        result.update({
            "image": "",
            "platform": "",
            "platformCode": platform["code"],
            "platformLabel": platform["label"],
            "platformShort": platform["short"],
            "displayTitle": post["title"],
        })
        return result


def patch_fallback_title(post: dict) -> str:
    return LEGACY_PATCH_SHORT.get(post["path"], post["title"])


def enrich_patch(post: dict) -> dict:
    result = dict(post)
    result["subtitle"] = post["title"]

    legacy = LEGACY_PATCH_SHORT.get(post["path"])
    if legacy:
        result["displayTitle"] = legacy
        return result

    try:
        soup = fetch_soup(urljoin(BASE, post["url"]))
        node = soup.select_one(
            ".calf-patch-auto[data-home-card-title], "
            ".calf-patch-auto[data-seo-source]"
        )
        saved = clean(node.get("data-home-card-title", "")) if node else ""
        raw = clean(node.get("data-seo-aliases", "")) if node else ""
        first = ""
        if raw:
            first = next(
                (clean(v) for v in re.split(r"[|,，\n]+", raw) if clean(v)),
                "",
            )
        auto = (
            first
            if re.search(r"한글\s*패치", first, re.I)
            else (first + " 한글패치" if first else post["title"])
        )
        result["displayTitle"] = saved or auto
    except Exception as exc:
        print(f"[patch] detail failed {post['url']}: {exc}", file=sys.stderr)
        result["displayTitle"] = patch_fallback_title(post)

    return result


def history_base(title: str) -> str:
    text = clean(title)
    if re.search(r"다운타운\s*열혈물어|열혈물어", text):
        return "열혈물어 한글화 작업기"
    if re.search(r"열혈시대극|다운타운\s*스페셜", text):
        return "열혈시대극 한글화 작업기"
    if re.search(r"열혈축구리그|열혈축구2|열혈사커리그", text):
        return "열혈축구2 한글화 작업기"
    if re.search(r"열혈하키|열혈하키부", text):
        return "열혈하키 한글화 작업기"
    if re.search(r"캡틴\s*츠바사\s*(?:V|5)", text, re.I):
        return "캡틴 츠바사 V 한글화 작업기"

    cleaned = re.sub(r"\s*히스토리\s*", " ", text, flags=re.I)
    cleaned = re.sub(r"\s*-?\s*PAGE\s*\d+.*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*\(END\)\s*", " ", cleaned, flags=re.I)
    cleaned = clean(cleaned)
    return (cleaned or "프로젝트") + " 한글화 작업기"


def enrich_history(post: dict) -> dict:
    title = clean(post["title"])
    match = re.search(r"PAGE\s*(\d+)", title, re.I)
    page = int(match.group(1)) if match else 0
    subtitle = history_base(title)
    if page > 0:
        subtitle += f" {page}"

    result = dict(post)
    result["displayTitle"] = title
    result["subtitle"] = subtitle
    return result


def clamp(value) -> int:
    try:
        n = float(value)
    except Exception:
        return 0
    return max(0, min(100, round(n)))


def is_next_complete(value: str | None) -> bool:
    state = re.sub(r"\s+", "", clean(value)).lower()
    return state in {
        "complete",
        "completed",
        "done",
        "완료",
        "테스트완료",
    }


def enrich_next(post: dict) -> dict | None:
    try:
        soup = fetch_soup(urljoin(BASE, post["url"]))
        block = soup.select_one(".calf-next-project")
        if not block:
            return None

        analysis = clamp(block.get("data-analysis", 0))
        translation = clamp(block.get("data-translation", 0))
        review = clamp(
            block.get("data-review")
            or block.get("data-verification")
            or 0
        )
        average = round((analysis + translation + review) / 3)
        title = clean(block.get("data-project-title") or post["title"])

        result = dict(post)
        image_node = soup.select_one('meta[property="og:image"]')
        image = clean(image_node.get("content", "")) if image_node else ""

        result.update({
            "title": title,
            "analysis": analysis,
            "translation": translation,
            "review": review,
            "average": average,
            "platform": clean(block.get("data-platform") or ""),
            "test": clean(block.get("data-test") or ""),
            "image": image,
        })
        return result
    except Exception as exc:
        print(f"[next] detail failed {post['url']}: {exc}", file=sys.stderr)
        return None


def parse_time(text: str) -> float:
    text = clean(text)
    if not text:
        return 0

    now = datetime.now(KST)

    if re.search(r"방금|지금", text):
        return now.timestamp()

    m = re.search(r"(\d+)\s*(초|분|시간|일|주)\s*전", text)
    if m:
        amount = int(m.group(1))
        unit = m.group(2)
        seconds = {
            "초": 1,
            "분": 60,
            "시간": 3600,
            "일": 86400,
            "주": 604800,
        }[unit]
        return (now - timedelta(seconds=amount * seconds)).timestamp()

    def make_dt(
        year: int,
        month: int,
        day: int,
        hour: int = 0,
        minute: int = 0,
        ampm: str = "",
    ) -> float:
        if ampm == "오후" and hour < 12:
            hour += 12
        elif ampm == "오전" and hour == 12:
            hour = 0

        try:
            return datetime(
                year,
                month,
                day,
                hour,
                minute,
                tzinfo=KST,
            ).timestamp()
        except ValueError:
            return 0

    m = re.search(
        r"(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?"
        r"(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2}))?",
        text,
    )
    if m:
        return make_dt(
            int(m.group(1)),
            int(m.group(2)),
            int(m.group(3)),
            int(m.group(5) or 0),
            int(m.group(6) or 0),
            m.group(4) or "",
        )

    m = re.search(
        r"(?<!\d)(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?"
        r"(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2}))?(?!\d)",
        text,
    )
    if m:
        month = int(m.group(1))
        day = int(m.group(2))
        hour = int(m.group(4) or 0)
        minute = int(m.group(5) or 0)
        ampm = m.group(3) or ""

        ts = make_dt(now.year, month, day, hour, minute, ampm)
        if ts and ts > (now + timedelta(days=1)).timestamp():
            ts = make_dt(now.year - 1, month, day, hour, minute, ampm)
        return ts

    m = re.search(
        r"(?:^|\s)(오전|오후)?\s*(\d{1,2}):(\d{2})(?:$|\s)",
        text,
    )
    if m:
        hour = int(m.group(2))
        minute = int(m.group(3))
        ampm = m.group(1) or ""

        ts = make_dt(now.year, now.month, now.day, hour, minute, ampm)
        if ts and ts > (now + timedelta(minutes=5)).timestamp():
            yesterday = now - timedelta(days=1)
            ts = make_dt(
                yesterday.year,
                yesterday.month,
                yesterday.day,
                hour,
                minute,
                ampm,
            )
        return ts

    return 0


def parse_recent_comments(home: BeautifulSoup) -> list[dict]:
    items = []
    for index, item in enumerate(
        home.select("#calf-recent-comments-source .calf-recent-comment-source-item")
    ):
        name = clean(
            item.select_one("[data-rctrp-name]").get_text(" ", strip=True)
            if item.select_one("[data-rctrp-name]")
            else ""
        )
        text = clean(
            item.select_one("[data-rctrp-desc]").get_text(" ", strip=True)
            if item.select_one("[data-rctrp-desc]")
            else ""
        )
        time_text = clean(
            item.select_one("[data-rctrp-time]").get_text(" ", strip=True)
            if item.select_one("[data-rctrp-time]")
            else ""
        )
        link_node = item.select_one("[data-rctrp-link]")
        href = link_node.get("href", "") if link_node else ""
        path = path_from_href(href) if href else ""
        comment_match = re.search(r"#(comment\d+)", href, re.I)

        if not name or not text or name in OWNER_NAMES:
            continue

        items.append({
            "name": name,
            "text": text,
            "link": path,
            "commentId": comment_match.group(1) if comment_match else "",
            "kind": "comment",
            "time": parse_time(time_text),
            "_index": index,
        })
    return items


def parse_guestbook_hidden(guest: BeautifulSoup) -> list[dict]:
    items = []
    source = guest.select_one("#calf-guestbook-feed-source")
    if not source:
        return items

    for index, item in enumerate(source.select(".calf-guestbook-feed-source-item")):
        name_node = item.select_one("[data-guestbook-name]")
        desc_node = item.select_one("[data-guestbook-desc]")
        time_node = item.select_one("[data-guestbook-time]")

        name = clean(name_node.get_text(" ", strip=True) if name_node else "")
        text = clean(desc_node.get_text(" ", strip=True) if desc_node else "")
        time_text = clean(time_node.get_text(" ", strip=True) if time_node else "")
        cls = clean(item.get("data-guestbook-class", ""))

        if (
            not name
            or not text
            or name in OWNER_NAMES
            or re.search(r"secret|protected|private", cls, re.I)
            or re.search(r"비밀글|비밀 댓글|secret", text, re.I)
        ):
            continue

        items.append({
            "name": name,
            "text": text,
            "link": "/guestbook",
            "commentId": "",
            "kind": "guestbook",
            "time": parse_time(time_text),
            "_index": index,
        })

    return items


def parse_guestbook_fallback(guest: BeautifulSoup) -> list[dict]:
    root = guest.select_one(".guestbook-wrap")
    if not root:
        return []

    top = None
    for ul in root.select("ul.tt-list-reply"):
        if ul.find_parent("li", class_="tt-item-reply"):
            continue
        if ul.select(":scope > li.tt-item-reply"):
            top = ul
            break

    if not top:
        return []

    items = []
    for index, item in enumerate(top.select(":scope > li.tt-item-reply")):
        name_node = item.select_one(".tt-link-user")
        desc_node = item.select_one(".tt_desc")
        time_node = item.select_one(".tt_date, time")
        name = clean(name_node.get_text(" ", strip=True) if name_node else "")
        text = clean(desc_node.get_text(" ", strip=True) if desc_node else "")
        time_text = clean(time_node.get_text(" ", strip=True) if time_node else "")

        if (
            not name
            or not text
            or name in OWNER_NAMES
            or re.search(r"비밀글|비밀 댓글|secret", text, re.I)
        ):
            continue

        items.append({
            "name": name,
            "text": text,
            "link": "/guestbook",
            "commentId": "",
            "kind": "guestbook",
            "time": parse_time(time_text),
            "_index": index,
        })

    return items


def merge_friends(comments: list[dict], guestbook: list[dict]) -> list[dict]:
    merged = comments + guestbook
    merged.sort(
        key=lambda item: (
            item.get("time", 0),
            -item.get("_index", 0),
        ),
        reverse=True,
    )

    output = []
    seen = set()
    for item in merged:
        key = (
            item.get("kind"),
            item.get("name"),
            item.get("text"),
            item.get("commentId"),
        )
        if key in seen:
            continue
        seen.add(key)

        clean_item = {
            k: v
            for k, v in item.items()
            if not k.startswith("_")
        }
        output.append(clean_item)
        if len(output) >= 2:
            break
    return output


def main() -> None:
    print("Fetching CALF STATION Tistory pages...")

    home = fetch_soup(URLS["home"])
    patch_soup = fetch_soup(URLS["patch"])
    history_soup = fetch_soup(URLS["history"])
    daily_soup = fetch_soup(URLS["daily"])
    guest_soup = fetch_soup(URLS["guestbook"])

    # HOME용 최신 3개는 기존 계약 그대로 유지.
    patch_posts = [
        enrich_patch(post)
        for post in parse_post_list(patch_soup, 3)
    ]

    # 한글화 아카이브용 전체 목록은 GitHub Actions에서 미리 완성합니다.
    patch_archive_source = parse_paginated_post_list(
        URLS["patch"],
        limit=100,
        max_pages=20,
    )

    patch_archive = [
        enrich_patch_archive(post)
        for post in patch_archive_source
    ]

    patch_counts: dict[str, int] = {}
    patch_platform_info: dict[str, dict] = {}

    for item in patch_archive:
        code = clean(item.get("platformCode") or "other")
        patch_counts[code] = patch_counts.get(code, 0) + 1
        patch_platform_info.setdefault(
            code,
            {
                "code": code,
                "label": clean(item.get("platformLabel") or code.upper()),
                "short": clean(item.get("platformShort") or code.upper()),
            },
        )

    patch_summary = {
        "total": len(patch_archive),
        "byPlatform": patch_counts,
        "platforms": [
            {
                **patch_platform_info[code],
                "count": patch_counts[code],
            }
            for code in patch_counts
        ],
    }

    next_source_posts = parse_paginated_post_list(
        URLS["next"],
        limit=30,
        max_pages=10,
    )

    next_posts = [
        item
        for item in (
            enrich_next(post)
            for post in next_source_posts
        )
        if item
    ]

    next_active_posts = [
        item
        for item in next_posts
        if not is_next_complete(item.get("test"))
    ]

    next_completed_posts = [
        item
        for item in next_posts
        if is_next_complete(item.get("test"))
    ]

    next_summary = {
        "active": len(next_active_posts),
        "complete": len(next_completed_posts),
        "total": len(next_posts),
    }

    history_posts = [
        enrich_history(post)
        for post in parse_post_list(history_soup, 3)
    ]

    daily_posts = parse_post_list(daily_soup, 2)

    comments = parse_recent_comments(home)
    guestbook = parse_guestbook_hidden(guest_soup)
    if not guestbook:
        guestbook = parse_guestbook_fallback(guest_soup)

    feed = {
        "schema": 1,
        "generatedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "source": "CALF-STATION-GITHUB-ACTIONS",
        "daily": daily_posts,
        "friends": merge_friends(comments, guestbook),
        "patch": patch_posts,

        # 한글화 카테고리 전체 즉시 렌더용.
        "patchArchive": patch_archive,
        "patchSummary": patch_summary,

        # NEXT 첫 진입에서 사용하는 진행 중 프로젝트만.
        "next": next_active_posts,

        # "완료된 프로젝트" 버튼을 눌렀을 때만 사용하는 별도 배열.
        "nextCompleted": next_completed_posts,

        "nextSummary": next_summary,
        "history": history_posts,
    }

    OUT.write_text(
        json.dumps(
            feed,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "daily": len(feed["daily"]),
        "friends": len(feed["friends"]),
        "patch": len(feed["patch"]),
        "patchArchive": len(feed["patchArchive"]),
        "patchPlatforms": feed["patchSummary"]["byPlatform"],
        "next": len(feed["next"]),
        "nextCompleted": len(feed["nextCompleted"]),
        "nextActive": feed["nextSummary"]["active"],
        "nextComplete": feed["nextSummary"]["complete"],
        "history": len(feed["history"]),
        "output": str(OUT),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
