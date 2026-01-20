<!--
	RecoveryLinkCard Component

	Displays the recovery link after buyback records are created.
	This is crucial UX for anonymous users to access their data later.

	Features:
	- Shows the recovery URL prominently
	- Copy to clipboard button
	- Bookmark instruction
	- Warning about saving the link
	- Optional email linking prompt
-->
<script lang="ts">
	import { getContext } from 'svelte';
	import { supabase } from '$lib/supabase';

	interface Props {
		recoveryToken: string;
		onEmailLinked?: () => void;
	}

	let { recoveryToken, onEmailLinked }: Props = $props();

	// Get auth context
	const auth = getContext<{
		isAnonymous: boolean;
		user: { email?: string } | null;
	}>('auth');

	// State
	let copied = $state(false);
	let showEmailForm = $state(false);
	let email = $state('');
	let emailLoading = $state(false);
	let emailError = $state('');
	let emailSent = $state(false);

	// Derive the full recovery URL
	let recoveryUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/r/${recoveryToken}`
			: `/r/${recoveryToken}`
	);

	/**
	 * Copy recovery URL to clipboard
	 */
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(recoveryUrl);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	/**
	 * Link email to anonymous account
	 */
	async function linkEmail() {
		if (!email || !email.includes('@')) {
			emailError = 'Please enter a valid email address';
			return;
		}

		emailLoading = true;
		emailError = '';

		try {
			// Use Supabase's updateUser to link email
			const { error } = await supabase.auth.updateUser({
				email
			});

			if (error) {
				emailError = error.message;
			} else {
				emailSent = true;
				onEmailLinked?.();
			}
		} catch (e) {
			emailError = 'Failed to link email. Please try again.';
		} finally {
			emailLoading = false;
		}
	}
</script>

<div class="bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg p-6">
	<!-- Header -->
	<div class="mb-4 flex items-start gap-3">
		<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-status-gain-light">
			<svg class="h-6 w-6 text-status-gain" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		</div>
		<div>
			<h3 class="font-serif text-lg font-semibold text-ink-600">Buyback Reminders Created!</h3>
			<p class="mt-1 text-sm text-ink-400">
				Save the link below to access your buyback reminders tomorrow from any device.
			</p>
		</div>
	</div>

	<!-- Recovery Link -->
	<div class="mb-4">
		<label class="mb-2 block label-caps">Your Recovery Link</label>
		<div class="flex gap-2">
			<input
				type="text"
				readonly
				value={recoveryUrl}
				class="flex-1 rounded-paper border border-paper-300 bg-paper-50 px-3 py-2 text-sm font-mono text-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
			/>
			<button
				type="button"
				onclick={copyToClipboard}
				class="inline-flex items-center gap-2 rounded-paper bg-ink-600 px-4 py-2 text-sm font-medium text-paper-100 transition-colors hover:bg-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
			>
				{#if copied}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					Copied!
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					Copy
				{/if}
			</button>
		</div>
	</div>

	<!-- Warning Box -->
	<div class="mb-4 border-l-2 border-status-warning bg-status-warning-light rounded-paper p-3">
		<div class="flex gap-2">
			<svg
				class="h-5 w-5 flex-shrink-0 text-status-warning"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<div class="text-sm text-ink-500">
				<p class="font-medium text-ink-600">Save this link now!</p>
				<p class="mt-1 text-ink-400">
					Bookmark it or save it somewhere safe. If you lose this link and clear your browser, you
					won't be able to access your buyback reminders.
				</p>
			</div>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="mb-4 flex flex-wrap gap-2">
		<a
			href={recoveryUrl}
			class="inline-flex items-center gap-1 rounded-paper border border-paper-300 bg-paper-50 px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-200"
			target="_blank"
			rel="noopener noreferrer"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
				/>
			</svg>
			Bookmark This Link
		</a>
		<button
			type="button"
			onclick={() => {
				if (navigator.share) {
					navigator.share({
						title: 'My Tax Harvesting Buyback Link',
						url: recoveryUrl
					});
				}
			}}
			class="inline-flex items-center gap-1 rounded-paper border border-paper-300 bg-paper-50 px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-200"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
				/>
			</svg>
			Share
		</button>
	</div>

	<!-- Email Linking Section (only for anonymous users) -->
	{#if auth?.isAnonymous}
		<div class="border-t border-paper-300 pt-4">
			{#if !showEmailForm && !emailSent}
				<button
					type="button"
					onclick={() => (showEmailForm = true)}
					class="flex w-full items-center justify-between rounded-paper bg-paper-50 px-4 py-3 text-left transition-colors hover:bg-paper-200"
				>
					<div class="flex items-center gap-3">
						<svg class="h-5 w-5 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
						<div>
							<p class="text-sm font-medium text-ink-600">Want permanent access?</p>
							<p class="text-xs text-ink-400">Link your email to sign in from any device</p>
						</div>
					</div>
					<svg class="h-5 w-5 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{:else if emailSent}
				<div class="border-l-2 border-status-info bg-status-info-light rounded-paper p-3">
					<div class="flex gap-2">
						<svg class="h-5 w-5 text-status-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
						<div class="text-sm text-ink-500">
							<p class="font-medium text-ink-600">Check your email!</p>
							<p class="mt-1 text-ink-400">
								We've sent a confirmation link to <strong class="text-ink-600">{email}</strong>. Click it to link your
								email.
							</p>
						</div>
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					<p class="text-sm text-ink-400">
						Link an email to access your buyback reminders from any device without the recovery
						link.
					</p>
					<div class="flex gap-2">
						<input
							type="email"
							bind:value={email}
							placeholder="your@email.com"
							class="flex-1 rounded-paper border border-paper-300 px-3 py-2 text-sm text-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
						/>
						<button
							type="button"
							onclick={linkEmail}
							disabled={emailLoading}
							class="rounded-paper bg-ink-600 px-4 py-2 text-sm font-medium text-paper-100 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{emailLoading ? 'Sending...' : 'Link Email'}
						</button>
					</div>
					{#if emailError}
						<p class="text-sm text-status-loss">{emailError}</p>
					{/if}
					<button
						type="button"
						onclick={() => (showEmailForm = false)}
						class="text-sm text-ink-400 hover:text-ink-600"
					>
						Cancel
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
