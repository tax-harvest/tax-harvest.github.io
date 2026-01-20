/**
 * Auth callback page load function
 * Handles Supabase OAuth callback by exchanging the authorization code for a session
 * and redirecting to the dashboard
 */

import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { supabase } from '$lib/supabase';

export const load: PageLoad = async ({ url }) => {
	// Get the authorization code from URL params
	const code = url.searchParams.get('code');

	if (code) {
		// Exchange the code for a session
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error('Auth callback error:', error.message);
			// Redirect to home with error indication
			throw redirect(303, '/?auth_error=true');
		}
	}

	// Redirect to dashboard on success (or if no code present)
	throw redirect(303, '/');
};
