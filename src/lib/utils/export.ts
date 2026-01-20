/**
 * CSV Export utility for Tax Harvesting Tool
 * Generates and downloads holdings data as CSV file
 */

import Papa from 'papaparse';
import type { Holding } from '$lib/types';

/**
 * CSV row structure when Kite is connected (currentPrice available)
 */
interface FullExportRow {
	symbol: string;
	exchange: string;
	quantity: number;
	purchaseDate: string;
	avgPurchasePrice: string;
	currentPrice: string;
	pnl: string;
	pnlPercent: string;
	classification: string;
}

/**
 * CSV row structure when Kite is NOT connected (no currentPrice)
 */
interface BasicExportRow {
	symbol: string;
	exchange: string;
	quantity: number;
	purchaseDate: string;
	avgPurchasePrice: string;
	classification: string;
}

/**
 * Formats a Date object to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Formats a number to 2 decimal places
 */
function formatNumber(value: number): string {
	return value.toFixed(2);
}

/**
 * Formats classification for display (ST/LT)
 */
function formatClassification(classification: 'SHORT_TERM' | 'LONG_TERM'): string {
	return classification === 'SHORT_TERM' ? 'ST' : 'LT';
}

/**
 * Checks if any holding has currentPrice available
 * This determines whether Kite is connected and we have live prices
 */
function hasCurrentPrices(holdings: Holding[]): boolean {
	return holdings.some((h) => h.currentPrice !== undefined && h.currentPrice !== null);
}

/**
 * Generates current date string in YYYY-MM-DD format for filename
 */
function getCurrentDateString(): string {
	return formatDate(new Date());
}

/**
 * Triggers browser download of the CSV content
 */
function triggerDownload(csvContent: string, filename: string): void {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.setAttribute('href', url);
	link.setAttribute('download', filename);
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up the URL object
	URL.revokeObjectURL(url);
}

/**
 * Exports holdings data to CSV file and triggers download
 *
 * When Kite is connected (currentPrice available):
 * - Columns: symbol, exchange, quantity, purchaseDate, avgPurchasePrice, currentPrice, pnl, pnlPercent, classification
 *
 * When Kite is NOT connected (no currentPrice):
 * - Columns: symbol, exchange, quantity, purchaseDate, avgPurchasePrice, classification
 *
 * Downloads file with name: tax_harvesting_YYYY-MM-DD.csv
 *
 * @param holdings - Array of Holding objects to export
 */
export function exportHoldingsToCSV(holdings: Holding[]): void {
	if (!holdings || holdings.length === 0) {
		console.warn('No holdings to export');
		return;
	}

	const hasLivePrices = hasCurrentPrices(holdings);
	const filename = `tax_harvesting_${getCurrentDateString()}.csv`;

	let csvContent: string;

	if (hasLivePrices) {
		// Full export with current prices and P&L
		const rows: FullExportRow[] = holdings.map((holding) => ({
			symbol: holding.symbol,
			exchange: holding.exchange,
			quantity: holding.totalQuantity,
			purchaseDate: formatDate(holding.oldestPurchaseDate),
			avgPurchasePrice: formatNumber(holding.avgPurchasePrice),
			currentPrice: holding.currentPrice !== undefined ? formatNumber(holding.currentPrice) : '',
			pnl: holding.pnl !== undefined ? formatNumber(holding.pnl) : '',
			pnlPercent: holding.pnlPercent !== undefined ? formatNumber(holding.pnlPercent) : '',
			classification: formatClassification(holding.classification)
		}));

		csvContent = Papa.unparse(rows, {
			columns: [
				'symbol',
				'exchange',
				'quantity',
				'purchaseDate',
				'avgPurchasePrice',
				'currentPrice',
				'pnl',
				'pnlPercent',
				'classification'
			]
		});
	} else {
		// Basic export without current prices (Kite not connected)
		const rows: BasicExportRow[] = holdings.map((holding) => ({
			symbol: holding.symbol,
			exchange: holding.exchange,
			quantity: holding.totalQuantity,
			purchaseDate: formatDate(holding.oldestPurchaseDate),
			avgPurchasePrice: formatNumber(holding.avgPurchasePrice),
			classification: formatClassification(holding.classification)
		}));

		csvContent = Papa.unparse(rows, {
			columns: ['symbol', 'exchange', 'quantity', 'purchaseDate', 'avgPurchasePrice', 'classification']
		});
	}

	triggerDownload(csvContent, filename);
}
