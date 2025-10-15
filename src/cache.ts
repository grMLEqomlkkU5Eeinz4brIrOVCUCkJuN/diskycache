import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import * as cacheTypes from "./types/cacheTypes";
import { CacheConfig, DEFAULT_CACHE_CONFIG, UNIT_CONSTANTS } from "./types/cacheConfig";

/**
 * Configuration parser for flexible unit handling
 */
class ConfigParser {
	/**
	 * Parse size configuration with support for different units
	 * Supports: B, KB, MB, GB, TB (case insensitive)
	 * Examples: "500MB", "1.5GB", "1024KB", "2TB"
	 */
	static parseSize(value: string | number): number {
		if (typeof value === "number") {
			// Treat bare numbers as MB for backward compatibility
			return value * UNIT_CONSTANTS.BYTES.MB;
		}

		const sizeStr = value.toString().trim().toUpperCase();
		const units = UNIT_CONSTANTS.BYTES;

		// Extract number and unit
		const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)?$/);
		if (!match) {
			throw new Error(`Invalid size format: ${value}. Expected format: "500MB", "1.5GB", etc.`);
		}

		const [, numStr, unitStr] = match;
		const num = parseFloat(numStr);
		
		if (isNaN(num)) {
			throw new Error(`Invalid number in size: ${value}`);
		}

		// Default to MB if no unit specified
		const unit = unitStr || "MB";
		const multiplier = units[unit as keyof typeof units];
		
		if (!multiplier) {
			throw new Error(`Unsupported size unit: ${unit}. Supported units: B, KB, MB, GB, TB`);
		}

		return num * multiplier;
	}

	/**
	 * Parse time configuration with support for different units
	 * Supports: ms, s, m, h, d, w (case insensitive)
	 * Examples: "7d", "24h", "3600s", "1w"
	 */
	static parseTime(value: string | number): number {
		if (typeof value === "number") {
			return value;
		}

		const timeStr = value.toString().trim().toLowerCase();
		const units = UNIT_CONSTANTS.TIME;

		// Extract number and unit
		const match = timeStr.match(/^([\d.]+)\s*([a-z]+)?$/);
		if (!match) {
			throw new Error(`Invalid time format: ${value}. Expected format: "7d", "24h", "3600s", etc.`);
		}

		const [, numStr, unitStr] = match;
		const num = parseFloat(numStr);
		
		if (isNaN(num)) {
			throw new Error(`Invalid number in time: ${value}`);
		}

		// Default to days if no unit specified
		const unit = unitStr || "d";
		const multiplier = units[unit as keyof typeof units];
		
		if (!multiplier) {
			throw new Error(`Unsupported time unit: ${unit}. Supported units: ms, s, m, h, d, w`);
		}

		return num * multiplier;
	}

	/**
	 * Parse cache age and return days (for backward compatibility)
	 */
	static parseCacheAge(value: string | number): number {
		if (typeof value === "number") {
			// Treat bare numbers as days for backward compatibility
			return value;
		}
		const milliseconds = this.parseTime(value);
		return milliseconds / UNIT_CONSTANTS.TIME.d; // Convert to days
	}

	/**
	 * Parse cache size and return MB (for backward compatibility)
	 */
	static parseCacheSize(value: string | number): number {
		const bytes = this.parseSize(value);
		return bytes / UNIT_CONSTANTS.BYTES.MB; // Convert to MB
	}

	/**
	 * Parse cache key limit and return KB (for backward compatibility)
	 */
	static parseCacheKeyLimit(value: string | number): number {
		if (typeof value === "number") {
			// Treat bare numbers as KB for backward compatibility
			return value;
		}
		const bytes = this.parseSize(value);
		return bytes / UNIT_CONSTANTS.BYTES.KB; // Convert to KB
	}

	/**
	 * Format bytes to human readable string
	 */
	static formatBytes(bytes: number): string {
		const units = UNIT_CONSTANTS.FORMATTING.BYTE_UNITS;
		let size = bytes;
		let unitIndex = 0;

		while (size >= UNIT_CONSTANTS.BYTES.KB && unitIndex < units.length - 1) {
			size /= UNIT_CONSTANTS.BYTES.KB;
			unitIndex++;
		}

		return `${size.toFixed(DEFAULT_CACHE_CONFIG.sizeFormatDecimalPlaces)} ${units[unitIndex]}`;
	}

	/**
	 * Format milliseconds to human readable string
	 */
	static formatTime(milliseconds: number): string {
		const units = UNIT_CONSTANTS.FORMATTING.TIME_UNITS;

		for (let i = units.length - 1; i >= 0; i--) {
			const unit = units[i];
			if (milliseconds >= unit.value) {
				const value = milliseconds / unit.value;
				return `${value.toFixed(DEFAULT_CACHE_CONFIG.timeFormatDecimalPlaces)} ${unit.name}`;
			}
		}

		return `${milliseconds} ms`;
	}
}

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
	private contentHashCache?: Map<string, string>; // Cache for content hashes to avoid re-reading files
	
	// Index system for fast lookups
	private contentHashIndex?: Map<string, Set<string>>; // content hash -> set of cache keys
	private sizeIndex?: Map<number, Set<string>>; // data size -> set of cache keys
	private dateIndex?: Map<string, Set<string>>; // date (YYYY-MM-DD) -> set of cache keys
	private accessCountIndex?: Map<number, Set<string>>; // access count -> set of cache keys
	
	// Configuration
	private config: CacheConfig;
	
	// Method overloading for constructor
	constructor(config: CacheConfig);
	constructor(dirName: string, maxCacheSize: string | number, maxCacheAge: string | number, cacheKeyLimit: string | number, fileExtention: string);
	constructor(
		configOrDirName: CacheConfig | string, 
		maxCacheSize?: string | number, 
		maxCacheAge?: string | number, 
		cacheKeyLimit?: string | number, 
		fileExtention?: string
	) {
		// Determine if first parameter is a config object or individual parameters
		if (typeof configOrDirName === "object") {
			// New configuration-based constructor
			this.config = { ...DEFAULT_CACHE_CONFIG, ...configOrDirName };
		} else {
			// Legacy constructor - create config from individual parameters
			this.config = {
				...DEFAULT_CACHE_CONFIG,
				cacheDir: configOrDirName,
				maxCacheSize: maxCacheSize || DEFAULT_CACHE_CONFIG.maxCacheSize,
				maxCacheAge: maxCacheAge || DEFAULT_CACHE_CONFIG.maxCacheAge,
				maxCacheKeySize: cacheKeyLimit || DEFAULT_CACHE_CONFIG.maxCacheKeySize,
				fileExtension: fileExtention || DEFAULT_CACHE_CONFIG.fileExtension
			};
		}

		this.cacheDir = path.join(process.cwd(), this.config.cacheDir);
		this.metadataFile = path.join(this.cacheDir, "metadata.json");
		
		try {
			// Parse cache size with flexible units
			this.maxCacheSize = ConfigParser.parseCacheSize(this.config.maxCacheSize);
			this.maxSizeBytes = ConfigParser.parseSize(this.config.maxCacheSize);
			
			// Warn users about untested large cache sizes
			if (this.maxSizeBytes > this.config.largeCacheWarningThresholdBytes) {
				const sizeStr = ConfigParser.formatBytes(this.maxSizeBytes);
				console.warn(`⚠️  WARNING: Cache size ${sizeStr} exceeds ${ConfigParser.formatBytes(this.config.largeCacheWarningThresholdBytes)} threshold. Diskycache was made for toy projects, not for production environments.`);
				console.warn("   Large cache sizes (" + sizeStr + ") have not been thoroughly tested.");
				console.warn("   Consider using a smaller cache size or a different caching solution");
				console.warn("   for production environments requiring >" + ConfigParser.formatBytes(this.config.largeCacheWarningThresholdBytes) + " cache storage.");
				console.warn("   Current configuration may experience performance issues or memory problems.");
			}
		} catch (error) {
			console.warn(`Invalid cache size format: ${this.config.maxCacheSize}, using default ${DEFAULT_CACHE_CONFIG.maxCacheSize}`);
			this.maxCacheSize = ConfigParser.parseCacheSize(DEFAULT_CACHE_CONFIG.maxCacheSize);
			this.maxSizeBytes = ConfigParser.parseSize(DEFAULT_CACHE_CONFIG.maxCacheSize);
		}
		
		try {
			// Parse cache age with flexible units
			this.maxCacheAge = ConfigParser.parseCacheAge(this.config.maxCacheAge);
		} catch (error) {
			console.warn(`Invalid cache age format: ${this.config.maxCacheAge}, using default ${DEFAULT_CACHE_CONFIG.maxCacheAge}`);
			this.maxCacheAge = ConfigParser.parseCacheAge(DEFAULT_CACHE_CONFIG.maxCacheAge);
		}
		
		try {
			// Parse cache key limit with flexible units
			const limitKB = ConfigParser.parseCacheKeyLimit(this.config.maxCacheKeySize);
			this.cacheKeyLimitBytes = limitKB * UNIT_CONSTANTS.BYTES.KB;
		} catch (error) {
			console.warn(`Invalid cache key limit format: ${this.config.maxCacheKeySize}, using default ${DEFAULT_CACHE_CONFIG.maxCacheKeySize}`);
			this.cacheKeyLimitBytes = ConfigParser.parseCacheKeyLimit(DEFAULT_CACHE_CONFIG.maxCacheKeySize) * UNIT_CONSTANTS.BYTES.KB;
		}
		
		this.metadata = new Map(); // Store cache metadata for efficient lookups
		this.fileExtention = this.config.fileExtension;
		this.contentHashCache = new Map(); // Initialize content hash cache
		
		// Initialize index system
		this.contentHashIndex = new Map();
		this.sizeIndex = new Map();
		this.dateIndex = new Map();
		this.accessCountIndex = new Map();

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
		process.setMaxListeners(process.getMaxListeners() + this.config.processMaxListenersIncrement);

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
	 * Clears cache every configured interval for accuracy during long-running operations.
	 */
	private getCutoffDate(): Date {
		const now = new Date();
		if (!this.cachedCutoffDate || 
			now.getTime() - this.cachedCutoffDate.getTime() > this.config.cutoffDateRecalcIntervalMs) {
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

			// For floating point numbers, use configured precision
			// This prevents 1.1 and 1.10000000001 from being different keys
			return Number(data.toFixed(this.config.floatingPointPrecision));
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
			const sizeKB = (estimatedSizeBytes / UNIT_CONSTANTS.BYTES.KB).toFixed(DEFAULT_CACHE_CONFIG.sizeFormatDecimalPlaces);
			const limitKB = (this.cacheKeyLimitBytes / UNIT_CONSTANTS.BYTES.KB).toFixed(0);
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
			// Don't create metadata file if there's no data to save
			if (this.metadata.size === 0) {
				// If metadata file exists but we have no data, remove it
				try {
					await fs.unlink(this.metadataFile);
				} catch (unlinkError) {
					// Ignore if file doesn't exist
				}
				return;
			}

			// Ensure directory exists before writing metadata
			await fs.mkdir(this.cacheDir, { recursive: true });
			const metadataArray = Array.from(this.metadata.entries());
			const metadataContent = JSON.stringify(metadataArray, null, this.config.jsonIndentSpaces);
			
			// Atomic write: Write to temporary file first, then rename
			const tempFile = path.join(this.cacheDir, `metadata.json.tmp.${Date.now()}`);
			await fs.writeFile(tempFile, metadataContent);
			await fs.rename(tempFile, this.metadataFile);
			
		} catch (error: any) {
			// Only log error if it's not a directory-not-found error during cleanup
			if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
				console.error("Failed to save cache metadata", error);
			}
			
			// Cleanup temporary files on error
			try {
				const tempFiles = await fs.readdir(this.cacheDir);
				for (const file of tempFiles.filter(f => f.startsWith("metadata.json.tmp"))) {
					await fs.unlink(path.join(this.cacheDir, file));
				}
			} catch (cleanupError) {
				// Ignore cleanup errors if directory doesn't exist
				if (!(cleanupError && typeof cleanupError === "object" && "code" in cleanupError && cleanupError.code === "ENOENT")) {
					console.error("Failed to cleanup temporary metadata files", cleanupError);
				}
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
			}, this.config.metadataSaveDelayMs); // Batch saves within configured delay
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
				removedSizeMB: Math.round(removedSize / UNIT_CONSTANTS.BYTES.MB * 100) / 100,
				currentSizeMB: Math.round((currentSize - removedSize) / UNIT_CONSTANTS.BYTES.MB * 100) / 100,
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
			
			// Remove from indexes before deleting metadata
			const metadata = this.metadata.get(cacheKey);
			if (metadata) {
				const contentHash = this.contentHashCache?.get(cacheKey);
				this.removeFromIndexes(cacheKey, metadata, contentHash);
			}
			
			this.metadata.delete(cacheKey);
			// Clean up content hash cache
			this.contentHashCache?.delete(cacheKey);
		} catch(error) {
			console.error("Failed to remove cache entry", error);
		}
	}

	async clearAll(): Promise<void> {
		try {
			// Clear any pending metadata save timers first
			if (this.metadataSaveTimer) {
				clearTimeout(this.metadataSaveTimer);
				this.metadataSaveTimer = undefined;
			}

			const files = await fs.readdir(this.cacheDir);
			const filesToClear = files.filter(file => file.endsWith(this.fileExtention));
			for (const file of filesToClear) {
				await fs.unlink(path.join(this.cacheDir, file));
			}

			this.metadata.clear();
			this.contentHashCache?.clear(); // Clear content hash cache
			
			// Clear all indexes
			this.contentHashIndex?.clear();
			this.sizeIndex?.clear();
			this.dateIndex?.clear();
			this.accessCountIndex?.clear();
			
			// Try to save metadata, but don't fail if directory doesn't exist
			try {
				await this.saveMetadata(true); // Force immediate save for cleanup operations
			} catch (saveError) {
				// Ignore save errors during cleanup - the cache is already cleared
				console.warn("Could not save metadata during cleanup:", saveError instanceof Error ? saveError.message : String(saveError));
			}

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

		const healthy = issues.length === 0 && metadataConsistency > this.config.healthCheckConsistencyThreshold;

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
			totalSizeMB: parseFloat((currentSize / UNIT_CONSTANTS.BYTES.MB).toFixed(this.config.statsDecimalPlaces)),
			maxSizeMB: this.maxCacheSize,
			usagePercentage: Math.round((currentSize / (this.maxCacheSize * UNIT_CONSTANTS.BYTES.MB)) * 100),
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

	async deleteKey(keyData: string | Record<string, any>): Promise<boolean> {
		try {
			this.validateCacheKeySize(keyData);
			const cacheKey = this.generateCacheKey(keyData);
			
			const metadata = this.metadata.get(cacheKey);
			if (!metadata) {
				// Key doesn't exist in metadata, but check if file exists
				const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
				try {
					await fs.access(filePath);
					// File exists but no metadata, clean it up
					await fs.unlink(filePath);
					return true;
				} catch {
					// Neither metadata nor file exists
					return false;
				}
			}

			// Remove the entry (file, metadata, and indexes)
			await this.removeEntry(cacheKey);
			return true;
		} catch (error) {
			console.error("Error deleting cache key", error);
			return false;
		}
	}

	async set(keyData: string | Record<string, any>, data: Buffer | string): Promise<boolean> {
		try {
			this.validateCacheKeySize(keyData);
			const cacheKey = this.generateCacheKey(keyData);
			
			const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			
			// Calculate content hash for indexing
			const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
			
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
			
			// Remove old entry from indexes if it exists
			const oldMetadata = this.metadata.get(cacheKey);
			if (oldMetadata) {
				const oldContentHash = this.contentHashCache?.get(cacheKey);
				this.removeFromIndexes(cacheKey, oldMetadata, oldContentHash);
			}
			
			this.metadata.set(cacheKey, metadata);
			this.contentHashCache?.set(cacheKey, contentHash);
			
			// Add to all indexes
			this.addToIndexes(cacheKey, metadata, contentHash);
			
			this.scheduleMetadataSave(); // Use batched save instead of immediate
			
			// Enforce cache size limits after adding new entry
			await this.enforceMaxCacheSize();
			
			return true;
		} catch (error) {
			console.error("Error setting cache entry", error);
			return false;
		}
	}

	/**
	 * Convenience helper to store JSON-serializable data.
	 */
	async setJSON(keyData: string | Record<string, any>, data: unknown): Promise<boolean> {
		try {
			const json = JSON.stringify(data);
			return await this.set(keyData, json);
		} catch (error) {
			console.error("Error serializing JSON for cache entry", error);
			return false;
		}
	}

	/**
	 * Convenience helper to retrieve and parse JSON data.
	 */
	async getJSON<T = unknown>(keyData: string | Record<string, any>): Promise<T | null> {
		const buffer = await this.get(keyData);
		if (!buffer) return null;
		try {
			return JSON.parse(buffer.toString()) as T;
		} catch (error) {
			console.error("Error parsing JSON from cache entry", error);
			return null;
		}
	}

	/**
	 * Adds an entry to all relevant indexes
	 */
	private addToIndexes(cacheKey: string, metadata: cacheTypes.CacheMetaData, contentHash?: string): void {
		// Add to size index
		if (!this.sizeIndex!.has(metadata.dataSize)) {
			this.sizeIndex!.set(metadata.dataSize, new Set());
		}
		this.sizeIndex!.get(metadata.dataSize)!.add(cacheKey);

		// Add to date index (by creation date)
		const dateKey = new Date(metadata.createdAt).toISOString().split("T")[0];
		if (!this.dateIndex!.has(dateKey)) {
			this.dateIndex!.set(dateKey, new Set());
		}
		this.dateIndex!.get(dateKey)!.add(cacheKey);

		// Add to access count index
		const accessCount = metadata.accessCount || 0;
		if (!this.accessCountIndex!.has(accessCount)) {
			this.accessCountIndex!.set(accessCount, new Set());
		}
		this.accessCountIndex!.get(accessCount)!.add(cacheKey);

		// Add to content hash index if provided
		if (contentHash) {
			if (!this.contentHashIndex!.has(contentHash)) {
				this.contentHashIndex!.set(contentHash, new Set());
			}
			this.contentHashIndex!.get(contentHash)!.add(cacheKey);
		}
	}

	/**
	 * Removes an entry from all relevant indexes
	 */
	private removeFromIndexes(cacheKey: string, metadata: cacheTypes.CacheMetaData, contentHash?: string): void {
		// Remove from size index
		const sizeSet = this.sizeIndex!.get(metadata.dataSize);
		if (sizeSet) {
			sizeSet.delete(cacheKey);
			if (sizeSet.size === 0) {
				this.sizeIndex!.delete(metadata.dataSize);
			}
		}

		// Remove from date index
		const dateKey = new Date(metadata.createdAt).toISOString().split("T")[0];
		const dateSet = this.dateIndex!.get(dateKey);
		if (dateSet) {
			dateSet.delete(cacheKey);
			if (dateSet.size === 0) {
				this.dateIndex!.delete(dateKey);
			}
		}

		// Remove from access count index
		const accessCount = metadata.accessCount || 0;
		const accessSet = this.accessCountIndex!.get(accessCount);
		if (accessSet) {
			accessSet.delete(cacheKey);
			if (accessSet.size === 0) {
				this.accessCountIndex!.delete(accessCount);
			}
		}

		// Remove from content hash index if provided
		if (contentHash) {
			const hashSet = this.contentHashIndex!.get(contentHash);
			if (hashSet) {
				hashSet.delete(cacheKey);
				if (hashSet.size === 0) {
					this.contentHashIndex!.delete(contentHash);
				}
			}
		}
	}

	/**
	 * Gets the content hash for a file, using cache if available
	 */
	private async getContentHash(cacheKey: string, metadata: cacheTypes.CacheMetaData): Promise<string | null> {
		try {
			// Check if we have a cached hash
			const cachedHash = this.contentHashCache?.get(cacheKey);
			if (cachedHash) {
				return cachedHash;
			}

			const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
			const fileData = await fs.readFile(filePath);
			
			// Validate file size matches metadata
			if (fileData.length !== metadata.dataSize) {
				console.warn(`File size mismatch for ${cacheKey}: metadata=${metadata.dataSize}, actual=${fileData.length}`);
				return null;
			}
			
			// Calculate hash and cache it
			const hash = crypto.createHash("sha256").update(fileData).digest("hex");
			this.contentHashCache?.set(cacheKey, hash);
			
			return hash;
		} catch (error) {
			// File doesn't exist or can't be read
			return null;
		}
	}

	async findKeyByValue(searchValue: Buffer | string): Promise<string | null> {
		try {
			// Convert search value to buffer for comparison
			const searchBuffer = Buffer.isBuffer(searchValue) ? searchValue : Buffer.from(searchValue);
			const searchHash = crypto.createHash("sha256").update(searchBuffer).digest("hex");
			
			// First check if we have this content hash in our index
			const indexedKeys = this.contentHashIndex?.get(searchHash);
			if (indexedKeys && indexedKeys.size > 0) {
				// Return the first key from the index (fastest possible lookup)
				return indexedKeys.values().next().value || null;
			}
			
			// Fallback to size-based filtering for non-indexed content
			const cutoffDate = this.getCutoffDate();
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
			
			// Process candidates in parallel batches for better performance
			const batchSize = Math.min(this.config.findKeyBatchSize, candidates.length);
			
			for (let i = 0; i < candidates.length; i += batchSize) {
				const batch = candidates.slice(i, i + batchSize);
				
				// Get content hashes in parallel
				const hashPromises = batch.map(async ([cacheKey, metadata]) => {
					const contentHash = await this.getContentHash(cacheKey, metadata);
					if (contentHash === searchHash) {
						// Add to content hash index for future fast lookups
						if (!this.contentHashIndex!.has(contentHash)) {
							this.contentHashIndex!.set(contentHash, new Set());
						}
						this.contentHashIndex!.get(contentHash)!.add(cacheKey);
						return cacheKey;
					}
					return null;
				});
				
				// Wait for batch to complete and check for matches
				const results = await Promise.all(hashPromises);
				const match = results.find(result => result !== null);
				
				if (match) {
					return match; // Return first match found
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
			const searchHash = crypto.createHash("sha256").update(searchBuffer).digest("hex");
			
			// First check if we have this content hash in our index
			const indexedKeys = this.contentHashIndex?.get(searchHash);
			if (indexedKeys && indexedKeys.size > 0) {
				// Return all keys from the index (fastest possible lookup)
				return Array.from(indexedKeys);
			}
			
			// Fallback to size-based filtering for non-indexed content
			const cutoffDate = this.getCutoffDate();
			const candidates = Array.from(this.metadata.entries())
				.filter(([cacheKey, metadata]) => {
					// Skip expired entries
					if (new Date(metadata.createdAt) < cutoffDate) return false;
					// Only check entries with matching data size
					return metadata.dataSize === searchBuffer.length;
				});
			
			// Early exit if no candidates
			if (candidates.length === 0) return [];
			
			const matchingKeys: string[] = [];
			
			// Process candidates in parallel batches for better performance
			const batchSize = Math.min(this.config.findAllKeysBatchSize, candidates.length);
			
			for (let i = 0; i < candidates.length; i += batchSize) {
				const batch = candidates.slice(i, i + batchSize);
				
				// Get content hashes in parallel
				const hashPromises = batch.map(async ([cacheKey, metadata]) => {
					const contentHash = await this.getContentHash(cacheKey, metadata);
					if (contentHash === searchHash) {
						// Add to content hash index for future fast lookups
						if (!this.contentHashIndex!.has(contentHash)) {
							this.contentHashIndex!.set(contentHash, new Set());
						}
						this.contentHashIndex!.get(contentHash)!.add(cacheKey);
						return cacheKey;
					}
					return null;
				});
				
				// Wait for batch to complete and collect matches
				const results = await Promise.all(hashPromises);
				const batchMatches = results.filter(result => result !== null) as string[];
				matchingKeys.push(...batchMatches);
			}
			
			return matchingKeys;
			
		} catch (error) {
			console.error("Error finding all keys by value", error);
			return [];
		}
	}

	/**
	 * Find all cache keys by data size (uses size index for fast lookup)
	 */
	async findKeysBySize(dataSize: number): Promise<string[]> {
		try {
			const sizeSet = this.sizeIndex?.get(dataSize);
			if (sizeSet) {
				return Array.from(sizeSet);
			}
			return [];
		} catch (error) {
			console.error("Error finding keys by size", error);
			return [];
		}
	}

	/**
	 * Find all cache keys created on a specific date (uses date index for fast lookup)
	 */
	async findKeysByDate(date: string): Promise<string[]> {
		try {
			const dateSet = this.dateIndex?.get(date);
			if (dateSet) {
				return Array.from(dateSet);
			}
			return [];
		} catch (error) {
			console.error("Error finding keys by date", error);
			return [];
		}
	}

	/**
	 * Find all cache keys with a specific access count (uses access count index for fast lookup)
	 */
	async findKeysByAccessCount(accessCount: number): Promise<string[]> {
		try {
			const accessSet = this.accessCountIndex?.get(accessCount);
			if (accessSet) {
				return Array.from(accessSet);
			}
			return [];
		} catch (error) {
			console.error("Error finding keys by access count", error);
			return [];
		}
	}

	/**
	 * Get index statistics for monitoring and debugging
	 */
	getIndexStats(): {
		contentHashIndexSize: number;
		sizeIndexSize: number;
		dateIndexSize: number;
		accessCountIndexSize: number;
		totalIndexedKeys: number;
		} {
		return {
			contentHashIndexSize: this.contentHashIndex?.size || 0,
			sizeIndexSize: this.sizeIndex?.size || 0,
			dateIndexSize: this.dateIndex?.size || 0,
			accessCountIndexSize: this.accessCountIndex?.size || 0,
			totalIndexedKeys: Array.from(this.metadata.keys()).length
		};
	}

	/**
	 * Get current cache configuration in human-readable format
	 */
	getConfiguration(): {
		cacheDir: string;
		maxCacheSize: string;
		maxCacheAge: string;
		cacheKeyLimit: string;
		fileExtension: string;
		} {
		return {
			cacheDir: this.cacheDir,
			maxCacheSize: ConfigParser.formatBytes(this.maxSizeBytes),
			maxCacheAge: ConfigParser.formatTime(this.maxCacheAge * 24 * 60 * 60 * 1000),
			cacheKeyLimit: ConfigParser.formatBytes(this.cacheKeyLimitBytes),
			fileExtension: this.fileExtention
		};
	}

	/**
	 * Update cache size limit with flexible units
	 * Examples: "1GB", "500MB", "2TB"
	 */
	async updateCacheSize(newSize: string | number): Promise<boolean> {
		try {
			const newSizeMB = ConfigParser.parseCacheSize(newSize);
			const newSizeBytes = ConfigParser.parseSize(newSize);
			
			// Warn users about untested large cache sizes
			if (newSizeBytes > this.config.largeCacheWarningThresholdBytes) {
				const sizeStr = ConfigParser.formatBytes(newSizeBytes);
				console.warn(`⚠️  WARNING: Cache size ${sizeStr} exceeds ${ConfigParser.formatBytes(this.config.largeCacheWarningThresholdBytes)} threshold.`);
				console.warn("   Large cache sizes (" + sizeStr + ") have not been thoroughly tested.");
				console.warn("   Consider using a smaller cache size or a different caching solution");
				console.warn("   for production environments requiring >" + ConfigParser.formatBytes(this.config.largeCacheWarningThresholdBytes) + " cache storage.");
				console.warn("   Current configuration may experience performance issues or memory problems.");
			}
			
			this.maxCacheSize = newSizeMB;
			this.maxSizeBytes = newSizeBytes;
			
			// Enforce new size limit
			await this.enforceMaxCacheSize();
			
			return true;
		} catch (error) {
			console.error("Failed to update cache size:", error);
			return false;
		}
	}

	/**
	 * Update cache age limit with flexible units
	 * Examples: "7d", "24h", "1w", "3600s"
	 */
	updateCacheAge(newAge: string | number): boolean {
		try {
			this.maxCacheAge = ConfigParser.parseCacheAge(newAge);
			// Clear cached cutoff date to force recalculation
			this.cachedCutoffDate = undefined;
			return true;
		} catch (error) {
			console.error("Failed to update cache age:", error);
			return false;
		}
	}

	/**
	 * Update cache key limit with flexible units
	 * Examples: "100KB", "1MB", "500B"
	 */
	updateCacheKeyLimit(newLimit: string | number): boolean {
		try {
			const limitKB = ConfigParser.parseCacheKeyLimit(newLimit);
			this.cacheKeyLimitBytes = limitKB * UNIT_CONSTANTS.BYTES.KB;
			return true;
		} catch (error) {
			console.error("Failed to update cache key limit:", error);
			return false;
		}
	}

}
