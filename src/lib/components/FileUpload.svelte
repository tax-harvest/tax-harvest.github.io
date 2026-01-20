<!--
  FileUpload Component

  Purpose: Drag-and-drop or click to upload Tradebook CSVs (max 2 files)

  Features:
  - Multi-file select and drag-drop (max 2 files)
  - Shows list of uploaded files with FY range and trade count
  - Remove individual files
  - "Analyze Portfolio" button when files uploaded
  - Direct link to Zerodha Console
  - Clear guidance on which files to upload
-->
<script lang="ts">
	import type { UploadedFile } from '$lib/types';

	interface Props {
		/** List of already uploaded files to display */
		files?: UploadedFile[];
		/** Whether analysis is in progress (disables buttons) */
		disabled?: boolean;
		/** Callback when files are uploaded */
		onupload?: (files: FileList) => void;
		/** Callback when a file is removed */
		onremove?: (fileId: string) => void;
		/** Callback when analyze button is clicked */
		onanalyze?: () => void;
	}

	const MAX_FILES = 2;

	let { files = [], disabled = false, onupload, onremove, onanalyze }: Props = $props();

	// Local state for drag-and-drop
	let isDragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let errorMessage = $state<string | null>(null);

	// Derived: can add more files?
	let canAddFiles = $derived(files.length < MAX_FILES);
	let remainingSlots = $derived(MAX_FILES - files.length);

	/**
	 * Handles file input change event
	 */
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			validateAndDispatch(input.files);
			// Reset input so same file can be re-selected
			input.value = '';
		}
	}

	/**
	 * Validates file count and dispatches upload
	 */
	function validateAndDispatch(fileList: FileList) {
		errorMessage = null;

		if (files.length >= MAX_FILES) {
			errorMessage = `Maximum ${MAX_FILES} files allowed. Remove a file first.`;
			return;
		}

		const availableSlots = MAX_FILES - files.length;
		if (fileList.length > availableSlots) {
			errorMessage = `Can only add ${availableSlots} more file${availableSlots > 1 ? 's' : ''}. You selected ${fileList.length}.`;
			// Still process the first N files
			const dataTransfer = new DataTransfer();
			for (let i = 0; i < Math.min(fileList.length, availableSlots); i++) {
				dataTransfer.items.add(fileList[i]);
			}
			onupload?.(dataTransfer.files);
			return;
		}

		onupload?.(fileList);
	}

	/**
	 * Handles click on the drop zone to trigger file browser
	 */
	function handleClick() {
		if (!disabled && canAddFiles) {
			fileInput?.click();
		}
	}

	/**
	 * Handles dragover event on drop zone
	 */
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled && canAddFiles) {
			isDragging = true;
		}
	}

	/**
	 * Handles dragleave event on drop zone
	 */
	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	/**
	 * Handles drop event on drop zone
	 */
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (disabled || !canAddFiles) return;

		const droppedFiles = event.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			const csvFiles = filterCsvFiles(droppedFiles);
			if (csvFiles.length > 0) {
				validateAndDispatch(csvFiles);
			}
		}
	}

	/**
	 * Filters a FileList to only include CSV files
	 */
	function filterCsvFiles(fileList: FileList): FileList {
		const dataTransfer = new DataTransfer();
		for (let i = 0; i < fileList.length; i++) {
			const file = fileList[i];
			if (file.name.toLowerCase().endsWith('.csv')) {
				dataTransfer.items.add(file);
			}
		}
		return dataTransfer.files;
	}

	/**
	 * Handles remove button click for a file
	 */
	function handleRemove(fileId: string) {
		errorMessage = null;
		onremove?.(fileId);
	}

	/**
	 * Handles analyze button click
	 */
	function handleAnalyze() {
		if (!disabled && files.length > 0) {
			onanalyze?.();
		}
	}

	/**
	 * Formats a date for display
	 */
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/**
	 * Gets the total trade count across all files
	 */
	const totalTradeCount = $derived(files.reduce((sum, f) => sum + f.tradeCount, 0));
</script>

<div class="w-full">
	<!-- Info Card -->
	<div class="mb-4 border-l-2 border-accent-500 bg-paper-100 p-4 shadow-paper-sm rounded-paper">
		<div class="flex gap-3">
			<div class="flex-shrink-0">
				<svg class="h-5 w-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="text-sm text-ink-500">
				<p class="font-medium text-ink-600">Upload up to 2 Tradebook files:</p>
				<ul class="mt-1 list-disc list-inside text-ink-400 space-y-0.5">
					<li><span class="font-medium text-ink-500">Current FY</span> – to see realized gains & current holdings</li>
					<li><span class="font-medium text-ink-500">Last FY</span> – to capture long-term holdings</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Drop Zone -->
	<div
		role="button"
		tabindex="0"
		class="relative border border-dashed rounded-paper-lg p-6 sm:p-8 text-center transition-all shadow-paper-inset
			{isDragging
			? 'border-accent-500 bg-paper-50 scale-[1.01]'
			: canAddFiles
				? 'border-paper-300 bg-paper-50 hover:border-accent-400 hover:bg-paper-100'
				: 'border-paper-300 bg-paper-200'}
			{disabled || !canAddFiles ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleClick}
		onkeydown={(e) => e.key === 'Enter' && handleClick()}
	>
		<!-- Upload Icon -->
		<div class="mx-auto h-12 w-12 rounded-full bg-paper-200 flex items-center justify-center">
			<svg
				class="h-6 w-6 text-ink-300"
				stroke="currentColor"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
		</div>

		<div class="mt-4">
			{#if canAddFiles}
				<p class="text-sm font-medium text-ink-600">
					{isDragging ? 'Drop files here' : 'Drop Tradebook CSV files here'}
				</p>
				<p class="mt-1 text-sm text-ink-400">or click to browse</p>
				{#if files.length > 0}
					<p class="mt-2 text-xs text-ink-300">{remainingSlots} more file{remainingSlots > 1 ? 's' : ''} allowed</p>
				{/if}
			{:else}
				<p class="text-sm font-medium text-ink-500">Maximum files uploaded</p>
				<p class="mt-1 text-sm text-ink-400">Remove a file to add another</p>
			{/if}
		</div>

		<!-- Hidden file input -->
		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept=".csv"
			class="sr-only"
			onchange={handleFileSelect}
			disabled={disabled || !canAddFiles}
		/>
	</div>

	<!-- Error Message -->
	{#if errorMessage}
		<div class="mt-3 p-3 bg-status-loss-light border border-paper-300 rounded-paper">
			<p class="text-sm text-status-loss">{errorMessage}</p>
		</div>
	{/if}

	<!-- External link to Zerodha Console -->
	<div class="mt-4 text-center">
		<a
			href="https://console.zerodha.com/reports/tradebook"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center text-sm text-accent-500 hover:text-accent-600 hover:underline"
		>
			<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
				/>
			</svg>
			Download from Zerodha Console
		</a>
	</div>

	<!-- Uploaded Files List -->
	{#if files.length > 0}
		<div class="mt-6">
			<h3 class="label-caps mb-3">
				Uploaded ({files.length}/{MAX_FILES})
			</h3>

			<ul class="space-y-2">
				{#each files as file (file.id)}
					<li
						class="flex items-center justify-between p-3 bg-paper-100 rounded-paper border border-paper-300 shadow-paper-sm"
					>
						<div class="flex items-center gap-3 min-w-0">
							<div class="flex-shrink-0 h-10 w-10 rounded-paper bg-status-gain-light flex items-center justify-center">
								<svg class="h-5 w-5 text-status-gain" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<div class="min-w-0">
								<p class="text-sm font-medium text-ink-600 truncate">{file.name}</p>
								<div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
									<span class="inline-flex items-center px-2 py-0.5 rounded-paper text-xs font-mono font-medium bg-paper-200 text-ink-500 border border-paper-300">
										{file.fyRange}
									</span>
									<span class="text-xs text-ink-400">{file.tradeCount} trades</span>
								</div>
							</div>
						</div>
						<button
							type="button"
							class="ml-2 p-2 text-ink-300 hover:text-status-loss hover:bg-status-loss-light rounded-paper transition-colors disabled:opacity-50"
							onclick={() => handleRemove(file.id)}
							{disabled}
							aria-label="Remove {file.name}"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>

			<!-- Summary and Analyze Button -->
			<div class="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<p class="text-sm text-ink-400 text-center sm:text-left">
					<span class="font-semibold text-ink-600">{totalTradeCount}</span> trades from
					<span class="font-semibold text-ink-600">{files.length}</span>
					{files.length === 1 ? 'file' : 'files'}
				</p>

				<button
					type="button"
					class="px-6 py-2.5 bg-ink-600 text-paper-100 font-semibold rounded-paper hover:bg-ink-700
						focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
						transition-all disabled:opacity-50 disabled:cursor-not-allowed
						shadow-paper-sm hover:shadow-paper active:scale-[0.98]"
					onclick={handleAnalyze}
					{disabled}
				>
					Analyze Portfolio
				</button>
			</div>
		</div>
	{/if}
</div>
