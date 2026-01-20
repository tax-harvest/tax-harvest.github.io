/**
 * Buybacks Store
 * Manages buyback reminders for tax loss harvesting.
 * After selling stocks for tax loss harvesting, users need reminders
 * to repurchase shares to maintain portfolio allocation.
 *
 * Requirements:
 * - 9.1: Create buyback reminder with symbol, quantity, sell date, purchase info
 * - 9.2: Display pending buyback reminders prominently
 * - 9.4: Mark buyback as complete and remove from reminders
 * - 9.5: Persist buyback records in database (not localStorage)
 */

import { writable, derived } from 'svelte/store';
import type { BuybackRecord, SellOrder } from '$lib/types';
import { supabase, type BuybackRecordRow } from '$lib/supabase';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Primary store for all buyback records
 * Buyback records are created when sell orders execute successfully
 */
export const buybacks = writable<BuybackRecord[]>([]);

/**
 * Derived store for pending buyback reminders only
 * Filters buybacks to show only those with status 'PENDING'
 * Used to display active reminders to users (req 9.2)
 */
export const pendingBuybacks = derived(buybacks, ($buybacks) =>
	$buybacks.filter((buyback) => buyback.status === 'PENDING')
);

/**
 * Maps a database row to a BuybackRecord
 */
function mapRowToRecord(row: BuybackRecordRow): BuybackRecord {
	return {
		id: row.id,
		symbol: row.tradingsymbol,
		exchange: row.exchange,
		quantity: row.quantity,
		sellDate: new Date(row.sell_date),
		sellPrice: row.sell_price ?? undefined,
		purchasePrice: row.purchase_price ?? undefined,
		purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
		expectedLoss: row.expected_loss ?? undefined,
		status: row.status as 'PENDING' | 'COMPLETED',
		completedDate: row.completed_date ? new Date(row.completed_date) : undefined
	};
}

/**
 * Loads buyback records from Supabase for the current user
 * Maps database fields to BuybackRecord interface
 *
 * Requirement: 9.5 - Persist buyback records in database
 */
export async function loadBuybacks(): Promise<void> {
	const { data, error } = await supabase
		.from('buyback_records')
		.select('*')
		.order('sell_date', { ascending: false });

	if (error) {
		console.error('Error loading buyback records:', error);
		throw error;
	}

	// Type assertion needed due to Supabase generic inference limitations
	const rows = data as BuybackRecordRow[] | null;
	const records: BuybackRecord[] = (rows ?? []).map(mapRowToRecord);
	buybacks.set(records);
}

/**
 * Creates buyback records in Supabase after sell orders are executed
 * Called when user confirms they completed orders on Kite
 *
 * Requirement: 8.5 - Create buyback records with symbol, quantity, sell date, purchase price, purchase date
 * Requirement: 9.1 - Create buyback reminder with symbol, quantity, sell date, purchase info
 *
 * @param orders - Array of sell orders that were executed
 */
export async function createBuybackRecords(orders: SellOrder[]): Promise<void> {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error('User must be authenticated to create buyback records');
	}

	const sellDate = new Date().toISOString().split('T')[0];

	const records = orders.map((order) => ({
		user_id: user.id,
		tradingsymbol: order.symbol,
		exchange: order.exchange,
		quantity: order.quantity,
		sell_date: sellDate,
		sell_price: order.currentPrice,
		purchase_price: order.purchasePrice,
		purchase_date: order.purchaseDate.toISOString().split('T')[0],
		expected_loss: order.expectedLoss,
		status: 'PENDING'
	}));

	// Use type assertion to work around Supabase generic inference issue
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase.from('buyback_records') as any).insert(records);

	if (error) {
		console.error('Error creating buyback records:', error);
		throw error;
	}

	// Note: We don't update the local store here because loadBuybacks()
	// should be called after this function to get the full list from DB.
	// This prevents race conditions and duplicate entries.
}

/**
 * Marks a buyback record as complete in Supabase and updates local store
 * Sets status to 'COMPLETED' and completed_date to current date
 *
 * Requirement: 9.4 - Update buyback status and remove from reminders
 *
 * @param id - The unique identifier of the buyback record to mark complete
 */
export async function markComplete(id: string): Promise<void> {
	const completedDate = new Date();

	// Use type assertion to work around Supabase generic inference issue
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase.from('buyback_records') as any)
		.update({
			status: 'COMPLETED',
			completed_date: completedDate.toISOString().split('T')[0]
		})
		.eq('id', id);

	if (error) {
		console.error('Error marking buyback as complete:', error);
		throw error;
	}

	// Update local store
	buybacks.update((records) =>
		records.map((record) =>
			record.id === id
				? {
						...record,
						status: 'COMPLETED' as const,
						completedDate
					}
				: record
		)
	);
}

/**
 * Clears all buyback records from the store
 * Used when resetting application state or during logout
 */
export function clearBuybacks(): void {
	buybacks.set([]);
}

/**
 * Store for the recovery token (used once after creating buyback records)
 * This token allows anonymous users to access their data from any device
 */
export const recoveryToken = writable<string | null>(null);

/**
 * Generates a recovery token for the current user
 * This allows accessing buyback records from any device without signing in
 *
 * @param label - Optional label for the token (e.g., "Buyback Jan 2026")
 * @returns The recovery token
 */
export async function generateRecoveryToken(label?: string): Promise<string> {
	const session = await supabase.auth.getSession();
	const accessToken = session.data.session?.access_token;

	if (!accessToken) {
		throw new Error('Must be signed in to generate recovery token');
	}

	const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/create-access-token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify({ label })
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new Error(data.error || 'Failed to generate recovery token');
	}

	const data = await response.json();

	if (!data.token) {
		throw new Error('No token received from server');
	}

	// Store the token for display
	recoveryToken.set(data.token);

	return data.token;
}

/**
 * Creates buyback records and generates a recovery token
 * This is a combined operation for the typical user flow
 *
 * @param orders - Array of sell orders that were executed
 * @returns The recovery token for accessing these records later
 */
export async function createBuybackRecordsWithRecovery(orders: SellOrder[]): Promise<string> {
	// First create the buyback records
	await createBuybackRecords(orders);

	// Then generate a recovery token
	const date = new Date();
	const month = date.toLocaleString('en-US', { month: 'short' });
	const year = date.getFullYear();
	const label = `Tax Harvesting ${month} ${year}`;

	const token = await generateRecoveryToken(label);

	return token;
}
