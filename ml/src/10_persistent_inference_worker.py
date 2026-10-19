"""Persistent JSON-lines inference worker for ShelfLife AI.

The worker loads and validates the selected forecasting artifact once at
startup, then serves multiple inference requests through stdin/stdout.

stdout is reserved exclusively for the machine-readable JSON-lines protocol.
Diagnostic output belongs on stderr.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd


ML_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_PATH = ML_ROOT / "src" / "09_selected_model_inference.py"


def load_runtime_module():
    """Load the validated selected-model runtime module."""
    spec = importlib.util.spec_from_file_location(
        "selected_model_inference",
        RUNTIME_PATH,
    )

    if spec is None or spec.loader is None:
        raise RuntimeError(
            f"Unable to load inference runtime: {RUNTIME_PATH}"
        )

    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    return runtime


def initialize_worker(runtime):
    """Load and validate metadata and model exactly once."""
    metadata = runtime.load_artifact_metadata()
    metadata_checks = runtime.validate_metadata_contract(metadata)

    if not all(metadata_checks.values()):
        failed = [
            name
            for name, passed in metadata_checks.items()
            if not passed
        ]
        raise RuntimeError(
            "Persisted model metadata failed the worker contract: "
            f"{failed}"
        )

    model = runtime.load_selected_model()
    model_checks = runtime.validate_loaded_model_contract(model)

    if not all(model_checks.values()):
        failed = [
            name
            for name, passed in model_checks.items()
            if not passed
        ]
        raise RuntimeError(
            "Persisted model failed the worker contract: "
            f"{failed}"
        )

    return model


def build_history_frame(history: Any) -> pd.DataFrame:
    """Convert protocol history into the single-series operational representation."""
    if not isinstance(history, list):
        raise ValueError("history must be an array.")

    return pd.DataFrame(history)


def process_request(runtime, model, payload: Any) -> dict[str, Any]:
    """Process one JSON request without reloading the model."""
    if not isinstance(payload, dict):
        raise ValueError("Request payload must be a JSON object.")

    request_id = payload.get("requestId")

    if not isinstance(request_id, str) or not request_id.strip():
        raise ValueError("requestId must be a non-empty string.")

    if "history" not in payload:
        raise ValueError("history is required.")

    if "forecastDates" not in payload:
        raise ValueError("forecastDates is required.")

    forecast_dates = payload["forecastDates"]

    if not isinstance(forecast_dates, list):
        raise ValueError("forecastDates must be an array.")

    history = build_history_frame(payload["history"])

    result = runtime.recursive_forecast_single_series(
        model,
        history,
        forecast_dates,
    )

    predictions = []

    for row in result.to_dict(orient="records"):
        predictions.append(
            {
                "date": pd.Timestamp(row["dt"]).date().isoformat(),
                "predictedConsumption": float(
                    row["predicted_consumption"]
                ),
            }
        )

    return {
        "requestId": request_id,
        "ok": True,
        "predictions": predictions,
    }


def write_message(message: dict[str, Any]) -> None:
    """Write exactly one protocol message to stdout."""
    sys.stdout.write(
        json.dumps(
            message,
            separators=(",", ":"),
            allow_nan=False,
        )
        + "\n"
    )
    sys.stdout.flush()


def main() -> int:
    """Initialize once, then serve JSON-lines requests until stdin closes."""
    try:
        runtime = load_runtime_module()
        model = initialize_worker(runtime)
    except Exception as exc:
        print(
            f"Forecast worker startup failed: {exc}",
            file=sys.stderr,
            flush=True,
        )
        return 1

    write_message(
        {
            "type": "ready",
            "ok": True,
        }
    )

    for line in sys.stdin:
        line = line.lstrip("\ufeff")

        if not line.strip():
            continue

        request_id = None

        try:
            payload = json.loads(line)

            if isinstance(payload, dict):
                candidate = payload.get("requestId")
                if isinstance(candidate, str):
                    request_id = candidate

            response = process_request(
                runtime,
                model,
                payload,
            )
        except Exception as exc:
            response = {
                "requestId": request_id,
                "ok": False,
                "error": {
                    "type": exc.__class__.__name__,
                    "message": str(exc),
                },
            }

        write_message(response)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
