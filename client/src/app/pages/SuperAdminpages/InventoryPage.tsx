import React from 'react';
import IngredientInventory from '../../../components/IngredientInventory';
import SidebarLayout from '../../../components/sidebar';

export default function Inventory(): React.ReactElement {
    return (
        <SidebarLayout>
        <IngredientInventory />
        </SidebarLayout>
    );
}