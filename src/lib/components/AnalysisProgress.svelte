<!--
  AnalysisProgress Component

  Displays a visual stepper showing progress through the portfolio analysis pipeline.
  Each step shows a checkmark when completed, a spinner when in progress, and is
  greyed out when pending.

  Props:
  - step: Current AnalysisStep from the analysis state
  - stats: Object containing { trades: number, stocks: number } for display

  Requirements:
  - 4.1: Show progress during analysis with step updates
  - 4.2: Visual indication of price fetching from NSE
  - 4.3: Smooth transitions between steps
-->
<script lang="ts">
	import type { AnalysisStep } from '$lib/types';

	interface Props {
		step: AnalysisStep;
		stats: {
			trades: number;
			stocks: number;
		};
	}

	let { step, stats }: Props = $props();

	/**
	 * Step configuration for the analysis pipeline
	 * Each step has a label and an optional dynamic label based on stats
	 */
	const steps: {
		id: AnalysisStep;
		label: string;
		dynamicLabel?: (stats: Props['stats']) => string;
	}[] = [
		{ id: 'processing', label: 'Processing tradebook files...' },
		{
			id: 'trades_found',
			label: 'Counting trades...',
			dynamicLabel: (s) => `${s.trades.toLocaleString()} trades found`
		},
		{ id: 'calculating', label: 'Calculating holdings (FIFO)...' },
		{
			id: 'stocks_found',
			label: 'Identifying stocks...',
			dynamicLabel: (s) => `${s.stocks.toLocaleString()} stocks identified`
		},
		{ id: 'fetching_prices', label: 'Fetching current prices...' },
		{ id: 'checking_opportunities', label: 'Checking for tax harvesting opportunities...' }
	];

	/**
	 * Gets the index of the current step in the steps array
	 * Returns -1 for idle, steps.length for complete/error
	 */
	function getCurrentStepIndex(): number {
		if (step === 'idle') return -1;
		if (step === 'complete' || step === 'error') return steps.length;
		return steps.findIndex((s) => s.id === step);
	}

	/**
	 * Determines the status of a step based on the current step
	 */
	function getStepStatus(stepIndex: number): 'completed' | 'current' | 'pending' {
		const currentIndex = getCurrentStepIndex();
		if (stepIndex < currentIndex) return 'completed';
		if (stepIndex === currentIndex) return 'current';
		return 'pending';
	}

	/**
	 * Calculates the progress percentage (0-100) based on current step
	 */
	function getProgressPercentage(): number {
		const currentIndex = getCurrentStepIndex();
		if (currentIndex < 0) return 0;
		if (currentIndex >= steps.length) return 100;
		// Each step contributes equally to progress
		// Add 0.5 to show partial progress for current step
		return Math.round(((currentIndex + 0.5) / steps.length) * 100);
	}

	/**
	 * Gets the display label for a step, using dynamic label if available and step is completed
	 */
	function getStepLabel(stepConfig: (typeof steps)[0], stepIndex: number): string {
		const status = getStepStatus(stepIndex);
		if (status === 'completed' && stepConfig.dynamicLabel) {
			return stepConfig.dynamicLabel(stats);
		}
		if (status === 'current' && stepConfig.dynamicLabel && stepConfig.id === 'trades_found') {
			// Show dynamic label immediately for trades_found
			return stepConfig.dynamicLabel(stats);
		}
		if (status === 'current' && stepConfig.dynamicLabel && stepConfig.id === 'stocks_found') {
			// Show dynamic label immediately for stocks_found
			return stepConfig.dynamicLabel(stats);
		}
		return stepConfig.label;
	}
</script>

<div
	class="mx-auto w-full max-w-lg bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg p-6"
	role="region"
	aria-label="Portfolio analysis progress"
>
	<h2 class="mb-6 font-serif text-lg font-semibold text-ink-600">Analyzing Your Portfolio</h2>

	<!-- Steps list -->
	<div class="mb-6 space-y-3">
		{#each steps as stepConfig, index (stepConfig.id)}
			{@const status = getStepStatus(index)}
			<div
				class="flex items-center gap-3 transition-opacity duration-300"
				class:opacity-40={status === 'pending'}
			>
				<!-- Status icon -->
				<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center">
					{#if status === 'completed'}
						<!-- Checkmark icon -->
						<div class="flex h-5 w-5 items-center justify-center rounded-full bg-status-gain">
							<svg
								class="h-3 w-3 text-paper-50"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="3"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
					{:else if status === 'current'}
						<!-- Spinner icon -->
						<div
							class="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent"
							role="status"
						>
							<span class="sr-only">In progress</span>
						</div>
					{:else}
						<!-- Pending circle -->
						<div class="h-5 w-5 rounded-full border-2 border-paper-400"></div>
					{/if}
				</div>

				<!-- Step label -->
				<span
					class="text-sm transition-colors duration-300"
					class:text-ink-600={status === 'completed'}
					class:font-medium={status === 'completed' || status === 'current'}
					class:text-accent-600={status === 'current'}
					class:text-ink-300={status === 'pending'}
				>
					{getStepLabel(stepConfig, index)}
				</span>

				<!-- Status text for completed steps -->
				{#if status === 'completed'}
					<span class="ml-auto text-xs text-ink-300">Done</span>
				{:else if status === 'current'}
					<span class="ml-auto text-xs text-accent-500">In Progress</span>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Progress bar -->
	<div class="space-y-2">
		<div class="h-0.5 w-full overflow-hidden bg-paper-300">
			<div
				class="h-full bg-accent-500 transition-all duration-500 ease-out"
				style="width: {getProgressPercentage()}%"
				role="progressbar"
				aria-valuenow={getProgressPercentage()}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Analysis progress"
			></div>
		</div>
		<div class="text-center text-sm font-mono text-ink-400">
			{getProgressPercentage()}%
		</div>
	</div>
</div>
