/**
 * Configuration interface for CacheService with all configurable parameters
 */
export interface CacheConfig {
	/** Cache directory name (relative to process.cwd()) */
	cacheDir: string;
	
	/** Maximum cache size with flexible units (e.g., "500MB", "1GB", 1000) */
	maxCacheSize: string | number;
	
	/** Maximum cache age with flexible units (e.g., "7d", "24h", 7) */
	maxCacheAge: string | number;
	
	/** Maximum cache key size with flexible units (e.g., "100KB", "1MB", 100) */
	maxCacheKeySize: string | number;
	
	/** File extension for cache files */
	fileExtension: string;
	
	/** Batch metadata save delay in milliseconds */
	metadataSaveDelayMs: number;
	
	/** Cutoff date recalculation interval in milliseconds */
	cutoffDateRecalcIntervalMs: number;
	
	/** Floating point precision for hash normalization */
	floatingPointPrecision: number;
	
	/** Health check metadata consistency threshold percentage */
	healthCheckConsistencyThreshold: number;
	
	/** Large cache size warning threshold in bytes */
	largeCacheWarningThresholdBytes: number;
	
	/** Process max listeners increment for graceful shutdown */
	processMaxListenersIncrement: number;
	
	/** Batch processing size for findKeyByValue operations */
	findKeyBatchSize: number;
	
	/** Batch processing size for findAllKeysByValue operations */
	findAllKeysBatchSize: number;
	
	/** JSON stringify indentation spaces */
	jsonIndentSpaces: number;
	
	/** Size formatting decimal places */
	sizeFormatDecimalPlaces: number;
	
	/** Time formatting decimal places */
	timeFormatDecimalPlaces: number;
	
	/** Statistics calculation decimal places */
	statsDecimalPlaces: number;
}

/**
 * Default configuration values - all magic numbers replaced with named constants
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
	cacheDir: "cache",
	maxCacheSize: "500MB",
	maxCacheAge: "7d",
	maxCacheKeySize: "100KB",
	fileExtension: "cache",
	metadataSaveDelayMs: 100,
	cutoffDateRecalcIntervalMs: 5 * 60 * 1000, // 5 minutes
	floatingPointPrecision: 10,
	healthCheckConsistencyThreshold: 90,
	largeCacheWarningThresholdBytes: 500 * 1024 * 1024, // 500MB
	processMaxListenersIncrement: 10,
	findKeyBatchSize: 15,
	findAllKeysBatchSize: 20,
	jsonIndentSpaces: 2,
	sizeFormatDecimalPlaces: 2,
	timeFormatDecimalPlaces: 2,
	statsDecimalPlaces: 10
};

/**
 * Unit conversion constants
 */
export const UNIT_CONSTANTS = {
	BYTES: {
		B: 1,
		KB: 1024,
		MB: 1024 * 1024,
		GB: 1024 * 1024 * 1024,
		TB: 1024 * 1024 * 1024 * 1024
	},
	TIME: {
		ms: 1,
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000
	},
	FORMATTING: {
		BYTE_UNITS: ["B", "KB", "MB", "GB", "TB"],
		TIME_UNITS: [
			{ name: "ms", value: 1 },
			{ name: "s", value: 1000 },
			{ name: "m", value: 60 * 1000 },
			{ name: "h", value: 60 * 60 * 1000 },
			{ name: "d", value: 24 * 60 * 60 * 1000 },
			{ name: "w", value: 7 * 24 * 60 * 60 * 1000 }
		]
	}
} as const;
