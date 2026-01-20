/**
 * Supabase client configuration and database type definitions
 * This module provides a typed Supabase client for browser-side operations
 */

import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Database schema type definitions
 * These types mirror the PostgreSQL tables defined in Supabase
 */
export interface Database {
	public: {
		Tables: {
			buyback_records: {
				Row: {
					id: string;
					user_id: string;
					tradingsymbol: string;
					exchange: string;
					quantity: number;
					sell_date: string;
					sell_price: number | null;
					purchase_price: number | null;
					purchase_date: string | null;
					expected_loss: number | null;
					status: string;
					completed_date: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					tradingsymbol: string;
					exchange: string;
					quantity: number;
					sell_date: string;
					sell_price?: number | null;
					purchase_price?: number | null;
					purchase_date?: string | null;
					expected_loss?: number | null;
					status?: string;
					completed_date?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					tradingsymbol?: string;
					exchange?: string;
					quantity?: number;
					sell_date?: string;
					sell_price?: number | null;
					purchase_price?: number | null;
					purchase_date?: string | null;
					expected_loss?: number | null;
					status?: string;
					completed_date?: string | null;
					created_at?: string;
				};
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
	};
}

/**
 * Validates that required environment variables are present
 * Throws a descriptive error if configuration is missing
 */
function validateConfig(): void {
	if (!PUBLIC_SUPABASE_URL) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_URL environment variable. ' +
				'Please set it in your .env file or environment configuration.'
		);
	}
	if (!PUBLIC_SUPABASE_ANON_KEY) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
				'Please set it in your .env file or environment configuration.'
		);
	}
}

// Validate configuration on module load
validateConfig();

/**
 * Typed Supabase browser client instance
 * Uses the createBrowserClient from @supabase/ssr for proper SSR support
 */
export const supabase = createBrowserClient<Database>(
	PUBLIC_SUPABASE_URL,
	PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Returns the typed Supabase client instance
 * This function is provided for consistency with common patterns
 * and allows for potential future enhancements (e.g., lazy initialization)
 *
 * @returns The typed Supabase browser client
 */
export function getSupabase() {
	return supabase;
}

/**
 * Type helper for Supabase client
 * Useful for typing function parameters that accept the client
 */
export type SupabaseClient = typeof supabase;

/**
 * Type helper for buyback_records table row
 */
export type BuybackRecordRow = Database['public']['Tables']['buyback_records']['Row'];

/**
 * Type helper for buyback_records insert
 */
export type BuybackRecordInsert = Database['public']['Tables']['buyback_records']['Insert'];
