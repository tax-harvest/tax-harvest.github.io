/**
 * Tradebook Store
 * Manages uploaded tradebook files, parsed trades, and parse errors
 * Supports multiple file uploads with deduplication across files
 */

import { writable, get } from 'svelte/store';
import type { TradeRecord, UploadedFile } from '$lib/types';
import { parseTradebook, mergeTradebooks } from '$lib/utils/csv-parser';

/**
 * Store for uploaded file metadata
 */
export const uploadedFiles = writable<UploadedFile[]>([]);

/**
 * Store for all merged and deduplicated trades
 */
export const allTrades = writable<TradeRecord[]>([]);

/**
 * Store for parse errors keyed by file ID
 */
export const parseErrors = writable<Map<string, string>>(new Map());

/**
 * Internal storage for raw trades per file (enables recalculation on remove)
 */
const tradesPerFile = new Map<string, TradeRecord[]>();

/**
 * Generates a unique ID for uploaded files
 */
function generateFileId(): string {
	return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determines the financial year from a date
 * Indian Financial Year runs from April 1 to March 31
 * e.g., April 2023 to March 2024 is "FY 2023-24"
 */
function getFinancialYear(date: Date): { startYear: number; endYear: number } {
	const month = date.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
	const year = date.getFullYear();

	// If month is Jan-Mar (0-2), it belongs to previous FY
	// If month is Apr-Dec (3-11), it belongs to current FY
	if (month < 3) {
		return { startYear: year - 1, endYear: year };
	} else {
		return { startYear: year, endYear: year + 1 };
	}
}

/**
 * Determines the FY range string from an array of trades
 * Returns a range like "FY 2022-23 to FY 2023-24" if spanning multiple years
 * or "FY 2023-24" if within a single year
 */
function determineFyRange(trades: TradeRecord[]): string {
	if (trades.length === 0) {
		return 'No trades';
	}

	// Sort trades by date to find earliest and latest
	const sortedTrades = [...trades].sort(
		(a, b) => a.tradeDate.getTime() - b.tradeDate.getTime()
	);

	const earliestDate = sortedTrades[0].tradeDate;
	const latestDate = sortedTrades[sortedTrades.length - 1].tradeDate;

	const earliestFy = getFinancialYear(earliestDate);
	const latestFy = getFinancialYear(latestDate);

	const formatFy = (fy: { startYear: number; endYear: number }): string => {
		const endYearShort = fy.endYear.toString().slice(-2);
		return `FY ${fy.startYear}-${endYearShort}`;
	};

	if (earliestFy.startYear === latestFy.startYear) {
		return formatFy(earliestFy);
	} else {
		return `${formatFy(earliestFy)} to ${formatFy(latestFy)}`;
	}
}

/**
 * Reads a File object as text using FileReader
 * Returns a Promise that resolves with the file content
 */
function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
			} else {
				reject(new Error('Failed to read file as text'));
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsText(file);
	});
}

/**
 * Recalculates allTrades from the tradesPerFile map
 * Called after adding or removing files
 */
function recalculateAllTrades(): void {
	const allTradeArrays = Array.from(tradesPerFile.values());
	const merged = mergeTradebooks(allTradeArrays);
	allTrades.set(merged);
}

/**
 * Adds tradebook files to the store
 * - Parses each file using parseTradebook
 * - Generates unique ID and metadata for each file
 * - Tracks parse errors per file
 * - Merges all trades using mergeTradebooks
 *
 * @param files - FileList from file input element
 */
export async function addTradebooks(files: FileList): Promise<void> {
	const currentErrors = get(parseErrors);
	const newErrors = new Map(currentErrors);

	const newUploadedFiles: UploadedFile[] = [];

	// Convert FileList to Array to prevent issues with FileList being invalidated during async operations
	const fileArray = Array.from(files);

	for (const file of fileArray) {
		const fileId = generateFileId();

		try {
			const content = await readFileAsText(file);
			const trades = parseTradebook(content);

			if (trades.length === 0) {
				// Either invalid format or no EQ trades
				newErrors.set(fileId, `No valid equity trades found in ${file.name}. Please ensure this is a Zerodha Tradebook CSV with equity (EQ) segment trades.`);
				continue;
			}

			// Store trades for this file
			tradesPerFile.set(fileId, trades);

			// Calculate date range
			const sortedTrades = [...trades].sort(
				(a, b) => a.tradeDate.getTime() - b.tradeDate.getTime()
			);
			const dateRange = {
				from: sortedTrades[0].tradeDate,
				to: sortedTrades[sortedTrades.length - 1].tradeDate
			};

			// Create uploaded file metadata
			const uploadedFile: UploadedFile = {
				id: fileId,
				name: file.name,
				fyRange: determineFyRange(trades),
				tradeCount: trades.length,
				dateRange
			};

			newUploadedFiles.push(uploadedFile);

			// Clear any previous error for this file
			newErrors.delete(fileId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			newErrors.set(fileId, `Failed to read ${file.name}: ${errorMessage}`);
		}
	}

	// Update stores
	if (newUploadedFiles.length > 0) {
		uploadedFiles.update((current) => [...current, ...newUploadedFiles]);
	}

	parseErrors.set(newErrors);

	// Recalculate merged trades
	recalculateAllTrades();
}

/**
 * Removes a tradebook file and recalculates merged trades
 *
 * @param fileId - ID of the file to remove
 */
export function removeTradebook(fileId: string): void {
	// Remove from internal storage
	tradesPerFile.delete(fileId);

	// Remove from uploaded files store
	uploadedFiles.update((current) => current.filter((f) => f.id !== fileId));

	// Remove any associated error
	parseErrors.update((current) => {
		const updated = new Map(current);
		updated.delete(fileId);
		return updated;
	});

	// Recalculate merged trades
	recalculateAllTrades();
}

/**
 * Clears all tradebook data and resets all stores
 */
export function clearAllTradebooks(): void {
	tradesPerFile.clear();
	uploadedFiles.set([]);
	allTrades.set([]);
	parseErrors.set(new Map());
}
