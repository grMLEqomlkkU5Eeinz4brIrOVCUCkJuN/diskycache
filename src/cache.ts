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
	
	constructor(dirName: string, maxCacheSizeMB: string | number, maxCacheAge: number, cacheKeyLimitKB: string | number, fileExtention: string) {
		this.cacheDir = path.join(process.cwd(), dirName);
		this.metadataFile = path.join(this.cacheDir, "metadata.json");
		const parsedSize = Number(maxCacheSizeMB);
		this.maxCacheSize = !isNaN(parsedSize) ? parsedSize : 500;
		// regarding the age, I might use something to parse durations
		this.maxCacheAge = maxCacheAge;
		const parsedLimit = parseInt(cacheKeyLimitKB.toString());
		const limitKB = !isNaN(parsedLimit) ? parsedLimit : 100;
		this.cacheKeyLimitBytes = limitKB * 1024;
		this.maxSizeBytes = this.maxCacheSize * 1024 * 1024;
		this.metadata = new Map(); // conflicted feelings of using a map
		this.fileExtention = fileExtention;

		this.initializeCache();
	}

	async initializeCache(): Promise<void> {
		try {
			// Create the cache directory if the cache dir does not exist
			await fs.mkdir(this.cacheDir, { recursive: true });

			await this.loadMetadata();
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

	// we have no real clue what the user might put in, so any is needed here
	// The idea here is to normalize the data and sort it accordingly
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

	// This might not be the best estimate, I need to check back on this ngl
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

	async saveMetadata(): Promise<void> {
		try {
			const metadataArray = Array.from(this.metadata.entries());
			await fs.writeFile(this.metadataFile, JSON.stringify(metadataArray, null, 2));
		} catch(error) {
			console.error("Failed to save cache metadata", error);
		}
	}

	async cleanupOldEntries(): Promise<void> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.maxCacheAge);
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
			await this.saveMetadata();

			console.log("Cleared Cache", filesToClear.length);
		} catch(error) {
			console.error("Failed to clear cache", error);
		}
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
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.maxCacheAge);
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
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.maxCacheAge);
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
				await this.saveMetadata();

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
			await this.saveMetadata();
			
			// Enforce cache size limits after adding new entry
			await this.enforceMaxCacheSize();
			
			return true;
		} catch (error) {
			console.error("Error setting cache entry", error);
			return false;
		}
	}

}