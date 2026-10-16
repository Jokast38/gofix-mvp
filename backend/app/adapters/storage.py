import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings


class StorageAdapter(ABC):
    @abstractmethod
    def save(self, data: bytes, ext: str, private: bool = False, folder: str = "misc") -> str: ...

    @abstractmethod
    def read(self, key: str, private: bool = False) -> bytes: ...

    @abstractmethod
    def delete(self, key: str, private: bool = False) -> None: ...


class LocalStorageAdapter(StorageAdapter):
    """public/ is served by Nginx; private/ (ID documents) is only readable through admin API."""

    def __init__(self, root: str):
        self.root = Path(root)
        for sub in ("public", "private"):
            (self.root / sub).mkdir(parents=True, exist_ok=True)

    def _path(self, key: str, private: bool) -> Path:
        base = (self.root / ("private" if private else "public")).resolve()
        p = (base / key).resolve()
        if base not in p.parents:
            raise ValueError("invalid_key")
        return p

    def save(self, data, ext, private=False, folder="misc"):
        key = f"{folder}/{uuid.uuid4().hex}.{ext.lstrip('.')}"
        p = self._path(key, private)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return key

    def read(self, key, private=False):
        return self._path(key, private).read_bytes()

    def delete(self, key, private=False):
        self._path(key, private).unlink(missing_ok=True)


def get_storage() -> StorageAdapter:
    # "s3" (MinIO-compatible) implementation to plug here later.
    return LocalStorageAdapter(settings.storage_local_root)
