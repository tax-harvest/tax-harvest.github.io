/**
 * Kite Publisher utility for Tax Harvesting Tool
 * Generates basket URLs for redirecting users to Kite Connect for order execution
 *
 * Kite Publisher Flow:
 * 1. Generate basket JSON with order details
 * 2. Create form data with api_key and basket data
 * 3. Return URL and data for form POST to Kite Connect basket endpoint
 *
 * Note: This uses Kite Publisher (basket mode) which doesn't require OAuth.
 * Users authenticate directly on Kite's site when executing orders.
 */

import type { SellOrder, BuybackRecord } from '$lib/types';

/**
 * Kite basket order item structure
 * Matches the format expected by Kite Connect basket API
 */
interface KiteBasketItem {
	/** Order variety - 'regular' for normal orders */
	variety: 'regular' | 'amo' | 'co' | 'iceberg' | 'auction';
	/** Trading symbol (e.g., 'RELIANCE', 'TCS') */
	tradingsymbol: string;
	/** Exchange (NSE or BSE) */
	exchange: 'NSE' | 'BSE';
	/** Transaction type - BUY or SELL */
	transaction_type: 'BUY' | 'SELL';
	/** Order type - MARKET for immediate execution */
	order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
	/** Quantity of shares */
	quantity: number;
	/** Product type - CNC for delivery (cash and carry) */
	product: 'CNC' | 'MIS' | 'NRML';
	/** Whether the order details can be modified by user (optional) */
	readonly?: boolean;
}

/**
 * Data structure for Kite basket form submission
 */
interface KiteBasketData {
	/** Kite Connect API key */
	api_key: string;
	/** JSON stringified array of basket items */
	data: string;
}

/**
 * Kite Connect basket endpoint URL
 */
const KITE_BASKET_URL = 'https://kite.zerodha.com/connect/basket';

/**
 * Converts exchange string to Kite-compatible format
 * Ensures exchange is uppercase and valid
 */
function normalizeExchange(exchange: string): 'NSE' | 'BSE' {
	const normalized = exchange.toUpperCase();
	if (normalized === 'NSE' || normalized === 'BSE') {
		return normalized;
	}
	// Default to NSE if unknown exchange
	return 'NSE';
}

/**
 * Creates a Kite basket item from order details
 */
function createBasketItem(
	symbol: string,
	exchange: string,
	quantity: number,
	transactionType: 'BUY' | 'SELL'
): KiteBasketItem {
	return {
		variety: 'regular',
		tradingsymbol: symbol,
		exchange: normalizeExchange(exchange),
		transaction_type: transactionType,
		order_type: 'MARKET',
		quantity: quantity,
		product: 'CNC'
	};
}

/**
 * Generates basket data object for Kite Publisher
 *
 * @param items - Array of basket items
 * @param apiKey - Kite Connect API key
 * @returns Basket data object ready for form submission
 */
function generateBasketData(items: KiteBasketItem[], apiKey: string): KiteBasketData {
	return {
		api_key: apiKey,
		data: JSON.stringify(items)
	};
}

/**
 * Generates a URL with encoded basket data for Kite Publisher
 * This creates a URL that can be used to redirect users to Kite Connect
 * with pre-filled order details.
 *
 * Usage: The returned URL and data should be used with a form POST submission:
 * ```typescript
 * const { url, data } = generateSellBasketUrl(orders, apiKey);
 * // Create form and submit to url with data as form fields
 * ```
 *
 * @param orders - Array of SellOrder objects representing stocks to sell
 * @param apiKey - Kite Connect API key (public key, not secret)
 * @returns Object with URL and data for form POST submission
 */
export function generateSellBasketUrl(
	orders: SellOrder[],
	apiKey: string
): { url: string; data: KiteBasketData } {
	if (!orders || orders.length === 0) {
		throw new Error('No orders provided for basket generation');
	}

	if (!apiKey || apiKey.trim() === '') {
		throw new Error('API key is required for Kite basket generation');
	}

	const basketItems: KiteBasketItem[] = orders.map((order) =>
		createBasketItem(order.symbol, order.exchange, order.quantity, 'SELL')
	);

	const basketData = generateBasketData(basketItems, apiKey);

	return {
		url: KITE_BASKET_URL,
		data: basketData
	};
}

/**
 * Generates a URL with encoded basket data for buying back sold stocks
 * This creates a URL that can be used to redirect users to Kite Connect
 * with pre-filled BUY order details for stocks that were previously sold.
 *
 * Usage: The returned URL and data should be used with a form POST submission:
 * ```typescript
 * const { url, data } = generateBuyBasketUrl(buybacks, apiKey);
 * // Create form and submit to url with data as form fields
 * ```
 *
 * @param buybacks - Array of BuybackRecord objects representing stocks to buy back
 * @param apiKey - Kite Connect API key (public key, not secret)
 * @returns Object with URL and data for form POST submission
 */
export function generateBuyBasketUrl(
	buybacks: BuybackRecord[],
	apiKey: string
): { url: string; data: KiteBasketData } {
	if (!buybacks || buybacks.length === 0) {
		throw new Error('No buyback records provided for basket generation');
	}

	if (!apiKey || apiKey.trim() === '') {
		throw new Error('API key is required for Kite basket generation');
	}

	const basketItems: KiteBasketItem[] = buybacks.map((buyback) =>
		createBasketItem(buyback.symbol, buyback.exchange, buyback.quantity, 'BUY')
	);

	const basketData = generateBasketData(basketItems, apiKey);

	return {
		url: KITE_BASKET_URL,
		data: basketData
	};
}

/**
 * Opens Kite Publisher in a new window/tab by creating and submitting a form
 * This handles the form POST submission required by Kite Connect basket API.
 *
 * Note: This function should only be called in a browser environment.
 *
 * @param url - Kite basket URL
 * @param data - Basket data with api_key and order data
 * @param target - Window target (_blank for new tab, _self for same window)
 */
export function submitToKitePublisher(
	url: string,
	data: KiteBasketData,
	target: '_blank' | '_self' = '_blank'
): void {
	// Create a form element for POST submission
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = url;
	form.target = target;
	form.style.display = 'none';

	// Add api_key field
	const apiKeyInput = document.createElement('input');
	apiKeyInput.type = 'hidden';
	apiKeyInput.name = 'api_key';
	apiKeyInput.value = data.api_key;
	form.appendChild(apiKeyInput);

	// Add data field (JSON stringified basket items)
	const dataInput = document.createElement('input');
	dataInput.type = 'hidden';
	dataInput.name = 'data';
	dataInput.value = data.data;
	form.appendChild(dataInput);

	// Append form to body, submit, and remove
	document.body.appendChild(form);
	form.submit();
	document.body.removeChild(form);
}

/**
 * Convenience function to generate and submit sell orders to Kite Publisher
 * Combines generateSellBasketUrl and submitToKitePublisher into a single call.
 *
 * @param orders - Array of SellOrder objects representing stocks to sell
 * @param apiKey - Kite Connect API key
 * @param target - Window target (_blank for new tab, _self for same window)
 */
export function executeSellOrders(
	orders: SellOrder[],
	apiKey: string,
	target: '_blank' | '_self' = '_blank'
): void {
	const { url, data } = generateSellBasketUrl(orders, apiKey);
	submitToKitePublisher(url, data, target);
}

/**
 * Convenience function to generate and submit buyback orders to Kite Publisher
 * Combines generateBuyBasketUrl and submitToKitePublisher into a single call.
 *
 * @param buybacks - Array of BuybackRecord objects representing stocks to buy back
 * @param apiKey - Kite Connect API key
 * @param target - Window target (_blank for new tab, _self for same window)
 */
export function executeBuybackOrders(
	buybacks: BuybackRecord[],
	apiKey: string,
	target: '_blank' | '_self' = '_blank'
): void {
	const { url, data } = generateBuyBasketUrl(buybacks, apiKey);
	submitToKitePublisher(url, data, target);
}
