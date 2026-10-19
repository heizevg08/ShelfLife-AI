"""Production-path single-series equivalence test for ML-AUDIT-017.

The approved operational inference path omits FreshRetailNet-specific
store_id/product_id fields once ShelfLife has already isolated one valid
forecasting series. This test proves that the implemented single-series
runtime preserves the selected model's exact feature semantics and
recursive predictions relative to the validated keyed development path.
"""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

import numpy as np
import pandas as pd


ML_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_PATH = ML_ROOT / "src" / "09_selected_model_inference.py"

FEATURE_COLUMNS = [
    "lag_1",
    "lag_7",
    "lag_14",
    "rolling_mean_7",
    "rolling_mean_14",
    "day_of_week",
]

VALUES = [
    1.0, 1.2, 0.9, 1.1, 1.3, 1.0, 1.4,
    1.2, 1.1, 1.3, 1.5, 1.2, 1.4, 1.3,
]

KEYED_HISTORY = pd.DataFrame(
    [
        {
            "store_id": "operational",
            "product_id": "ingredient-test",
            "dt": f"2026-09-{day:02d}",
            "sale_amount": value,
        }
        for day, value in enumerate(VALUES, start=1)
    ]
)

SINGLE_SERIES_HISTORY = KEYED_HISTORY[
    ["dt", "sale_amount"]
].copy()

ONE_STEP_DATES = ["2026-09-15"]
MULTI_STEP_DATES = [
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
]


def load_runtime_module():
    spec = importlib.util.spec_from_file_location(
        "selected_model_inference_equivalence",
        RUNTIME_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(
            f"Unable to load inference runtime: {RUNTIME_PATH}"
        )

    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    return runtime


class SingleSeriesEquivalenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime = load_runtime_module()

        metadata = cls.runtime.load_artifact_metadata()
        metadata_checks = cls.runtime.validate_metadata_contract(
            metadata
        )
        if not all(metadata_checks.values()):
            failed = [
                key
                for key, passed in metadata_checks.items()
                if not passed
            ]
            raise AssertionError(
                f"Metadata contract failed: {failed}"
            )

        cls.model = cls.runtime.load_selected_model()
        model_checks = cls.runtime.validate_loaded_model_contract(
            cls.model
        )
        if not all(model_checks.values()):
            failed = [
                key
                for key, passed in model_checks.items()
                if not passed
            ]
            raise AssertionError(
                f"Model contract failed: {failed}"
            )

    def test_a_six_feature_values_match_current_keyed_path(self):
        keyed_history = self.runtime.validate_historical_data(
            KEYED_HISTORY
        )
        single_history = (
            self.runtime.validate_single_series_historical_data(
                SINGLE_SERIES_HISTORY
            )
        )

        forecast_date = pd.Timestamp("2026-09-15")

        keyed_features = self.runtime.build_recursive_feature_row(
            keyed_history,
            forecast_date,
        )[FEATURE_COLUMNS].reset_index(drop=True)

        single_features = (
            self.runtime.build_single_series_recursive_feature_row(
                single_history,
                forecast_date,
            )[FEATURE_COLUMNS].reset_index(drop=True)
        )

        np.testing.assert_allclose(
            keyed_features.to_numpy(dtype=float),
            single_features.to_numpy(dtype=float),
            rtol=0.0,
            atol=0.0,
        )

    def test_b_one_step_selected_rf_prediction_matches(self):
        keyed = self.runtime.recursive_forecast(
            self.model,
            KEYED_HISTORY,
            ONE_STEP_DATES,
        )

        single = self.runtime.recursive_forecast_single_series(
            self.model,
            SINGLE_SERIES_HISTORY,
            ONE_STEP_DATES,
        )

        np.testing.assert_allclose(
            keyed["predicted_consumption"].to_numpy(),
            single["predicted_consumption"].to_numpy(),
            rtol=1e-15,
            atol=1e-15,
        )

        self.assertAlmostEqual(
            float(single.iloc[0]["predicted_consumption"]),
            1.1824236092767064,
            places=12,
        )

    def test_c_multi_step_recursive_predictions_match(self):
        keyed = self.runtime.recursive_forecast(
            self.model,
            KEYED_HISTORY,
            MULTI_STEP_DATES,
        )

        single = self.runtime.recursive_forecast_single_series(
            self.model,
            SINGLE_SERIES_HISTORY,
            MULTI_STEP_DATES,
        )

        self.assertEqual(
            keyed["dt"].dt.date.astype(str).tolist(),
            single["dt"].dt.date.astype(str).tolist(),
        )

        np.testing.assert_allclose(
            keyed["predicted_consumption"].to_numpy(),
            single["predicted_consumption"].to_numpy(),
            rtol=1e-15,
            atol=1e-15,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
