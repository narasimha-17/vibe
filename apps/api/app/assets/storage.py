"""Pluggable storage backend for uploaded assets.

`LocalDiskStorage` is the default (writes under `settings.storage_dir`,
served back via the `/static` mount in `app.main`). Swap in an
`S3Storage` implementing the same two methods when moving to
production — nothing above this layer needs to change.
"""

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, project_id: str, filename: str, content: bytes) -> str:
        """Persist bytes and return a publicly-servable URL."""

    @abstractmethod
    async def delete(self, url: str) -> None: ...


class LocalDiskStorage(StorageBackend):
    def __init__(self, base_dir: str = settings.storage_dir):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, project_id: str, filename: str, content: bytes) -> str:
        project_dir = self.base_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(filename).suffix
        stored_name = f"{uuid.uuid4().hex}{ext}"
        (project_dir / stored_name).write_bytes(content)
        return f"/static/{project_id}/{stored_name}"

    async def delete(self, url: str) -> None:
        relative = url.removeprefix("/static/")
        path = self.base_dir / relative
        if path.exists():
            path.unlink()


storage = LocalDiskStorage()
