export interface CacheMetaData {
	key: string;
	createdAt: string;
	lastAccessed: string;
	accessCount: number;
	dataSize: number;
	[key: string]: any; // custom data that the user might be interested in adding
}

export interface StatisticData {
	entriesCount: number;
	totalSizeBytes: number;
	totalSizeMB: number;
	maxSizeMB: number;
	totalAccesses: number;
	averageAccessesPerEntry: number;
	oldestEntryDate: string | undefined;
	newestEntryDate: string | undefined,
	maxCacheAgeDays: number;
	usagePercentage: number;
}