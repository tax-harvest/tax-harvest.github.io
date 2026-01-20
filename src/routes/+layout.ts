/**
 * Layout Load Function
 *
 * Purpose: Initialize Supabase client and load session data server-side
 *
 * This runs on both server and client during navigation.
 * It retrieves the current auth session from Supabase and makes it
 * available to all pages via the layout data.
 *
 * Requirements: 9.5
 */

import { supabase } from '$lib/supabase';
import type { LayoutLoad } from './$types';

// Static adapter settings for GitHub Pages
export const prerender = true;
export const ssr = false;

export const load: LayoutLoad = async () => {
	/**
	 * Get the current session from Supabase
	 * getSession() returns the session from localStorage/cookies
	 * without making a network request (unless token refresh is needed)
	 */
	const {
		data: { session },
		error
	} = await supabase.auth.getSession();

	if (error) {
		console.error('Error loading session:', error.message);
	}

	return {
		session
	};
};
