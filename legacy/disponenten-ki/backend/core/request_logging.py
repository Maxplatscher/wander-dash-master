"""
Strukturiertes Request-Logging (JSON-Zeilen) + Slow-Request-Erkennung.
"""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

LOG_JSON = os.environ.get("LOG_FORMAT", "").strip().lower() in ("json", "json-lines", "jsonl")
SLOW_WARN_MS = int(os.environ.get("SLOW_REQUEST_WARN_MS", "1000"))
SLOW_ERR_MS = int(os.environ.get("SLOW_REQUEST_ERROR_MS", "3000"))


def _log_json(obj: dict) -> None:
    print(json.dumps(obj, ensure_ascii=False), file=sys.stderr, flush=True)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        method = request.method
        path = request.url.path
        err_type = None
        err_msg = None
        stack = None
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            err_type = type(e).__name__
            err_msg = str(e)
            stack = traceback.format_exc()
            raise
        finally:
            duration_ms = int((time.perf_counter() - start) * 1000)
            line = {
                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
            }
            if err_type:
                line["error_type"] = err_type
                line["error_message"] = (err_msg or "")[:2000]
                if status_code >= 500 and stack:
                    line["stack_trace"] = stack[:8000]

            if LOG_JSON or os.environ.get("STRUCTURED_LOG", "").strip() in ("1", "true", "yes"):
                _log_json(line)
            else:
                print(
                    f"{method} {path} {status_code} {duration_ms}ms",
                    file=sys.stderr,
                    flush=True,
                )

            if duration_ms >= SLOW_ERR_MS:
                _log_json(
                    {
                        "ts": line["ts"],
                        "level": "error",
                        "event": "slow_request",
                        "duration_ms": duration_ms,
                        "path": path,
                        "method": method,
                    }
                )
            elif duration_ms >= SLOW_WARN_MS:
                _log_json(
                    {
                        "ts": line["ts"],
                        "level": "warning",
                        "event": "slow_request",
                        "duration_ms": duration_ms,
                        "path": path,
                        "method": method,
                    }
                )
