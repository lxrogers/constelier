// Promises the checkout, bag and policy pages all repeat. Change them here so
// they stay the same everywhere. Safe to import from client components.

// Cast to order: days from payment to shipping. Also each order's ship-by date.
export const SHIP_WITHIN_DAYS = 21;
export const SHIP_WITHIN_TEXT = `${SHIP_WITHIN_DAYS / 7} weeks`;

export const EXPRESS_SHIPPING_CENTS = 3500;
export const STANDARD_DELIVERY_DAYS = '3 to 5 business days';
export const EXPRESS_DELIVERY_DAYS = '1 to 2 business days';
