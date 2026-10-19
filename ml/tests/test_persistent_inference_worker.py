"""Protocol tests for the persistent ShelfLife AI inference worker."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path


ML_ROOT = Path(__file__).resolve().parents[1]
WORKER_PATH = ML_ROOT / "src" / "10_persistent_inference_worker.py"

HISTORY = [
    {
        "dt": f"2026-09-{day:02d}",
        "sale_amount": value,
    }
    for day, value in enumerate(
        [
            1.0,
            1.2,
            0.9,
            1.1,
            1.3,
            1.0,
            1.4,
            1.2,
            1.1,
            1.3,
            1.5,
            1.2,
            1.4,
            1.3,
        ],
        start=1,
    )
]


def start_worker():
    """Start one persistent worker using the current Python interpreter."""
    process = subprocess.Popen(
        [
            sys.executable,
            str(WORKER_PATH),
        ],
        cwd=ML_ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    ready_line = process.stdout.readline().strip()
    ready = json.loads(ready_line)

    return process, ready


def send_request(process, payload):
    """Send one protocol request and return its decoded response."""
    process.stdin.write(json.dumps(payload) + "\n")
    process.stdin.flush()

    response_line = process.stdout.readline().strip()
    return json.loads(response_line)


def stop_worker(process):
    """Close pipes and require a clean worker shutdown."""
    process.stdin.close()
    process.wait(timeout=10)

    stderr = process.stderr.read().strip()

    process.stdout.close()
    process.stderr.close()

    if process.returncode != 0:
        raise AssertionError(
            f"Worker exited with {process.returncode}: {stderr}"
        )

    return stderr


class PersistentInferenceWorkerTests(unittest.TestCase):
    def test_a_startup_emits_ready(self):
        process, ready = start_worker()

        self.assertEqual(
            ready,
            {
                "type": "ready",
                "ok": True,
            },
        )

        stderr = stop_worker(process)
        self.assertEqual(stderr, "")

    def test_b_valid_request_returns_prediction(self):
        process, _ = start_worker()

        response = send_request(
            process,
            {
                "requestId": "request-b",
                "history": HISTORY,
                "forecastDates": ["2026-09-15"],
            },
        )

        self.assertTrue(response["ok"])
        self.assertEqual(response["requestId"], "request-b")
        self.assertEqual(len(response["predictions"]), 1)
        self.assertEqual(
            response["predictions"][0]["date"],
            "2026-09-15",
        )
        self.assertAlmostEqual(
            response["predictions"][0]["predictedConsumption"],
            1.1824236092767064,
            places=12,
        )

        stop_worker(process)

    def test_c_multiple_requests_same_worker(self):
        process, _ = start_worker()

        predictions = []

        for request_id in [
            "request-c1",
            "request-c2",
            "request-c3",
        ]:
            response = send_request(
                process,
                {
                    "requestId": request_id,
                    "history": HISTORY,
                    "forecastDates": ["2026-09-15"],
                },
            )

            self.assertTrue(response["ok"])
            self.assertEqual(
                response["requestId"],
                request_id,
            )

            predictions.append(
                response["predictions"][0][
                    "predictedConsumption"
                ]
            )

        self.assertAlmostEqual(
            predictions[0],
            predictions[1],
            places=12,
        )
        self.assertAlmostEqual(
            predictions[0],
            predictions[2],
            places=12,
        )

        stop_worker(process)

    def test_d_malformed_json_returns_structured_error(self):
        process, _ = start_worker()

        process.stdin.write("{not-json}\n")
        process.stdin.flush()

        response = json.loads(
            process.stdout.readline().strip()
        )

        self.assertFalse(response["ok"])
        self.assertIsNone(response["requestId"])
        self.assertEqual(
            response["error"]["type"],
            "JSONDecodeError",
        )

        stop_worker(process)

    def test_e_empty_request_id_is_rejected(self):
        process, _ = start_worker()

        response = send_request(
            process,
            {
                "requestId": "",
                "history": HISTORY,
                "forecastDates": ["2026-09-15"],
            },
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["requestId"], "")
        self.assertEqual(
            response["error"]["type"],
            "ValueError",
        )

        stop_worker(process)

    def test_f_missing_history_is_rejected(self):
        process, _ = start_worker()

        response = send_request(
            process,
            {
                "requestId": "request-f",
                "forecastDates": ["2026-09-15"],
            },
        )

        self.assertFalse(response["ok"])
        self.assertEqual(
            response["error"]["message"],
            "history is required.",
        )

        stop_worker(process)

    def test_g_missing_forecast_dates_is_rejected(self):
        process, _ = start_worker()

        response = send_request(
            process,
            {
                "requestId": "request-g",
                "history": HISTORY,
            },
        )

        self.assertFalse(response["ok"])
        self.assertEqual(
            response["error"]["message"],
            "forecastDates is required.",
        )

        stop_worker(process)

    def test_h_invalid_history_reaches_runtime_validation(self):
        process, _ = start_worker()

        response = send_request(
            process,
            {
                "requestId": "request-h",
                "history": HISTORY[:13],
                "forecastDates": ["2026-09-15"],
            },
        )

        self.assertFalse(response["ok"])
        self.assertEqual(
            response["error"]["type"],
            "ValueError",
        )
        self.assertIn(
            "at least 14 historical observations",
            response["error"]["message"],
        )

        stop_worker(process)

    def test_i_bom_prefixed_request_is_accepted(self):
        process, _ = start_worker()

        payload = {
            "requestId": "request-i",
            "history": HISTORY,
            "forecastDates": ["2026-09-15"],
        }

        process.stdin.write(
            "\ufeff" + json.dumps(payload) + "\n"
        )
        process.stdin.flush()

        response = json.loads(
            process.stdout.readline().strip()
        )

        self.assertTrue(response["ok"])
        self.assertEqual(
            response["requestId"],
            "request-i",
        )

        stop_worker(process)

    def test_j_clean_stdin_close_exits_zero(self):
        process, ready = start_worker()

        self.assertTrue(ready["ok"])

        stderr = stop_worker(process)

        self.assertEqual(process.returncode, 0)
        self.assertEqual(stderr, "")


    def test_k_dataset_specific_identity_columns_are_rejected(self):
        process, _ = start_worker()

        keyed_history = [
            {
                **row,
                "store_id": "operational",
                "product_id": "ingredient-test",
            }
            for row in HISTORY
        ]

        response = send_request(
            process,
            {
                "requestId": "request-k",
                "history": keyed_history,
                "forecastDates": ["2026-09-15"],
            },
        )

        self.assertFalse(response["ok"])
        self.assertEqual(
            response["error"]["type"],
            "ValueError",
        )
        self.assertIn(
            "unsupported columns",
            response["error"]["message"],
        )

        stop_worker(process)


if __name__ == "__main__":
    unittest.main()
