"""
Per-request pipeline latency tracer.

Usage:
    tracer = get_tracer()
    with tracer.stage("embedding"):
        vec = await embed_text(query)   # await inside a sync contextmanager is fine
    print(tracer.to_dict())
    # {"embedding": {"duration_ms": 12.4}, ...}
"""
import time
from contextlib import contextmanager
from typing import Dict


class PipelineTracer:
    """Lightweight per-request wall-clock timer for named pipeline stages."""

    def __init__(self) -> None:
        self._timings: Dict[str, float] = {}

    @contextmanager
    def stage(self, name: str):
        """Context manager that records wall-clock duration for a named stage."""
        t = time.perf_counter()
        try:
            yield
        finally:
            self._timings[name] = round((time.perf_counter() - t) * 1000, 2)

    def record(self, name: str, duration_ms: float) -> None:
        """Manually record a duration (e.g. when timing async generators)."""
        self._timings[name] = round(duration_ms, 2)

    def to_dict(self) -> Dict[str, Dict[str, float]]:
        """Return trace as {stage_name: {duration_ms: float}}."""
        return {k: {"duration_ms": v} for k, v in self._timings.items()}


class _NoOpTracer:
    """Drop-in when tracing is disabled — zero runtime overhead."""

    @contextmanager
    def stage(self, name: str):
        yield

    def record(self, name: str, duration_ms: float) -> None:
        pass

    def to_dict(self) -> Dict[str, Dict[str, float]]:
        return {}


def get_tracer() -> "PipelineTracer | _NoOpTracer":
    """Return a real tracer or a no-op based on settings."""
    from app.core.config import settings
    if settings.TRACING_ENABLED or settings.DEBUG:
        return PipelineTracer()
    return _NoOpTracer()
