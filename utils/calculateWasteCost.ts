// wasteCost = quantityWasted × unitCost (the batch's actual cost per unit)
function calculateWasteCost(quantityWasted: number, unitCost: number): number {
  return Number((quantityWasted * unitCost).toFixed(2));
}

export default calculateWasteCost;
