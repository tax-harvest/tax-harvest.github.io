<!--
	Recovery Page

	Allows users to access their buyback records using a recovery token.
	Works without authentication - perfect for anonymous users.

	Features:
	- Fetches buyback records via get-buybacks Edge Function
	- Shows pending and completed buybacks
	- Allows placing buyback orders via Kite
	- Allows marking buybacks as complete
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { env } from '$env/dynamic/public';
	import { format } from 'date-fns';
	import { executeBuybackOrders } from '$lib/utils/kite-publisher';
	import type { BuybackRecord } from '$lib/types';

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let buybacks = $state<BuybackRecord[]>([]);
	let label = $state<string | null>(null);
	let createdAt = $state<string | null>(null);

	// Derived
	let pendingBuybacks = $derived(buybacks.filter((b) => b.status === 'PENDING'));
	let completedBuybacks = $derived(buybacks.filter((b) => b.status === 'COMPLETED'));

	/**
	 * Fetch buybacks using the recovery token
	 */
	async function fetchBuybacks() {
		const token = $page.params.token;

		if (!token) {
			error = 'Invalid recovery link';
			loading = false;
			return;
		}

		try {
			const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/get-buybacks?token=${token}`);
			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to load buyback records';
				return;
			}

			// Map the response to BuybackRecord format
			buybacks = (data.buybacks || []).map((b: any) => ({
				id: b.id,
				symbol: b.tradingsymbol,
				exchange: b.exchange,
				quantity: b.quantity,
				sellDate: new Date(b.sell_date),
				sellPrice: b.sell_price,
				purchasePrice: b.purchase_price,
				purchaseDate: b.purchase_date ? new Date(b.purchase_date) : undefined,
				expectedLoss: b.expected_loss,
				status: b.status,
				completedDate: b.completed_date ? new Date(b.completed_date) : undefined
			}));
			label = data.label;
			createdAt = data.createdAt;
		} catch (e) {
			error = 'Failed to connect to server';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	/**
	 * Execute buyback orders via Kite
	 */
	function handleBuyback() {
		const kiteApiKey = env.PUBLIC_KITE_API_KEY ?? '';
		if (!kiteApiKey) {
			alert('Kite API key not configured. Please contact support.');
			return;
		}
		executeBuybackOrders(pendingBuybacks, kiteApiKey);
	}

	/**
	 * Format currency in INR
	 */
	function formatCurrency(amount: number | undefined): string {
		if (amount === undefined) return '-';
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2
		}).format(amount);
	}

	onMount(() => {
		fetchBuybacks();
	});
</script>

<svelte:head>
	<title>Buyback Reminders | Tax Loss Harvesting Tool</title>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Home
		</a>
		<h1 class="mt-4 text-2xl font-bold text-gray-900">Your Buyback Reminders</h1>
		{#if label}
			<p class="mt-1 text-sm text-gray-500">{label}</p>
		{/if}
	</div>

	{#if loading}
		<!-- Loading State -->
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<svg
					class="mx-auto h-8 w-8 animate-spin text-blue-600"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				<p class="mt-2 text-sm text-gray-500">Loading your buyback records...</p>
			</div>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
			<svg
				class="mx-auto h-12 w-12 text-red-400"
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
			<h3 class="mt-4 text-lg font-medium text-red-800">Unable to Load Records</h3>
			<p class="mt-2 text-sm text-red-600">{error}</p>
			<a
				href="/"
				class="mt-4 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
			>
				Go to Home
			</a>
		</div>
	{:else if buybacks.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border border-gray-200 bg-white p-8 text-center">
			<svg
				class="mx-auto h-12 w-12 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			<h3 class="mt-4 text-lg font-medium text-gray-900">No Buyback Records</h3>
			<p class="mt-2 text-sm text-gray-500">
				There are no buyback records associated with this link.
			</p>
		</div>
	{:else}
		<!-- Pending Buybacks -->
		{#if pendingBuybacks.length > 0}
			<div class="mb-6 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
				<div class="flex items-start gap-3">
					<svg
						class="h-6 w-6 flex-shrink-0 text-amber-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div class="flex-1">
						<h3 class="font-semibold text-amber-800">
							{pendingBuybacks.length} Buyback{pendingBuybacks.length > 1 ? 's' : ''} Pending
						</h3>
						<p class="mt-1 text-sm text-amber-700">
							Buy back these stocks on the next trading day to maintain your portfolio allocation.
							Same-day buyback is treated as intraday trading.
						</p>
					</div>
				</div>

				<!-- Pending Table -->
				<div class="mt-4 overflow-hidden rounded-lg border border-amber-200 bg-white">
					<table class="min-w-full divide-y divide-amber-200">
						<thead class="bg-amber-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium uppercase text-amber-700">Stock</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-amber-700">Qty</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-amber-700">Sold At</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-amber-700">Loss</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-amber-700">Sell Date</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each pendingBuybacks as buyback}
								<tr>
									<td class="whitespace-nowrap px-4 py-3">
										<div class="font-medium text-gray-900">{buyback.symbol}</div>
										<div class="text-xs text-gray-500">{buyback.exchange}</div>
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right text-gray-900">{buyback.quantity}</td>
									<td class="whitespace-nowrap px-4 py-3 text-right text-gray-900">
										{formatCurrency(buyback.sellPrice)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right font-medium text-red-600">
										{formatCurrency(buyback.expectedLoss)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right text-gray-500">
										{format(buyback.sellDate, 'dd MMM yyyy')}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Buy Back Button -->
				<div class="mt-4 flex justify-end">
					<button
						type="button"
						onclick={handleBuyback}
						class="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
						Buy Back via Kite
					</button>
				</div>
			</div>
		{/if}

		<!-- Completed Buybacks -->
		{#if completedBuybacks.length > 0}
			<div class="rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 px-4 py-3">
					<h3 class="font-medium text-gray-900">Completed Buybacks</h3>
				</div>
				<div class="overflow-hidden">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stock</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Qty</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Loss Harvested</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Completed</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each completedBuybacks as buyback}
								<tr class="bg-green-50/30">
									<td class="whitespace-nowrap px-4 py-3">
										<div class="flex items-center gap-2">
											<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											<div>
												<div class="font-medium text-gray-900">{buyback.symbol}</div>
												<div class="text-xs text-gray-500">{buyback.exchange}</div>
											</div>
										</div>
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right text-gray-900">{buyback.quantity}</td>
									<td class="whitespace-nowrap px-4 py-3 text-right font-medium text-green-600">
										{formatCurrency(buyback.expectedLoss)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right text-gray-500">
										{buyback.completedDate ? format(buyback.completedDate, 'dd MMM yyyy') : '-'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Summary -->
		{#if buybacks.length > 0}
			<div class="mt-6 rounded-lg bg-gray-100 p-4 text-center text-sm text-gray-600">
				<p>
					Total loss harvested:
					<span class="font-semibold text-gray-900">
						{formatCurrency(buybacks.reduce((sum, b) => sum + (b.expectedLoss || 0), 0))}
					</span>
				</p>
			</div>
		{/if}
	{/if}
</div>
