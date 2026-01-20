/**
 * CSV Parser for Zerodha Tradebook files
 * Parses tradebook CSV content and returns structured TradeRecord array
 */

import Papa from 'papaparse';
import type { TradeRecord, TradeType } from '$lib/types';

/**
 * Expected columns in Zerodha Tradebook CSV
 */
interface RawTradeRow {
	symbol: string;
	isin: string;
	trade_date: string;
	exchange: string;
	segment: string;
	trade_type: string;
	quantity: string;
	price: string;
	order_id: string;
	trade_id: string;
}

/**
 * Required columns that must be present in a valid Tradebook CSV
 */
const REQUIRED_COLUMNS = [
	'symbol',
	'isin',
	'trade_date',
	'exchange',
	'segment',
	'trade_type',
	'quantity',
	'price',
	'trade_id'
] as const;

/**
 * Validates that all required columns are present in the CSV header
 */
function validateColumns(headers: string[]): boolean {
	const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
	return REQUIRED_COLUMNS.every((col) => normalizedHeaders.includes(col));
}

/**
 * Parses a date string in various formats to a Date object
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
 */
function parseTradeDate(dateStr: string): Date | null {
	if (!dateStr || typeof dateStr !== 'string') {
		return null;
	}

	const trimmed = dateStr.trim();

	// Try YYYY-MM-DD format first (ISO)
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		const date = new Date(trimmed + 'T00:00:00');
		if (!isNaN(date.getTime())) {
			return date;
		}
	}

	// Try DD-MM-YYYY format
	const dashMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (dashMatch) {
		const [, day, month, year] = dashMatch;
		const date = new Date(`${year}-${month}-${day}T00:00:00`);
		if (!isNaN(date.getTime())) {
			return date;
		}
	}

	// Try DD/MM/YYYY format
	const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (slashMatch) {
		const [, day, month, year] = slashMatch;
		const date = new Date(`${year}-${month}-${day}T00:00:00`);
		if (!isNaN(date.getTime())) {
			return date;
		}
	}

	return null;
}

/**
 * Validates and normalizes trade type to 'buy' or 'sell'
 */
function parseTradeType(tradeType: string): TradeType | null {
	const normalized = tradeType?.toLowerCase().trim();
	if (normalized === 'buy' || normalized === 'sell') {
		return normalized;
	}
	return null;
}

/**
 * Parses Zerodha Tradebook CSV content and returns structured TradeRecord array
 *
 * - Filters for EQ segment only (equities)
 * - Parses trade_date to Date object
 * - Maps CSV columns to TradeRecord interface
 * - Returns empty array for invalid format
 * - Sorts results by tradeDate ascending
 *
 * @param csvContent - Raw CSV content as string
 * @returns Array of TradeRecord objects, empty if invalid format or no EQ trades
 */
export function parseTradebook(csvContent: string): TradeRecord[] {
	if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length === 0) {
		return [];
	}

	try {
		const result = Papa.parse<RawTradeRow>(csvContent, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.toLowerCase().trim()
		});

		// Check for parse errors
		if (result.errors.length > 0) {
			// Log errors but continue if we have some data
			console.warn('CSV parse warnings:', result.errors);
		}

		// Validate required columns are present
		if (!result.meta.fields || !validateColumns(result.meta.fields)) {
			console.error('Invalid CSV format: missing required columns');
			return [];
		}

		// Filter for EQ segment and map to TradeRecord
		const trades: TradeRecord[] = [];

		for (const row of result.data) {
			// Skip non-equity trades (FO, CD, etc.)
			const segment = row.segment?.toUpperCase().trim();
			if (segment !== 'EQ') {
				continue;
			}

			// Parse and validate required fields
			const tradeDate = parseTradeDate(row.trade_date);
			if (!tradeDate) {
				console.warn(`Skipping row with invalid trade_date: ${row.trade_date}`);
				continue;
			}

			const tradeType = parseTradeType(row.trade_type);
			if (!tradeType) {
				console.warn(`Skipping row with invalid trade_type: ${row.trade_type}`);
				continue;
			}

			const quantity = parseFloat(row.quantity);
			if (isNaN(quantity) || quantity <= 0) {
				console.warn(`Skipping row with invalid quantity: ${row.quantity}`);
				continue;
			}

			const price = parseFloat(row.price);
			if (isNaN(price) || price < 0) {
				console.warn(`Skipping row with invalid price: ${row.price}`);
				continue;
			}

			const tradeId = row.trade_id?.trim();
			if (!tradeId) {
				console.warn('Skipping row with missing trade_id');
				continue;
			}

			const symbol = row.symbol?.trim();
			if (!symbol) {
				console.warn('Skipping row with missing symbol');
				continue;
			}

			const isin = row.isin?.trim() || '';
			const exchange = row.exchange?.toUpperCase().trim() || 'NSE';

			trades.push({
				tradeId,
				symbol,
				isin,
				tradeDate,
				exchange,
				tradeType,
				quantity,
				price
			});
		}

		// Sort by tradeDate ascending
		trades.sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());

		return trades;
	} catch (error) {
		console.error('Failed to parse CSV:', error);
		return [];
	}
}

/**
 * Merges multiple tradebook arrays into a single deduplicated array
 *
 * This function is needed because Zerodha Console limits Tradebook export to 1 financial year.
 * For accurate Long-Term classification (>12 months), users need to upload multiple tradebooks
 * spanning different financial years. When exports overlap, the same trade may appear in
 * multiple files - this function deduplicates them.
 *
 * - Flattens all trade arrays into a single array
 * - Deduplicates by tradeId (keeps first occurrence)
 * - Sorts chronologically by tradeDate ascending
 *
 * @param tradeLists - Array of TradeRecord arrays from multiple CSV files
 * @returns Single merged array of unique TradeRecord objects sorted by date
 */
export function mergeTradebooks(tradeLists: TradeRecord[][]): TradeRecord[] {
	// Flatten all trade lists into a single array
	const allTrades = tradeLists.flat();

	// Deduplicate by tradeId using a Map (keeps first occurrence)
	const uniqueTradesMap = new Map<string, TradeRecord>();

	for (const trade of allTrades) {
		if (!uniqueTradesMap.has(trade.tradeId)) {
			uniqueTradesMap.set(trade.tradeId, trade);
		}
	}

	// Convert map values to array
	const uniqueTrades = Array.from(uniqueTradesMap.values());

	// Sort chronologically by tradeDate ascending
	uniqueTrades.sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());

	return uniqueTrades;
}
