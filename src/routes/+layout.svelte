<!--
	Root Layout Component

	Purpose: Initialize Supabase auth state listener, auto anonymous sign-in, and provide session data

	Features:
	- Imports TailwindCSS styles
	- Auto signs in anonymously if no session exists
	- Initializes Supabase auth state change listener
	- Provides session data to child pages
	- Basic page wrapper with max-width container

	Requirements: 9.5
-->
<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount, setContext } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Session, User } from '@supabase/supabase-js';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	/**
	 * Reactive session state - initialized from server-side load function
	 * and updated by auth state listener
	 */
	let session: Session | null = $state(data.session);

	/**
	 * Auth loading state - true while checking/creating session
	 */
	let authLoading = $state(true);

	/**
	 * Check if the current user is anonymous
	 */
	let isAnonymous = $derived(
		session?.user?.app_metadata?.provider === 'anonymous' ||
			(!session?.user?.email && !session?.user?.phone)
	);

	/**
	 * Provide auth context to child components
	 */
	setContext('auth', {
		get session() {
			return session;
		},
		get user() {
			return session?.user ?? null;
		},
		get isAnonymous() {
			return isAnonymous;
		},
		get isLoading() {
			return authLoading;
		}
	});

	/**
	 * Set up Supabase auth state listener and auto anonymous sign-in
	 */
	onMount(() => {
		// Set up auth state listener first
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			session = newSession;
		});

		// Initialize auth state asynchronously
		initAuth();

		// Cleanup subscription on component unmount
		return () => {
			subscription.unsubscribe();
		};
	});

	/**
	 * Initialize authentication state
	 * Checks for existing session or signs in anonymously
	 */
	async function initAuth() {
		// Check if we already have a session
		const {
			data: { session: existingSession }
		} = await supabase.auth.getSession();

		if (existingSession) {
			session = existingSession;
			authLoading = false;
		} else {
			// No session - sign in anonymously
			try {
				const { data: anonData, error } = await supabase.auth.signInAnonymously();
				if (error) {
					console.error('Anonymous sign-in failed:', error.message);
				} else {
					session = anonData.session;
				}
			} catch (e) {
				console.error('Anonymous sign-in error:', e);
			}
			authLoading = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tax Loss Harvesting Tool for Indian Investors</title>
	<meta
		name="description"
		content="Identify tax loss harvesting opportunities in your Indian equity portfolio. Upload your Zerodha tradebook, see ST/LT losses, and execute via Kite."
	/>
</svelte:head>

<!-- Main page wrapper with paper background -->
<div class="min-h-screen bg-paper-200">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</div>
</div>
