/**
 * Batch Operation Handler
 * 
 * Composite operation that executes multiple operations (Composite/Leaf pattern)
 * Supports:
 * - Sequential execution (one after another)
 * - Parallel execution (all at once)
 * - Error handling (continueOnError)
 * - Nested composition (unlimited depth)
 */

/**
 * Handle batch operation
 * 
 * @param {object} operation - { op: "batch", mode: "sequential"|"parallel", operations: [...], continueOnError?: boolean }
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} Batch execution result
 */
export async function handleBatch(operation, kernel) {
	const { operations, mode = "sequential", continueOnError = false } =
		operation;
	const results = [];
	const errors = [];

	if (mode === "sequential") {
		// Execute operations one by one
		for (const [index, subOp] of operations.entries()) {
			try {
				// Recursive execution through operations engine (Composite pattern!)
				const result = await kernel.operationsEngine.execute(subOp);
				results.push({ index, success: true, result });
			} catch (error) {
				errors.push({ index, error: error.message });

				if (!continueOnError) {
					// Fail fast
					throw new Error(
						`Batch operation failed at index ${index}: ${error.message}`,
					);
				}

				// Continue execution
				results.push({ index, success: false, error: error.message });
			}
		}
	} else if (mode === "parallel") {
		// Execute all operations in parallel
		const promises = operations.map((subOp, index) =>
			kernel.operationsEngine
				.execute(subOp)
				.then((result) => ({ index, success: true, result }))
				.catch((error) => ({
					index,
					success: false,
					error: error.message,
				})),
		);

		const settled = await Promise.allSettled(promises);

		for (const [index, outcome] of settled.entries()) {
			if (outcome.status === "fulfilled") {
				const value = outcome.value;
				results.push(value);

				if (!value.success) {
					errors.push({ index, error: value.error });

					if (!continueOnError) {
						throw new Error(
							`Batch operation failed at index ${index}: ${value.error}`,
						);
					}
				}
			} else {
				// Promise itself rejected (shouldn't happen with our catch above)
				errors.push({ index, error: outcome.reason });

				if (!continueOnError) {
					throw new Error(
						`Batch operation failed at index ${index}: ${outcome.reason}`,
					);
				}

				results.push({ index, success: false, error: outcome.reason });
			}
		}
	} else {
		throw new Error(`Invalid batch mode: ${mode}. Must be "sequential" or "parallel".`);
	}

	return {
		mode,
		total: operations.length,
		successful: results.filter((r) => r.success).length,
		failed: errors.length,
		results,
		errors: errors.length > 0 ? errors : undefined,
	};
}
