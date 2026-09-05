// Calculates a batch's status based on how many days remain until expiration.
// Thresholds can be adjusted later per your team's FEFO policy.
function calculateBatchStatus(expirationDate) {
  const now = new Date();
  const expiry = new Date(expirationDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((expiry - now) / msPerDay);

  if (daysRemaining < 0) return "Expired";
  if (daysRemaining <= 2) return "Critical";
  if (daysRemaining <= 7) return "Approaching Expiry";
  return "Normal";
}

module.exports = calculateBatchStatus;