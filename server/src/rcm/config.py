import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db_path: Path
    host: str
    port: int
    static_dir: Path | None

    @classmethod
    def from_env(cls) -> Settings:
        static = os.environ.get("RCM_STATIC_DIR")
        return cls(
            db_path=Path(os.environ.get("RCM_DB_PATH", "./rcm.sqlite3")),
            host=os.environ.get("RCM_HOST", "0.0.0.0"),
            port=int(os.environ.get("RCM_PORT", "8080")),
            static_dir=Path(static) if static else None,
        )
