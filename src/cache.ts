import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import * as cacheTypes from "./types/cacheTypes"

export class CacheService {
	private cacheDir: string;
	private metadataFile: string;
	private maxCacheSize: number;
	private maxCacheAge: number;
	private metadata: Map<string, cacheTypes.CacheMetaData>;
	private cacheKeyLimitBytes: number; // Store in bytes, calculate once
	private maxSizeBytes: number;
	private fileExtention: string;
	private metadataSaveTimer?: NodeJS.Timeout; // Batch metadata saves
	private cachedCutoffDate?: Date; // Cache expiration cutoff to avoid recalculation
	
	constructor(dirName: string, maxCacheSizeMB: string | number, maxCacheAge: number, cacheKeyLimitKB: string | number, fileExtention: string) {
		this.cacheDir = path.join(process.cwd(), dirName);
		this.metadataFile = path.join(this.cacheDir, "metadata.json");
		const parsedSize = Number(maxCacheSizeMB);
		this.maxCacheSize = !isNaN(parsedSize) ? parsedSize : 500;
		// Store cache age limit in days
		this.maxCacheAge = maxCacheAge;
		const parsedLimit = parseInt(cacheKeyLimitKB.toString());
		const limitKB = !isNaN(parsedLimit) ? parsedLimit : 100;
		this.cacheKeyLimitBytes = limitKB * 1024;
		this.maxSizeBytes = this.maxCacheSize * 1024 * 1024;
		this.metadata = new Map(); // Store cache metadata for efficient lookups
		this.fileExtention = fileExtention;

		this.initializeCache();
		this.setupGracefulShutdown();
	}

	/**
	 * Sets up automatic graceful shutdown handlers to prevent data loss.
	 * This ensures metadata is always saved when the application exits.
	 * Only sets up handlers if not in a test environment to avoid memory leaks.
	 */
	private setupGracefulShutdown(): void {
		// Skip setup in test environment to prevent listener leaks
		if (process.env.NODE_ENV === "test" || process.argv.includes("--test")) {
			return;
		}

		const gracefulShutdown = async (signal: string) => {
			console.log(`Received ${signal}, shutting down cache gracefully...`);
			try {
				await this.destroy();
				console.log("Cache shutdown complete");
				process.exit(0);
			} catch (error) {
				console.error("Error during cache shutdown:", error);
				process.exit(1);
			}
		};

		// Increase max listeners to avoid warnings
		process.setMaxListeners(process.getMaxListeners() + 10);

		// Handle various termination signals
		process.on("SIGINT", () => gracefulShutdown("SIGINT"));
		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
		process.on("SIGUSR1", () => gracefulShutdown("SIGUSR1"));
		process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));
		
		// Handle uncaught exceptions and unhandled rejections
		process.on("uncaughtException", async (error) => {
			console.error("Uncaught Exception, saving cache data:", error);
			try {
				await this.destroy();
			} catch (cleanupError) {
				console.error("Error saving cache during emergency shutdown:", cleanupError);
			}
			process.exit(1);
		});

		process.on("unhandledRejection", async (reason, promise) => {
			console.error("Unhandled Rejection at:", promise, "reason:", reason);
			try {
				await this.destroy();
			} catch (shutdownError) {
				console.error("Error saving cache during rejection handler:", shutdownError);
			}
		});
	}

	/**
	 * Clean up resources and force immediate metadata save before destruction
	 */
	async destroy(): Promise<void> {
		if (this.metadataSaveTimer) {
			clearTimeout(this.metadataSaveTimer);
			this.metadataSaveTimer = undefined;
		}
		await this.saveMetadata(true); // Force immediate save
	}

	/**
	 * Gets the cached cutoff date to avoid recalculating it multiple times.
	 * Clears cache every 5 minutes for accuracy during long-running operations.
	 */
	private getCutoffDate(): Date {
		const now = new Date();
		if (!this.cachedCutoffDate || 
			now.getTime() - this.cachedCutoffDate.getTime() > 5 * 60 * 1000) { // Recalculate every 5 minutes
			this.cachedCutoffDate = new Date();
			this.cachedCutoffDate.setDate(this.cachedCutoffDate.getDate() - this.maxCacheAge);
		}
		return this.cachedCutoffDate;
	}

	/**
	 * Validates metadata consistency and cleans orphaned entries.
	 * This prevents data corruption and ensures metadata accuracy.
	 */
	private async validateAndCleanMetadata(): Promise<void> {
		if (this.metadata.size === 0) return;

		const orphanedKeys: string[] = [];
		let correctedEntries = 0;

		for (const [cacheKey, metadata] of this.metadata.entries()) {
			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			
			try {
				// Check if file actually exists
				const stats = await fs.stat(filePath);
				
				// Validate metadata size matches actual file size
				if (metadata.dataSize !== stats.size) {
					console.warn(`Metadata size mismatch for ${cacheKey}: metadata=${metadata.dataSize}, actual=${stats.size}`);
					metadata.dataSize = stats.size;
					correctedEntries++;
				}
				
				// Check if file has been modified externally
				const fileCreationTime = new Date(stats.birthtime);
				if (new Date(stats.birthtime) > new Date(metadata.createdAt)) {
					console.warn(`File ${cacheKey} created after metadata timestamp, updating metadata`);
					metadata.createdAt = fileCreationTime.toISOString();
					metadata.lastAccessed = fileCreationTime.toISOString();
					correctedEntries++;
				}
				
			} catch (error) {
				// File doesn't exist, mark for removal
				orphanedKeys.push(cacheKey);
			}
		}

		// Remove orphaned metadata entries
		for (const orphanedKey of orphanedKeys) {
			this.metadata.delete(orphanedKey);
		}

		// Save corrected metadata if changes were made
		if (orphanedKeys.length > 0 || correctedEntries > 0) {
			console.log(`Metadata cleanup: ${orphanedKeys.length} orphaned entries removed, ${correctedEntries} entries corrected`);
			await this.saveMetadata(true); // Force immediate save for corrections
		}
	}

	async initializeCache(): Promise<void> {
		try {
			// Create the cache directory if the cache dir does not exist
			await fs.mkdir(this.cacheDir, { recursive: true });

			await this.loadMetadata();
			await this.validateAndCleanMetadata(); // Ensure metadata consistency
			await this.cleanupOldEntries();
		} catch (error) {
			return console.error("error initializing cache", error);
		}
	}

	generateCacheKey(data: string | Record<string, any>): string {
		const input =
			typeof data === "string"
				? data.trim()
				: JSON.stringify(this.normalizeForHashing(data));

		return crypto.createHash("sha256").update(input).digest("hex");
	}

	/**
	 * Normalizes data for consistent hashing by sorting object keys and handling special cases.
	 * Supports dynamic data types through the `any` parameter for flexibility.
	 */
	normalizeForHashing(data: any): any {
		if (data === null || data === undefined) return data;

		const dataType = typeof data;
		if (dataType === "string" || dataType === "boolean") return data;

		if (dataType === "number") {
			// Handle special number cases
			if (!isFinite(data)) return data.toString();

			// For floating point numbers, use fixed precision
			// This prevents 1.1 and 1.10000000001 from being different keys
			return Number(data.toFixed(10)); // Adjust precision as needed
		}

		if (dataType !== "object") return data;

		if (Array.isArray(data)) {
			return data.map(item => this.normalizeForHashing(item));
		}

		const keys = Object.keys(data).sort();
		const normalized: Record<string, any> = {};

		for (const key of keys) {
			normalized[key] = this.normalizeForHashing(data[key]);
		}

		return normalized;
	}

	validateCacheKeySize(data: any): void {
		const estimatedSizeBytes = this.estimateSizeInBytes(data);

		if (estimatedSizeBytes > this.cacheKeyLimitBytes) {
			const sizeKB = (estimatedSizeBytes / 1024).toFixed(2);
			const limitKB = (this.cacheKeyLimitBytes / 1024).toFixed(0);
			throw new Error(
				`Cache key data too large: ${sizeKB}KB exceeds limit of ${limitKB}KB. ` +
				"Consider using a reference or hash as the cache key instead of the full object."
			);
		}
	}

	/**
	 * Estimates the memory footprint of data by JSON string length.
	 * This provides a reasonable approximation for cache key size validation.
	 */
	estimateSizeInBytes(data: any): number {
		try {
			return JSON.stringify(data).length;
		} catch (error) {
			throw new Error("Cache key data contains circular references or non-serializable content");
		}
	}

	async loadMetadata(): Promise<void> {
		try {
			const data = await fs.readFile(this.metadataFile, "utf8");
			const metadataArray = JSON.parse(data);
			this.metadata = new Map(metadataArray);
		} catch(error) {
			// invalid or missing file, start a new empty map
			this.metadata = new Map();
		}
	}

	async saveMetadata(immediate: boolean = false): Promise<void> {
		try {
			// Ensure directory exists before writing metadata
			await fs.mkdir(this.cacheDir, { recursive: true });
			const metadataArray = Array.from(this.metadata.entries());
			const metadataContent = JSON.stringify(metadataArray, null, 2);
			
			// Atomic write: Write to temporary file first, then rename
			const tempFile = `${this.metadataFile}.tmp.${Date.now()}`;
			await fs.writeFile(tempFile, metadataContent);
			await fs.rename(tempFile, this.metadataFile);
			
		} catch(error) {
			console.error("Failed to save cache metadata", error);
			
			// Cleanup temporary files on error
			try {
				const tempFiles = await fs.readdir(this.cacheDir);
				for (const file of tempFiles.filter(f => f.startsWith("metadata.json.tmp"))) {
					await fs.unlink(path.join(this.cacheDir, file));
				}
			} catch (cleanupError) {
				console.error("Failed to cleanup temporary metadata files", cleanupError);
			}
		}
	}

	/**
	 * Schedules metadata to be saved with batching to reduce I/O operations.
	 * Use immediate=true for critical operations that require immediate persistence.
	 */
	private scheduleMetadataSave(immediate: boolean = false): void {
		if (immediate) {
			if (this.metadataSaveTimer) {
				clearTimeout(this.metadataSaveTimer);
				this.metadataSaveTimer = undefined;
			}
			// Force immediate save for critical operations
			this.saveMetadata(true).catch(error => {
				console.error("Failed to save metadata immediately", error);
			});
		} else {
			if (this.metadataSaveTimer) {
				clearTimeout(this.metadataSaveTimer);
			}
			
			// Only create new timer if none exists
			this.metadataSaveTimer = setTimeout(async () => {
				try {
					await this.saveMetadata(false);
				} catch (error) {
					console.error("Failed to save batched metadata", error);
				} finally {
					this.metadataSaveTimer = undefined;
				}
			}, 100); // Batch saves within 100ms
		}
	}

	async cleanupOldEntries(): Promise<void> {
		const cutoffDate = this.getCutoffDate();
		const cutoffIso = cutoffDate.toISOString();
		let removedCount = 0;
		for (const [cacheKey, entry] of this.metadata.entries()) {
			if (entry.createdAt < cutoffIso) {
				await this.removeEntry(cacheKey);
				removedCount++;
			}
		}

		if (removedCount > 0) {
			console.log(`Items cleared from cache: ${removedCount}\nCutoff: ${cutoffIso}`);
		}
	}

	async enforceMaxCacheSize(): Promise<void> {
		const currentSize = await this.getCurrentCacheSize();

		const sortedEntries = Array.from(this.metadata.entries()).sort(([, a], [, b]) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());
		let removedSize = 0;
		let removedCount = 0;

		for (const [cacheKey, entry] of sortedEntries) {
			if(currentSize - removedSize <= this.maxSizeBytes) {
				break;
			}

			removedSize += entry.dataSize;
			await this.removeEntry(cacheKey);
			removedCount++;
		}

		if (removedCount > 0) {
			console.log("Enforced cache size limits", { removedCount,
				removedSizeMB: Math.round(removedSize / (1024 * 1024) * 100) / 100,
				currentSizeMB: Math.round((currentSize - removedSize) / (1024 * 1024) * 100) / 100,
				maxSizeMB: this.maxCacheSize
			});
		}
	}

	async getCurrentCacheSize(): Promise<number> {
		let totalSize = 0;
		for (const [, entry] of this.metadata.entries()) {
			totalSize += entry.dataSize || 0;
		}
		return totalSize;
	}

	async removeEntry(cacheKey: string): Promise<void> {
		try {
			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			await fs.unlink(filePath).catch(() => {}); // Ignore if files does not exist
			this.metadata.delete(cacheKey);
		} catch(error) {
			console.error("Failed to remove cache entry", error);
		}
	}

	async clearAll(): Promise<void> {
		try {
			const files = await fs.readdir(this.cacheDir);
			const filesToClear = files.filter(file => file.endsWith(this.fileExtention));
			for (const file of filesToClear) {
				await fs.unlink(path.join(this.cacheDir, file));
			}

			this.metadata.clear();
			await this.saveMetadata(true); // Force immediate save for cleanup operations

			console.log("Cleared Cache", filesToClear.length);
		} catch(error) {
			console.error("Failed to clear cache", error);
		}
	}

	/**
	 * Performs a health check on the cache system.
	 * Returns detailed information about cache health and any issues found.
	 */
	async getHealthStatus(): Promise<{
		healthy: boolean;
		issues: string[];
		metadataConsistency: number;
		filesOnDisk: number;
		metadataEntries: number;
		orphanedFiles: number;
		corruptedMetadata: number;
	}> {
		const issues: string[] = [];
		let metadataConsistency = 0;
		let filesOnDisk = 0;
		let orphanedFiles = 0;
		let corruptedMetadata = 0;

		try {
			// Count files on disk
			const files = await fs.readdir(this.cacheDir);
			filesOnDisk = files.filter(file => file.endsWith(`.${this.fileExtention}`)).length;

			// Check metadata consistency
			const metadataCount = this.metadata.size;
			let consistentEntries = 0;

			for (const [cacheKey, metadata] of this.metadata.entries()) {
				const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
				
				try {
					const stats = await fs.stat(filePath);
					if (stats.size === metadata.dataSize) {
						consistentEntries++;
					} else {
						corruptedMetadata++;
						issues.push(`Size mismatch for ${cacheKey}`);
					}
				} catch (error) {
					orphanedFiles++;
					issues.push(`Missing file for ${cacheKey}`);
				}
			}

			metadataConsistency = metadataCount > 0 ? (consistentEntries / metadataCount) * 100 : 100;

			// Check for orphaned files
			for (const file of files.filter(f => f.endsWith(`.${this.fileExtention}`))) {
				const cacheKey = file.replace("." + this.fileExtention, "");
				if (!this.metadata.has(cacheKey)) {
					orphanedFiles++;
					issues.push(`Orphaned file: ${file}`);
				}
			}

			// Check if metadata save timer is stuck
			if (this.metadataSaveTimer) {
				issues.push("Outstanding metadata save pending");
			}

		} catch (error) {
			issues.push(`Health check failed: ${error}`);
		}

		const healthy = issues.length === 0 && metadataConsistency > 90;

		return {
			healthy,
			issues,
			metadataConsistency: Math.round(metadataConsistency * 100) / 100,
			filesOnDisk,
			metadataEntries: this.metadata.size,
			orphanedFiles,
			corruptedMetadata
		};
	}

	async getStats(): Promise<cacheTypes.StatisticData> {
		const currentSize = await this.getCurrentCacheSize();
		const entriesCount = this.metadata.size;
		
		// Calculate hit rate and other stats
		let totalAccesses = 0;
		let oldestEntry;
		let newestEntry;
		
		for (const [, entry] of this.metadata.entries()) {
			totalAccesses += entry.accessCount || 0;
			
			if (!oldestEntry || entry.createdAt < oldestEntry.createdAt) {
				oldestEntry = entry;
			}
			if (!newestEntry || entry.createdAt > newestEntry.createdAt) {
				newestEntry = entry;
			}
		}
		return {
			entriesCount,
			totalSizeBytes: currentSize,
			totalSizeMB: parseFloat((currentSize / (1024 * 1024)).toFixed(10)),
			maxSizeMB: this.maxCacheSize,
			usagePercentage: Math.round((currentSize / (this.maxCacheSize * 1024 * 1024)) * 100),
			totalAccesses,
			averageAccessesPerEntry: entriesCount > 0 ? Math.round(totalAccesses / entriesCount) : 0,
			oldestEntryDate: oldestEntry?.createdAt,
			newestEntryDate: newestEntry?.createdAt,
			maxCacheAgeDays: this.maxCacheAge
		};

	}

	async exists(keyData: string | Record<string, any>): Promise<boolean> {
		try {
			this.validateCacheKeySize(keyData);
			const cacheKey = this.generateCacheKey(keyData);
			
			const metadata = this.metadata.get(cacheKey);
			if (!metadata) return false;

			// Check if entry is expired
			const cutoffDate = this.getCutoffDate();
			if (new Date(metadata.createdAt) < cutoffDate) {
				await this.removeEntry(cacheKey);
				return false;
			}

			// Check if file actually exists on disk
			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			try {
				await fs.access(filePath);
				return true;
			} catch {
				// File doesn't exist, clean up metadata
				this.metadata.delete(cacheKey);
				await this.saveMetadata();
				return false;
			}
		} catch(error) {
			console.error("Error checking cache object", error);
			return false;
		}
	}

	async get(keyData: string | Record<string, any>): Promise<Buffer | null> {
		try {
			this.validateCacheKeySize(keyData);
			const cacheKey = this.generateCacheKey(keyData);
			
			const metadata = this.metadata.get(cacheKey);
			if (!metadata) return null;

			// Check if entry is expired
			const cutoffDate = this.getCutoffDate();
			if (new Date(metadata.createdAt) < cutoffDate) {
				await this.removeEntry(cacheKey);
				return null;
			}

			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			
			try {
				const data = await fs.readFile(filePath);
				
				// Update access metadata
				metadata.lastAccessed = new Date().toISOString();
				metadata.accessCount = (metadata.accessCount || 0) + 1;
				this.metadata.set(cacheKey, metadata);
				this.scheduleMetadataSave(); // Use batched save instead of immediate

				return data;
			} catch (error) {
				// File doesn't exist, clean up metadata
				this.metadata.delete(cacheKey);
				await this.saveMetadata();
				return null;
			}
		} catch (error) {
			console.error("Error getting cache entry", error);
			return null;
		}
	}

	async set(keyData: string | Record<string, any>, data: Buffer | string): Promise<boolean> {
		try {
			this.validateCacheKeySize(keyData);
			const cacheKey = this.generateCacheKey(keyData);
			
			const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			
			// Write the data to disk
			await fs.writeFile(filePath, buffer);
			
			// Create metadata entry
			const now = new Date().toISOString();
			const metadata: cacheTypes.CacheMetaData = {
				key: cacheKey,
				createdAt: now,
				lastAccessed: now,
				dataSize: buffer.length,
				accessCount: 0
			};
			
			this.metadata.set(cacheKey, metadata);
			this.scheduleMetadataSave(); // Use batched save instead of immediate
			
			// Enforce cache size limits after adding new entry
			await this.enforceMaxCacheSize();
			
			return true;
		} catch (error) {
			console.error("Error setting cache entry", error);
			return false;
		}
	}

	async findKeyByValue(searchValue: Buffer | string): Promise<string | null> {
		try {
			// Convert search value to buffer for comparison
			const searchBuffer = Buffer.isBuffer(searchValue) ? searchValue : Buffer.from(searchValue);
			const cutoffDate = this.getCutoffDate();
			
			// Filter candidates by size first to reduce file I/O
			const candidates = Array.from(this.metadata.entries())
				.filter(([cacheKey, metadata]) => {
					// Skip expired entries
					if (new Date(metadata.createdAt) < cutoffDate) return false;
					// Validate metadata size is realistic (not 0 or negative)
					if (metadata.dataSize < 0 || metadata.dataSize > this.maxSizeBytes) return false;
					// Only check entries with matching data size
					return metadata.dataSize === searchBuffer.length;
				});
			
			// Early exit if no candidates
			if (candidates.length === 0) return null;
			
			// Find first match efficiently with additional validation
			for (const [cacheKey, metadata] of candidates) {
				const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
				try {
					const fileData = await fs.readFile(filePath);
					
					// Validate file size matches metadata
					if (fileData.length !== metadata.dataSize) {
						console.warn(`File size mismatch for ${cacheKey}: metadata=${metadata.dataSize}, actual=${fileData.length}`);
						continue;
					}
					
					if (Buffer.compare(fileData, searchBuffer) === 0) {
						return cacheKey; // Return the first matching cache key
					}
				} catch (error) {
					// File doesn't exist or can't be read, clean up metadata
					console.warn(`File access error for ${cacheKey}, removing orphaned metadata`);
					this.metadata.delete(cacheKey);
					continue;
				}
			}
			
			return null;
			
		} catch (error) {
			console.error("Error finding key by value", error);
			return null;
		}
	}

	async findAllKeysByValue(searchValue: Buffer | string): Promise<string[]> {
		try {
			// Convert search value to buffer for comparison
			const searchBuffer = Buffer.isBuffer(searchValue) ? searchValue : Buffer.from(searchValue);
			const cutoffDate = this.getCutoffDate();
			
			// Filter candidates by size first to reduce file I/O
			const candidates = Array.from(this.metadata.entries())
				.filter(([cacheKey, metadata]) => {
					// Skip expired entries
					if (new Date(metadata.createdAt) < cutoffDate) return false;
					// Only check entries with matching data size
					return metadata.dataSize === searchBuffer.length;
				});
			
			const matchingKeys: string[] = [];
			
			// Process all candidates
			for (const [cacheKey] of candidates) {
				const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
				try {
					const fileData = await fs.readFile(filePath);
					if (Buffer.compare(fileData, searchBuffer) === 0) {
						matchingKeys.push(cacheKey);
					}
				} catch (error) {
					// File doesn't exist or can't be read, skip
					continue;
				}
			}
			
			return matchingKeys;
			
		} catch (error) {
			console.error("Error finding all keys by value", error);
			return [];
		}
	}

}