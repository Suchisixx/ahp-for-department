from pathlib import Path
import sys
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import media_resolver


def make_listing(**overrides):
    payload = {
        "thumbnail_path": None,
        "thumbnail_url": None,
        "image_local_paths": None,
        "image_urls": None,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def make_media_file(root, relative_path: str):
    file_path = root / relative_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"test-image")
    return file_path


def test_resolve_media_local_first(tmp_path, monkeypatch):
    media_root = tmp_path / "images"
    thumbnail = make_media_file(media_root, "100/01.jpg")
    gallery = make_media_file(media_root, "100/02.jpg")
    monkeypatch.setattr(media_resolver, "MEDIA_ROOT", media_root.resolve())

    listing = make_listing(
        thumbnail_path=str(thumbnail),
        thumbnail_url="https://remote.example/thumb.jpg",
        image_local_paths=[str(gallery)],
        image_urls=["https://remote.example/gallery.jpg"],
    )

    assert media_resolver.resolve_thumbnail_src(listing) == "/media/100/01.jpg"
    assert media_resolver.resolve_image_srcs(listing) == ["/media/100/02.jpg"]


def test_resolve_media_remote_only(tmp_path, monkeypatch):
    media_root = tmp_path / "images"
    media_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(media_resolver, "MEDIA_ROOT", media_root.resolve())

    listing = make_listing(
        thumbnail_url="https://remote.example/thumb.jpg",
        image_urls=[
            "https://remote.example/gallery-1.jpg",
            "https://remote.example/gallery-2.jpg",
        ],
    )

    assert media_resolver.resolve_thumbnail_src(listing) == "https://remote.example/thumb.jpg"
    assert media_resolver.resolve_image_srcs(listing) == [
        "https://remote.example/gallery-1.jpg",
        "https://remote.example/gallery-2.jpg",
    ]


def test_resolve_media_falls_back_when_local_missing(tmp_path, monkeypatch):
    media_root = tmp_path / "images"
    media_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(media_resolver, "MEDIA_ROOT", media_root.resolve())

    listing = make_listing(
        thumbnail_path=str(media_root / "999/01.jpg"),
        thumbnail_url="https://remote.example/thumb.jpg",
        image_local_paths=[str(media_root / "999/02.jpg")],
        image_urls=["https://remote.example/gallery.jpg"],
    )

    assert media_resolver.resolve_thumbnail_src(listing) == "https://remote.example/thumb.jpg"
    assert media_resolver.resolve_image_srcs(listing) == ["https://remote.example/gallery.jpg"]


def test_resolve_media_handles_empty_listing(tmp_path, monkeypatch):
    media_root = tmp_path / "images"
    media_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(media_resolver, "MEDIA_ROOT", media_root.resolve())

    listing = make_listing()
    hydrated = media_resolver.attach_media_sources(listing)

    assert media_resolver.resolve_thumbnail_src(listing) is None
    assert media_resolver.resolve_image_srcs(listing) == []
    assert hydrated.thumbnail_src is None
    assert hydrated.image_srcs == []
