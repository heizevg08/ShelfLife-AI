"""Runtime inference boundary for the selected ShelfLife AI forecast model.
This module loads the persisted selected-development-model artifact and its
metadata, validates their inference contract, and provides the foundation for
forecasting from historical observations without retraining the estimator.

Important boundaries:
- The current persisted model forecasts FreshRetailNet-50K ``sale_amount``,
  which is a public proxy for observed perishable-product demand.
- It must not be represented as actual restaurant ingredient consumption.
- Future ShelfLife AI operational inference is intended to use aggregated
  ``UsageRecord.quantityUsed`` histories after system-specific validation.
- Inventory and expiry risk classification remains deterministic downstream
  business logic.
- Stockout-induced demand censoring remains unresolved.
- The production forecasting horizon is not finalized.
- joblib artifacts must only be loaded from trusted sources.
"""

import hashlib
import json
import platform
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

ML_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ML_ROOT / "models" / "selected_random_forest.joblib"
METADATA_PATH = ML_ROOT / "models" / "selected_random_forest_metadata.json"
EXPECTED_MODEL_SHA256 = (
    "14b76d5b108ad1a55b6f9e7c84b012623e6a506774ac0211ee9877e085ee6fc7"
)

EXPECTED_MODEL_NAME = "ShelfLife AI Selected Global Random Forest Regression"
EXPECTED_MODEL_STAGE = "selected-development-model"
EXPECTED_ESTIMATOR = "RandomForestRegressor"
EXPECTED_TARGET = "sale_amount"

EXPECTED_FEATURE_COLUMNS = [
    "lag_1",
    "lag_7",
    "lag_14",
    "rolling_mean_7",
    "rolling_mean_14",
    "day_of_week",
]

EXPECTED_MODEL_PARAMETERS = {
    "n_estimators": 50,
    "max_depth": 12,
    "min_samples_leaf": 20,
    "max_features": 1.0,
    "n_jobs": -1,
    "random_state": 42,
}


def compute_model_sha256(
    model_path: Path = MODEL_PATH,
) -> str:
    """Hash a trusted artifact before deserialization.

    Args:
        model_path: Local model artifact to read.

    Returns:
        Hex-encoded SHA-256 digest.

    Raises:
        OSError: The artifact cannot be read.
    """
    digest = hashlib.sha256()
    with model_path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_artifact_metadata() -> dict:
    """Read the metadata contract paired with the selected model.

    Returns:
        Parsed metadata mapping.

    Raises:
        FileNotFoundError: The metadata artifact is absent.
        json.JSONDecodeError: The metadata is malformed.
    """
    if not METADATA_PATH.exists():
        raise FileNotFoundError(f"Model metadata not found: {METADATA_PATH}")

    with METADATA_PATH.open(
        "r",
        encoding="utf-8",
    ) as metadata_file:
        return json.load(metadata_file)


def validate_metadata_contract(
    metadata: dict,
) -> dict[str, bool]:
    """Check artifact identity and environment before using the model.

    Args:
        metadata: Parsed persisted-model metadata.

    Returns:
        Named contract checks and their pass/fail results.
    """
    environment = metadata.get("environment", {})
    persistence = metadata.get("persistence", {})

    return {
        "model_name_matches": (metadata.get("model_name") == EXPECTED_MODEL_NAME),
        "model_stage_matches": (metadata.get("model_stage") == EXPECTED_MODEL_STAGE),
        "estimator_matches": (metadata.get("estimator") == EXPECTED_ESTIMATOR),
        "target_matches": (metadata.get("target") == EXPECTED_TARGET),
        "feature_columns_match": (
            metadata.get("feature_columns") == EXPECTED_FEATURE_COLUMNS
        ),
        "model_parameters_match": (
            metadata.get("model_parameters") == EXPECTED_MODEL_PARAMETERS
        ),
        "python_version_matches": (
            environment.get("python") == platform.python_version()
        ),
        "sklearn_version_matches": (
            environment.get("scikit_learn") == sklearn.__version__
        ),
        "joblib_version_matches": (environment.get("joblib") == joblib.__version__),
        "numpy_version_matches": (environment.get("numpy") == np.__version__),
        "trusted_source_only_recorded": (
            persistence.get("trusted_source_only") is True
        ),
        "cross_version_safety_not_assumed": (
            persistence.get("cross_version_loading_assumed_safe") is False
        ),
        "artifact_sha256_recorded": (
            persistence.get("sha256") == EXPECTED_MODEL_SHA256
        ),
    }


def load_selected_model():
    """Deserialize the trusted selected model only after a digest check.

    Returns:
        Persisted fitted estimator.

    Raises:
        FileNotFoundError: The model artifact is absent.
        RuntimeError: The artifact digest differs from the trusted digest.
    """
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model artifact not found: {MODEL_PATH}")

    actual_sha256 = compute_model_sha256(MODEL_PATH)
    if actual_sha256 != EXPECTED_MODEL_SHA256:
        raise RuntimeError("Model failed SHA-256 check before deserialization.")

    return joblib.load(MODEL_PATH)


def validate_loaded_model_contract(
    model,
) -> dict[str, bool]:
    """Check that a loaded estimator has the persisted feature contract.

    Args:
        model: Deserialized fitted estimator.

    Returns:
        Named estimator checks and their pass/fail results.
    """
    feature_names = getattr(
        model,
        "feature_names_in_",
        None,
    )

    return {
        "estimator_type_matches": (model.__class__.__name__ == EXPECTED_ESTIMATOR),
        "feature_count_matches": (
            getattr(model, "n_features_in_", None) == len(EXPECTED_FEATURE_COLUMNS)
        ),
        "feature_names_match": (
            feature_names is not None
            and feature_names.tolist() == EXPECTED_FEATURE_COLUMNS
        ),
        "n_estimators_matches": (
            getattr(model, "n_estimators", None)
            == EXPECTED_MODEL_PARAMETERS["n_estimators"]
        ),
        "max_depth_matches": (
            getattr(model, "max_depth", None) == EXPECTED_MODEL_PARAMETERS["max_depth"]
        ),
        "min_samples_leaf_matches": (
            getattr(model, "min_samples_leaf", None)
            == EXPECTED_MODEL_PARAMETERS["min_samples_leaf"]
        ),
        "max_features_matches": (
            getattr(model, "max_features", None)
            == EXPECTED_MODEL_PARAMETERS["max_features"]
        ),
        "random_state_matches": (
            getattr(model, "random_state", None)
            == EXPECTED_MODEL_PARAMETERS["random_state"]
        ),
    }


RUNTIME_KEYS = [
    "store_id",
    "product_id",
]

RUNTIME_HISTORY_COLUMNS = RUNTIME_KEYS + ["dt", "sale_amount"]

MINIMUM_HISTORY_ROWS = 14


SINGLE_SERIES_HISTORY_COLUMNS = [
    "dt",
    "sale_amount",
]


def validate_single_series_historical_data(
    historical_data: pd.DataFrame,
) -> pd.DataFrame:
    """Validate one series after the service has resolved its domain identity.

    Dataset-specific ``store_id`` and ``product_id`` are excluded here.

    Args:
        historical_data: Dated consumption observations for one series.

    Returns:
        Normalized history ready for recursive features.

    Raises:
        ValueError: Required history fields or values are invalid.
    """
    missing_columns = [
        column
        for column in SINGLE_SERIES_HISTORY_COLUMNS
        if column not in historical_data.columns
    ]

    if missing_columns:
        raise ValueError(
            "Single-series historical data is missing required columns: "
            f"{missing_columns}"
        )

    unsupported_columns = [
        column
        for column in historical_data.columns
        if column not in SINGLE_SERIES_HISTORY_COLUMNS
    ]

    if unsupported_columns:
        raise ValueError(
            "Single-series historical data contains unsupported columns: "
            f"{unsupported_columns}"
        )

    history = historical_data[SINGLE_SERIES_HISTORY_COLUMNS].copy()

    history["dt"] = pd.to_datetime(
        history["dt"],
        errors="raise",
    )

    history["sale_amount"] = pd.to_numeric(
        history["sale_amount"],
        errors="raise",
    )

    if history[SINGLE_SERIES_HISTORY_COLUMNS].isna().any().any():
        raise ValueError(
            "Single-series historical data contains missing required values."
        )

    if (history["sale_amount"] < 0).any():
        raise ValueError("Historical demand values cannot be negative.")

    if history.duplicated(subset=["dt"]).any():
        raise ValueError("Single-series historical data contains duplicate dates.")

    history = history.sort_values(["dt"]).reset_index(drop=True)

    if len(history) < MINIMUM_HISTORY_ROWS:
        raise ValueError(
            "Single-series forecasting requires at least "
            f"{MINIMUM_HISTORY_ROWS} historical observations."
        )

    return history


def build_single_series_recursive_feature_row(
    history: pd.DataFrame,
    forecast_date: pd.Timestamp,
) -> pd.DataFrame:
    """Match the six persisted features without adding domain identity.

    Args:
        history: Validated observations and prior recursive predictions.
        forecast_date: Date of the next prediction.

    Returns:
        One feature row in the model's expected column order.
    """
    ordered = history.sort_values(["dt"]).reset_index(drop=True)

    values = ordered["sale_amount"]

    feature_frame = pd.DataFrame(
        [
            {
                "lag_1": float(values.iloc[-1]),
                "lag_7": float(values.iloc[-7]),
                "lag_14": float(values.iloc[-14]),
                "rolling_mean_7": float(values.tail(7).mean()),
                "rolling_mean_14": float(values.tail(14).mean()),
                "day_of_week": int(forecast_date.dayofweek),
                "dt": forecast_date,
            }
        ]
    )

    return feature_frame


def recursive_forecast_single_series(
    model,
    historical_data: pd.DataFrame,
    forecast_dates: list[pd.Timestamp],
) -> pd.DataFrame:
    """Forecast one isolated series, appending each prediction to history.

    The service, not this numerical boundary, chooses the ShelfLife entity.

    Args:
        model: Validated selected estimator.
        historical_data: Observed consumption for one series.
        forecast_dates: Ordered future dates to predict.

    Returns:
        Dated recursive predictions for the requested horizon.

    Raises:
        ValueError: History or forecast dates violate the model contract.
    """
    history = validate_single_series_historical_data(historical_data)

    forecast_dates = validate_forecast_dates(
        forecast_dates,
        history,
    )

    predictions = []

    for forecast_date in forecast_dates:
        forecast_date = pd.Timestamp(forecast_date)

        feature_frame = build_single_series_recursive_feature_row(
            history,
            forecast_date,
        )

        if feature_frame[EXPECTED_FEATURE_COLUMNS].isna().any().any():
            raise ValueError("Recursive forecast features contain " "missing values.")

        X_forecast = feature_frame[EXPECTED_FEATURE_COLUMNS]

        predicted = np.maximum(
            model.predict(X_forecast),
            0.0,
        )

        predicted_value = float(predicted[0])

        predictions.append(
            {
                "dt": forecast_date,
                "predicted_consumption": predicted_value,
            }
        )

        history = pd.concat(
            [
                history,
                pd.DataFrame(
                    [
                        {
                            "dt": forecast_date,
                            "sale_amount": predicted_value,
                        }
                    ]
                ),
            ],
            ignore_index=True,
        )

    if not predictions:
        return pd.DataFrame(
            columns=[
                "dt",
                "predicted_consumption",
            ]
        )

    return pd.DataFrame(predictions)


def validate_historical_data(
    historical_data: pd.DataFrame,
) -> pd.DataFrame:
    """Validate the development artifact's keyed store-product history.

    This representation is not the operational ShelfLife API schema.

    Args:
        historical_data: Raw keyed observations.

    Returns:
        Normalized model history.

    Raises:
        ValueError: Required keys, dates, or quantities are invalid.
    """
    missing_columns = [
        column
        for column in RUNTIME_HISTORY_COLUMNS
        if column not in historical_data.columns
    ]

    if missing_columns:
        raise ValueError(
            "Historical data is missing required columns: " f"{missing_columns}"
        )

    history = historical_data[RUNTIME_HISTORY_COLUMNS].copy()

    history["dt"] = pd.to_datetime(
        history["dt"],
        errors="raise",
    )

    history["sale_amount"] = pd.to_numeric(
        history["sale_amount"],
        errors="raise",
    )

    if history[RUNTIME_HISTORY_COLUMNS].isna().any().any():
        raise ValueError("Historical data contains missing required values.")

    if (history["sale_amount"] < 0).any():
        raise ValueError("Historical demand values cannot be negative.")

    duplicate_rows = history.duplicated(
        subset=RUNTIME_KEYS + ["dt"],
    )

    if duplicate_rows.any():
        raise ValueError(
            "Historical data contains duplicate " "series-date observations."
        )

    history = history.sort_values(RUNTIME_KEYS + ["dt"]).reset_index(drop=True)

    series_counts = history.groupby(
        RUNTIME_KEYS,
        sort=False,
    ).size()

    insufficient_series = series_counts[series_counts < MINIMUM_HISTORY_ROWS]

    if not insufficient_series.empty:
        raise ValueError(
            "Each forecasting series requires at least "
            f"{MINIMUM_HISTORY_ROWS} historical observations."
        )

    return history


def build_recursive_feature_row(
    history: pd.DataFrame,
    forecast_date: pd.Timestamp,
) -> pd.DataFrame:
    """Reproduce the selected model's leakage-safe keyed features.

    Args:
        history: Validated keyed observations and prior predictions.
        forecast_date: Date of the next recursive step.

    Returns:
        Feature rows in the persisted model's column order.
    """
    ordered = history.sort_values(RUNTIME_KEYS + ["dt"]).copy()

    grouped = ordered.groupby(
        RUNTIME_KEYS,
        sort=False,
    )

    feature_frame = grouped.tail(1)[RUNTIME_KEYS].copy()

    feature_frame["lag_1"] = grouped["sale_amount"].nth(-1).to_numpy()

    feature_frame["lag_7"] = grouped["sale_amount"].nth(-7).to_numpy()

    feature_frame["lag_14"] = grouped["sale_amount"].nth(-14).to_numpy()

    rolling_7 = (
        ordered.groupby(
            RUNTIME_KEYS,
            sort=False,
        )
        .tail(7)
        .groupby(
            RUNTIME_KEYS,
            sort=False,
        )["sale_amount"]
        .mean()
    )

    rolling_14 = (
        ordered.groupby(
            RUNTIME_KEYS,
            sort=False,
        )
        .tail(14)
        .groupby(
            RUNTIME_KEYS,
            sort=False,
        )["sale_amount"]
        .mean()
    )

    feature_frame["rolling_mean_7"] = rolling_7.to_numpy()

    feature_frame["rolling_mean_14"] = rolling_14.to_numpy()

    feature_frame["day_of_week"] = forecast_date.dayofweek

    feature_frame["dt"] = forecast_date

    return feature_frame


def validate_forecast_dates(
    forecast_dates,
    historical_data: pd.DataFrame,
) -> list[pd.Timestamp]:
    """Reject missing, duplicate, or non-future dates before prediction.

    Args:
        forecast_dates: Requested date values.
        historical_data: Validated observations defining the last known date.

    Returns:
        Normalized future timestamps.

    Raises:
        ValueError: Dates are malformed or violate the forecast horizon.
    """
    if not forecast_dates:
        return []

    try:
        normalized_dates = [pd.Timestamp(date) for date in forecast_dates]
    except (TypeError, ValueError) as exc:
        raise ValueError("Forecast dates contain an invalid date value.") from exc

    if any(pd.isna(date) for date in normalized_dates):
        raise ValueError("Forecast dates cannot contain missing values.")

    if len(set(normalized_dates)) != len(normalized_dates):
        raise ValueError("Forecast dates cannot contain duplicates.")

    if normalized_dates != sorted(normalized_dates):
        raise ValueError("Forecast dates must be in ascending order.")

    latest_history_date = historical_data["dt"].max()

    if any(date <= latest_history_date for date in normalized_dates):
        raise ValueError(
            "Forecast dates must occur after the latest " "historical observation."
        )

    return normalized_dates


def recursive_forecast(
    model,
    historical_data: pd.DataFrame,
    forecast_dates: list[pd.Timestamp],
) -> pd.DataFrame:
    """Reproduce keyed recursive forecasts by feeding predictions back into history.

    Args:
        model: Validated selected estimator.
        historical_data: Keyed observations for the requested series.
        forecast_dates: Ordered future dates to predict.

    Returns:
        Dated recursive predictions.

    Raises:
        ValueError: History or requested dates are invalid.
    """
    history = validate_historical_data(historical_data)

    forecast_dates = validate_forecast_dates(
        forecast_dates,
        history,
    )

    predictions = []

    for forecast_date in forecast_dates:
        forecast_date = pd.Timestamp(forecast_date)

        feature_frame = build_recursive_feature_row(
            history,
            forecast_date,
        )

        if feature_frame[EXPECTED_FEATURE_COLUMNS].isna().any().any():
            raise ValueError("Recursive forecast features contain " "missing values.")

        X_forecast = feature_frame[EXPECTED_FEATURE_COLUMNS]

        predicted = np.maximum(
            model.predict(X_forecast),
            0.0,
        )

        step_predictions = feature_frame[RUNTIME_KEYS + ["dt"]].copy()

        step_predictions["predicted_consumption"] = predicted

        predictions.append(step_predictions)

        recursive_rows = step_predictions.rename(
            columns={"predicted_consumption": "sale_amount"}
        )

        history = pd.concat(
            [
                history,
                recursive_rows[RUNTIME_HISTORY_COLUMNS],
            ],
            ignore_index=True,
        )

    if not predictions:
        return pd.DataFrame(
            columns=(
                RUNTIME_KEYS
                + [
                    "dt",
                    "predicted_consumption",
                ]
            )
        )

    return pd.concat(
        predictions,
        ignore_index=True,
    )


def run_selected_model_inference(
    historical_data: pd.DataFrame,
    forecast_dates: list[pd.Timestamp],
) -> pd.DataFrame:
    """Validate the selected artifact before generating development forecasts.

    Dataset A predictions are not validated restaurant ingredient consumption.

    Args:
        historical_data: Keyed observations accepted by the development model.
        forecast_dates: Ordered future dates to predict.

    Returns:
        Dated recursive predictions.

    Raises:
        FileNotFoundError: A required model artifact is absent.
        RuntimeError: The artifact or metadata fails validation.
        ValueError: History or requested dates are invalid.
    """
    metadata = load_artifact_metadata()

    metadata_checks = validate_metadata_contract(metadata)

    if not all(metadata_checks.values()):
        failed_checks = [name for name, passed in metadata_checks.items() if not passed]

        raise RuntimeError(
            "Persisted model metadata failed the "
            "inference contract: "
            f"{failed_checks}"
        )

    model = load_selected_model()

    model_checks = validate_loaded_model_contract(model)

    if not all(model_checks.values()):
        failed_checks = [name for name, passed in model_checks.items() if not passed]

        raise RuntimeError(
            "Persisted model failed the inference " "contract: " f"{failed_checks}"
        )

    return recursive_forecast(
        model,
        historical_data,
        forecast_dates,
    )
