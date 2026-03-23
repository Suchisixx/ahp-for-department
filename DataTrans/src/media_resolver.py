from itertools import zip_longest
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_TRANS_DIR = BASE_DIR.parent
MEDIA_ROOT = (DATA_TRANS_DIR / "data-crawling" / "raw" / "images").resolve()
MEDIA_URL_PREFIX = "/media"


def _clean_text(value) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _coerce_list(value) -> list[str]:
    if not isinstance(value, list):
        return []

    items: list[str] = []
    for item in value:
        text = _clean_text(item)
        if text:
            items.append(text)
    return items


def _normalize_remote_src(value) -> str | None:
    text = _clean_text(value)
    if not text:
        return None

    if text.startswith(("http://", "https://", "/")):
        return text
    return None


def _candidate_local_paths(raw_path: str) -> list[Path]:
    path = Path(raw_path)
    if path.is_absolute():
        return [path]

    return [
        (DATA_TRANS_DIR / raw_path),
        (DATA_TRANS_DIR / "data-crawling" / raw_path),
        (MEDIA_ROOT / raw_path),
    ]


def _resolve_local_media_path(raw_path: str | None) -> Path | None:
    text = _clean_text(raw_path)
    if not text:
        return None

    for candidate in _candidate_local_paths(text):
        try:
            resolved = candidate.resolve()
        except OSError:
            continue

        if not resolved.is_file():
            continue

        try:
            resolved.relative_to(MEDIA_ROOT)
        except ValueError:
            continue

        return resolved

    return None


def _to_public_media_url(local_path: Path | None) -> str | None:
    if local_path is None:
        return None

    relative_path = local_path.relative_to(MEDIA_ROOT).as_posix()
    return f"{MEDIA_URL_PREFIX}/{relative_path}"


def resolve_thumbnail_src(canho) -> str | None:
    local_src = _to_public_media_url(
        _resolve_local_media_path(getattr(canho, "thumbnail_path", None))
    )
    if local_src:
        return local_src

    return _normalize_remote_src(getattr(canho, "thumbnail_url", None))


def resolve_image_srcs(canho) -> list[str]:
    local_paths = _coerce_list(getattr(canho, "image_local_paths", None))
    remote_urls = _coerce_list(getattr(canho, "image_urls", None))
    resolved: list[str] = []
    seen: set[str] = set()

    for local_path, remote_url in zip_longest(local_paths, remote_urls):
        source = _to_public_media_url(_resolve_local_media_path(local_path))
        if not source:
            source = _normalize_remote_src(remote_url)

        if not source or source in seen:
            continue

        seen.add(source)
        resolved.append(source)

    return resolved


def attach_media_sources(canho):
    canho.thumbnail_src = resolve_thumbnail_src(canho)
    canho.image_srcs = resolve_image_srcs(canho)
    return canho
