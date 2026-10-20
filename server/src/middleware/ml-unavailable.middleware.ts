import type { RequestHandler } from 'express';

/**
 * Answer an ML-backed endpoint that this deployment cannot serve.
 *
 * WHY A REAL HANDLER RATHER THAN NO ROUTE: the forecasting routes used to be
 * registered only when the Python worker was configured, so an unconfigured
 * deployment answered them with the router's catch-all 404. A client cannot
 * tell that 404 apart from a wrong URL, so it sat on its loading placeholder
 * for ever. Keeping the route registered answers with the same UNAVAILABLE
 * status the configured services already return, and the caller can say why.
 *
 * @param reason - machine-readable cause, reported verbatim to the caller.
 * @returns a handler that replies 200 with an UNAVAILABLE result.
 */
export function mlUnavailable(reason = 'ML_UNAVAILABLE'): RequestHandler {
  return (_req, res) => {
    res.status(200).json({ status: 'UNAVAILABLE', reason });
  };
}
