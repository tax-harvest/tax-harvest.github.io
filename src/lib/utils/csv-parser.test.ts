/**
 * Unit tests for CSV Parser
 * Tests parseTradebook and mergeTradebooks functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTradebook, mergeTradebooks } from './csv-parser';
import type { TradeRecord } from '$lib/types';

// Sample valid CSV header
const VALID_HEADER =
	'symbol,isin,trade_date,exchange,segment,trade_type,quantity,price,order_id,trade_id';

/**
 * Helper to create a valid CSV row
 */
function createCsvRow(data: {
	symbol?: string;
	isin?: string;
	trade_date?: string;
	exchange?: string;
	segment?: string;
	trade_type?: string;
	quantity?: string;
	price?: string;
	order_id?: string;
	trade_id?: string;
}): string {
	return [
		data.symbol ?? 'RELIANCE',
		data.isin ?? 'INE002A01018',
		data.trade_date ?? '2024-01-15',
		data.exchange ?? 'NSE',
		data.segment ?? 'EQ',
		data.trade_type ?? 'buy',
		data.quantity ?? '10',
		data.price ?? '2500.50',
		data.order_id ?? 'ORD001',
		data.trade_id ?? 'TRD001'
	].join(',');
}

/**
 * Helper to create a complete CSV string
 */
function createCsv(rows: string[]): string {
	return [VALID_HEADER, ...rows].join('\n');
}

/**
 * Helper to create a TradeRecord for comparison
 */
function createTradeRecord(data: Partial<TradeRecord> & { tradeId: string }): TradeRecord {
	return {
		tradeId: data.tradeId,
		symbol: data.symbol ?? 'RELIANCE',
		isin: data.isin ?? 'INE002A01018',
		tradeDate: data.tradeDate ?? new Date('2024-01-15T00:00:00'),
		exchange: data.exchange ?? 'NSE',
		tradeType: data.tradeType ?? 'buy',
		quantity: data.quantity ?? 10,
		price: data.price ?? 2500.5
	};
}

describe('parseTradebook', () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	describe('valid tradebook with buys and sells', () => {
		it('should parse a valid tradebook with buy trades correctly', () => {
			const csv = createCsv([
				createCsvRow({
					symbol: 'INFY',
					isin: 'INE009A01021',
					trade_date: '2024-02-20',
					exchange: 'NSE',
					segment: 'EQ',
					trade_type: 'buy',
					quantity: '50',
					price: '1450.25',
					trade_id: 'TRD100'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				tradeId: 'TRD100',
				symbol: 'INFY',
				isin: 'INE009A01021',
				tradeDate: new Date('2024-02-20T00:00:00'),
				exchange: 'NSE',
				tradeType: 'buy',
				quantity: 50,
				price: 1450.25
			});
		});

		it('should parse a valid tradebook with sell trades correctly', () => {
			const csv = createCsv([
				createCsvRow({
					symbol: 'TCS',
					isin: 'INE467B01029',
					trade_date: '2024-03-10',
					exchange: 'BSE',
					segment: 'EQ',
					trade_type: 'sell',
					quantity: '25',
					price: '3800.75',
					trade_id: 'TRD200'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				tradeId: 'TRD200',
				symbol: 'TCS',
				isin: 'INE467B01029',
				tradeDate: new Date('2024-03-10T00:00:00'),
				exchange: 'BSE',
				tradeType: 'sell',
				quantity: 25,
				price: 3800.75
			});
		});

		it('should parse a tradebook with both buy and sell trades correctly', () => {
			const csv = createCsv([
				createCsvRow({
					symbol: 'RELIANCE',
					trade_date: '2024-01-05',
					trade_type: 'buy',
					quantity: '100',
					price: '2400.00',
					trade_id: 'TRD001'
				}),
				createCsvRow({
					symbol: 'RELIANCE',
					trade_date: '2024-02-10',
					trade_type: 'sell',
					quantity: '50',
					price: '2550.00',
					trade_id: 'TRD002'
				}),
				createCsvRow({
					symbol: 'INFY',
					trade_date: '2024-01-15',
					trade_type: 'buy',
					quantity: '75',
					price: '1500.00',
					trade_id: 'TRD003'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(3);
			expect(result[0].tradeId).toBe('TRD001');
			expect(result[0].tradeType).toBe('buy');
			expect(result[1].tradeId).toBe('TRD003');
			expect(result[1].tradeType).toBe('buy');
			expect(result[2].tradeId).toBe('TRD002');
			expect(result[2].tradeType).toBe('sell');
		});

		it('should parse different date formats correctly', () => {
			// Test DD-MM-YYYY format
			const csvDash = createCsv([
				createCsvRow({
					trade_date: '15-03-2024',
					trade_id: 'TRD_DASH'
				})
			]);

			const resultDash = parseTradebook(csvDash);
			expect(resultDash).toHaveLength(1);
			expect(resultDash[0].tradeDate).toEqual(new Date('2024-03-15T00:00:00'));

			// Test DD/MM/YYYY format
			const csvSlash = createCsv([
				createCsvRow({
					trade_date: '20/04/2024',
					trade_id: 'TRD_SLASH'
				})
			]);

			const resultSlash = parseTradebook(csvSlash);
			expect(resultSlash).toHaveLength(1);
			expect(resultSlash[0].tradeDate).toEqual(new Date('2024-04-20T00:00:00'));

			// Test YYYY-MM-DD format (ISO)
			const csvIso = createCsv([
				createCsvRow({
					trade_date: '2024-05-25',
					trade_id: 'TRD_ISO'
				})
			]);

			const resultIso = parseTradebook(csvIso);
			expect(resultIso).toHaveLength(1);
			expect(resultIso[0].tradeDate).toEqual(new Date('2024-05-25T00:00:00'));
		});

		it('should handle trades from both NSE and BSE exchanges', () => {
			const csv = createCsv([
				createCsvRow({
					symbol: 'HDFC',
					exchange: 'NSE',
					trade_id: 'TRD_NSE'
				}),
				createCsvRow({
					symbol: 'HDFC',
					exchange: 'BSE',
					trade_id: 'TRD_BSE'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(2);
			expect(result.find((t) => t.tradeId === 'TRD_NSE')?.exchange).toBe('NSE');
			expect(result.find((t) => t.tradeId === 'TRD_BSE')?.exchange).toBe('BSE');
		});

		it('should handle decimal quantities and prices correctly', () => {
			const csv = createCsv([
				createCsvRow({
					quantity: '10.5',
					price: '1234.5678',
					trade_id: 'TRD_DEC'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].quantity).toBe(10.5);
			expect(result[0].price).toBe(1234.5678);
		});

		it('should normalize exchange and trade_type to correct case', () => {
			const csv = createCsv([
				createCsvRow({
					exchange: 'nse',
					trade_type: 'BUY',
					trade_id: 'TRD_CASE'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].exchange).toBe('NSE');
			expect(result[0].tradeType).toBe('buy');
		});

		it('should handle case-insensitive column headers', () => {
			const header = 'SYMBOL,ISIN,TRADE_DATE,EXCHANGE,SEGMENT,TRADE_TYPE,QUANTITY,PRICE,ORDER_ID,TRADE_ID';
			const row = 'WIPRO,INE075A01022,2024-01-20,NSE,EQ,buy,30,450.00,ORD100,TRD_CAPS';
			const csv = `${header}\n${row}`;

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].symbol).toBe('WIPRO');
		});
	});

	describe('invalid CSV format returns empty array', () => {
		it('should return empty array for empty string', () => {
			const result = parseTradebook('');
			expect(result).toEqual([]);
		});

		it('should return empty array for null input', () => {
			const result = parseTradebook(null as unknown as string);
			expect(result).toEqual([]);
		});

		it('should return empty array for undefined input', () => {
			const result = parseTradebook(undefined as unknown as string);
			expect(result).toEqual([]);
		});

		it('should return empty array for whitespace-only input', () => {
			const result = parseTradebook('   \n\t  ');
			expect(result).toEqual([]);
		});

		it('should return empty array for CSV with missing required columns', () => {
			const csvMissingColumns = 'symbol,isin,trade_date\nRELIANCE,INE002A01018,2024-01-15';

			const result = parseTradebook(csvMissingColumns);

			expect(result).toEqual([]);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Invalid CSV format: missing required columns'
			);
		});

		it('should return empty array for completely invalid CSV', () => {
			const invalidCsv = 'this is not a csv file at all';

			const result = parseTradebook(invalidCsv);

			expect(result).toEqual([]);
		});

		it('should return empty array for CSV with only header', () => {
			const result = parseTradebook(VALID_HEADER);

			expect(result).toEqual([]);
		});

		it('should skip rows with invalid trade_date and log warning', () => {
			const csv = createCsv([
				createCsvRow({
					trade_date: 'invalid-date',
					trade_id: 'TRD_INVALID_DATE'
				}),
				createCsvRow({
					trade_date: '2024-01-15',
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Skipping row with invalid trade_date')
			);
		});

		it('should skip rows with invalid trade_type', () => {
			const csv = createCsv([
				createCsvRow({
					trade_type: 'hold',
					trade_id: 'TRD_INVALID_TYPE'
				}),
				createCsvRow({
					trade_type: 'buy',
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
		});

		it('should skip rows with invalid quantity', () => {
			const csv = createCsv([
				createCsvRow({
					quantity: '-10',
					trade_id: 'TRD_NEG_QTY'
				}),
				createCsvRow({
					quantity: '0',
					trade_id: 'TRD_ZERO_QTY'
				}),
				createCsvRow({
					quantity: 'abc',
					trade_id: 'TRD_STR_QTY'
				}),
				createCsvRow({
					quantity: '100',
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
		});

		it('should skip rows with invalid price', () => {
			const csv = createCsv([
				createCsvRow({
					price: '-500',
					trade_id: 'TRD_NEG_PRICE'
				}),
				createCsvRow({
					price: 'expensive',
					trade_id: 'TRD_STR_PRICE'
				}),
				createCsvRow({
					price: '1500.50',
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
		});

		it('should skip rows with missing trade_id', () => {
			const csv = createCsv([
				createCsvRow({
					trade_id: ''
				}),
				createCsvRow({
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
		});

		it('should skip rows with missing symbol', () => {
			const csv = createCsv([
				createCsvRow({
					symbol: '',
					trade_id: 'TRD_NO_SYMBOL'
				}),
				createCsvRow({
					symbol: 'INFY',
					trade_id: 'TRD_VALID'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_VALID');
		});
	});

	describe('non-EQ segment trades are filtered out', () => {
		it('should filter out F&O (FO) segment trades', () => {
			const csv = createCsv([
				createCsvRow({
					segment: 'FO',
					symbol: 'NIFTY',
					trade_id: 'TRD_FO'
				}),
				createCsvRow({
					segment: 'EQ',
					symbol: 'RELIANCE',
					trade_id: 'TRD_EQ'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_EQ');
			expect(result[0].symbol).toBe('RELIANCE');
		});

		it('should filter out Currency Derivatives (CD) segment trades', () => {
			const csv = createCsv([
				createCsvRow({
					segment: 'CD',
					symbol: 'USDINR',
					trade_id: 'TRD_CD'
				}),
				createCsvRow({
					segment: 'EQ',
					symbol: 'TCS',
					trade_id: 'TRD_EQ'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_EQ');
		});

		it('should filter out commodities (COM) segment trades', () => {
			const csv = createCsv([
				createCsvRow({
					segment: 'COM',
					symbol: 'GOLD',
					trade_id: 'TRD_COM'
				}),
				createCsvRow({
					segment: 'EQ',
					symbol: 'WIPRO',
					trade_id: 'TRD_EQ'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD_EQ');
		});

		it('should handle segment with different case', () => {
			const csv = createCsv([
				createCsvRow({
					segment: 'eq',
					trade_id: 'TRD_LOWER'
				}),
				createCsvRow({
					segment: 'Eq',
					trade_id: 'TRD_MIXED'
				}),
				createCsvRow({
					segment: 'EQ',
					trade_id: 'TRD_UPPER'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(3);
		});

		it('should return empty array if all trades are non-EQ', () => {
			const csv = createCsv([
				createCsvRow({
					segment: 'FO',
					trade_id: 'TRD_FO1'
				}),
				createCsvRow({
					segment: 'CD',
					trade_id: 'TRD_CD1'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toEqual([]);
		});
	});

	describe('results are sorted chronologically', () => {
		it('should sort trades by tradeDate ascending', () => {
			const csv = createCsv([
				createCsvRow({
					trade_date: '2024-03-15',
					trade_id: 'TRD_MAR'
				}),
				createCsvRow({
					trade_date: '2024-01-10',
					trade_id: 'TRD_JAN'
				}),
				createCsvRow({
					trade_date: '2024-02-20',
					trade_id: 'TRD_FEB'
				})
			]);

			const result = parseTradebook(csv);

			expect(result).toHaveLength(3);
			expect(result[0].tradeId).toBe('TRD_JAN');
			expect(result[1].tradeId).toBe('TRD_FEB');
			expect(result[2].tradeId).toBe('TRD_MAR');
		});
	});
});

describe('mergeTradebooks', () => {
	describe('deduplication removes trades with same tradeId', () => {
		it('should deduplicate trades with same tradeId', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001',
					symbol: 'RELIANCE',
					tradeDate: new Date('2024-01-15T00:00:00')
				}),
				createTradeRecord({
					tradeId: 'TRD002',
					symbol: 'TCS',
					tradeDate: new Date('2024-02-20T00:00:00')
				})
			];

			const list2: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001', // Duplicate
					symbol: 'RELIANCE',
					tradeDate: new Date('2024-01-15T00:00:00')
				}),
				createTradeRecord({
					tradeId: 'TRD003',
					symbol: 'INFY',
					tradeDate: new Date('2024-03-10T00:00:00')
				})
			];

			const result = mergeTradebooks([list1, list2]);

			expect(result).toHaveLength(3);
			expect(result.map((t) => t.tradeId)).toEqual(['TRD001', 'TRD002', 'TRD003']);
		});

		it('should keep the first occurrence when deduplicating', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001',
					symbol: 'RELIANCE',
					price: 2500.0
				})
			];

			const list2: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001',
					symbol: 'RELIANCE',
					price: 2600.0 // Different price for same tradeId
				})
			];

			const result = mergeTradebooks([list1, list2]);

			expect(result).toHaveLength(1);
			expect(result[0].price).toBe(2500.0); // First occurrence kept
		});

		it('should handle multiple duplicates across multiple lists', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({ tradeId: 'TRD001', tradeDate: new Date('2024-01-01T00:00:00') }),
				createTradeRecord({ tradeId: 'TRD002', tradeDate: new Date('2024-01-02T00:00:00') })
			];

			const list2: TradeRecord[] = [
				createTradeRecord({ tradeId: 'TRD002', tradeDate: new Date('2024-01-02T00:00:00') }), // Dup
				createTradeRecord({ tradeId: 'TRD003', tradeDate: new Date('2024-01-03T00:00:00') })
			];

			const list3: TradeRecord[] = [
				createTradeRecord({ tradeId: 'TRD001', tradeDate: new Date('2024-01-01T00:00:00') }), // Dup
				createTradeRecord({ tradeId: 'TRD003', tradeDate: new Date('2024-01-03T00:00:00') }), // Dup
				createTradeRecord({ tradeId: 'TRD004', tradeDate: new Date('2024-01-04T00:00:00') })
			];

			const result = mergeTradebooks([list1, list2, list3]);

			expect(result).toHaveLength(4);
			expect(result.map((t) => t.tradeId)).toEqual(['TRD001', 'TRD002', 'TRD003', 'TRD004']);
		});

		it('should handle lists with no duplicates', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({ tradeId: 'TRD001', tradeDate: new Date('2024-01-01T00:00:00') })
			];

			const list2: TradeRecord[] = [
				createTradeRecord({ tradeId: 'TRD002', tradeDate: new Date('2024-01-02T00:00:00') })
			];

			const result = mergeTradebooks([list1, list2]);

			expect(result).toHaveLength(2);
		});

		it('should handle all trades being duplicates', () => {
			const trade = createTradeRecord({
				tradeId: 'TRD001',
				tradeDate: new Date('2024-01-01T00:00:00')
			});

			const list1: TradeRecord[] = [trade];
			const list2: TradeRecord[] = [{ ...trade }];
			const list3: TradeRecord[] = [{ ...trade }];

			const result = mergeTradebooks([list1, list2, list3]);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD001');
		});
	});

	describe('merged trades are sorted chronologically', () => {
		it('should sort merged trades by tradeDate ascending', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_MAR',
					tradeDate: new Date('2024-03-15T00:00:00')
				}),
				createTradeRecord({
					tradeId: 'TRD_JAN',
					tradeDate: new Date('2024-01-10T00:00:00')
				})
			];

			const list2: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_FEB',
					tradeDate: new Date('2024-02-20T00:00:00')
				}),
				createTradeRecord({
					tradeId: 'TRD_APR',
					tradeDate: new Date('2024-04-05T00:00:00')
				})
			];

			const result = mergeTradebooks([list1, list2]);

			expect(result).toHaveLength(4);
			expect(result[0].tradeId).toBe('TRD_JAN');
			expect(result[1].tradeId).toBe('TRD_FEB');
			expect(result[2].tradeId).toBe('TRD_MAR');
			expect(result[3].tradeId).toBe('TRD_APR');
		});

		it('should handle trades on the same date', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_A',
					tradeDate: new Date('2024-01-15T00:00:00')
				}),
				createTradeRecord({
					tradeId: 'TRD_B',
					tradeDate: new Date('2024-01-15T00:00:00')
				})
			];

			const result = mergeTradebooks([list1]);

			expect(result).toHaveLength(2);
			// Both trades should be present, order among same-date trades is not strictly defined
			expect(result.map((t) => t.tradeId).sort()).toEqual(['TRD_A', 'TRD_B']);
		});

		it('should maintain chronological order across multiple years', () => {
			const list1: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_2024',
					tradeDate: new Date('2024-06-15T00:00:00')
				})
			];

			const list2: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_2023',
					tradeDate: new Date('2023-06-15T00:00:00')
				})
			];

			const list3: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD_2022',
					tradeDate: new Date('2022-06-15T00:00:00')
				})
			];

			const result = mergeTradebooks([list1, list2, list3]);

			expect(result).toHaveLength(3);
			expect(result[0].tradeId).toBe('TRD_2022');
			expect(result[1].tradeId).toBe('TRD_2023');
			expect(result[2].tradeId).toBe('TRD_2024');
		});
	});

	describe('edge cases', () => {
		it('should handle empty array input', () => {
			const result = mergeTradebooks([]);

			expect(result).toEqual([]);
		});

		it('should handle array with empty lists', () => {
			const result = mergeTradebooks([[], [], []]);

			expect(result).toEqual([]);
		});

		it('should handle single list', () => {
			const list: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001',
					tradeDate: new Date('2024-01-15T00:00:00')
				})
			];

			const result = mergeTradebooks([list]);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD001');
		});

		it('should handle mix of empty and non-empty lists', () => {
			const list1: TradeRecord[] = [];
			const list2: TradeRecord[] = [
				createTradeRecord({
					tradeId: 'TRD001',
					tradeDate: new Date('2024-01-15T00:00:00')
				})
			];
			const list3: TradeRecord[] = [];

			const result = mergeTradebooks([list1, list2, list3]);

			expect(result).toHaveLength(1);
			expect(result[0].tradeId).toBe('TRD001');
		});

		it('should preserve all TradeRecord properties during merge', () => {
			const trade: TradeRecord = {
				tradeId: 'TRD_FULL',
				symbol: 'HDFC',
				isin: 'INE001A01036',
				tradeDate: new Date('2024-05-10T00:00:00'),
				exchange: 'BSE',
				tradeType: 'sell',
				quantity: 150,
				price: 1650.75
			};

			const result = mergeTradebooks([[trade]]);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(trade);
		});
	});
});
