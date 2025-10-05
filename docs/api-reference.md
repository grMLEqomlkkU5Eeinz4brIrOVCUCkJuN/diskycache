# DiskyCache API Reference

Complete API documentation for all DiskyCache methods, types, and configuration options.

## Constructor

### `new CacheService(dirName, maxCacheSizeMB?, maxCacheAgeDays?, maxKeySizeKB?, fileExtension?)`

Creates a new DiskyCache instance.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dirName` | `string` | Required | Cache directory path |
| `maxCacheSizeMB` | `number` | `500` | Maximum cache size in MB |
| `maxCacheAgeDays` | `number` | Required | Maximum age before expiration |
| `maxKeySizeKB` | `number` | `100` | Maximum key size in KB |
| `fileExtension` | `string` | `"cache"` | File extension for cached files |

**Example:**
```ts
const cache = new CacheService("my-cache", 200, 7, 50, "json");
```

## Core Operations

### `set(keyData, data): Promise<boolean>`

Stores data in the cache under a normalized hash key.

**Parameters:**
- `keyData`: `string | Record<string, any>` - Cache key data
- `data`: `Buffer | string` - Data to cache

**Returns:** `Promise<boolean>` - Success status

**Features:**
- Key normalization and SHA-256 hashing
- Automatic size enforcement
- Metadata tracking
- Atomic file operations

**Example:**
```ts
await cache.set("user:123", JSON.stringify(userData));
await cache.set({ userId: 123, type: "profile" }, profileBuffer);
```

### `get(keyData): Promise<Buffer | null>`

Retrieves cached data and updates access tracking.

**Parameters:**
- `keyData`: `string | Record<string, any>` - Cache key data

**Returns:** `Promise<Buffer | null>` - Cached data or null

**Features:**
- SHA-256 key lookup
- Expiration validation
- Access count tracking
- Automatic cleanup on missing files

**Example:**
```ts
const data = await cache.get("user:123");
if (data) {
    const userData = JSON.parse(data.toString());
}
```

### `exists(keyData): Promise<boolean>`

Checks if a cache entry exists and is valid.

**Parameters:**
- `keyData`: `string | Record<string, any>` - Cache key data

**Returns:** `Promise<boolean>` - Existence status

**Example:**
```ts
const exists = await cache.exists("user:123");
if (!exists) {
    // Cache miss, fetch from source
}
```

## Search Operations

### `findKeyByValue(searchValue): Promise<string | null>`

Finds the cache key (SHA-256 hash) for a specific stored value.

**Parameters:**
- `searchValue`: `Buffer | string` - Value to search for

**Returns:** `Promise<string | null>` - Matching hash key or null

**Features:**
- Size-based candidate filtering
- Binary-safe comparison with Buffer.compare()
- Automatic expiration checking
- Orphaned metadata cleanup

**Example:**
```ts
const hashKey = await cache.findKeyByValue("search_string");
const foundKey = await cache.findKeyByValuel(Buffer.from([0x01, 0x02]));
```

### `findAllKeysByValue(searchValue): Promise<string[]>`

Finds all cache keys associated with a specific value using index-based lookup.

**Parameters:**
- `searchValue`: `Buffer | string` - Value to search for

**Returns:** `Promise<string[]>` - Array of matching hash keys

**Performance:** O(1) for indexed content, O(n) for non-indexed content

**Example:**
```ts
const allKeys = await cache.findAllKeysByValue("shared_data");
console.log(`Found ${allKeys.length} keys with same value`);
```

### `findKeysBySize(dataSize: number): Promise<string[]>`

Finds all cache keys with the specified data size using size index.

**Parameters:**
- `dataSize`: `number` - File size in bytes

**Returns:** `Promise<string[]>` - Array of cache keys with specified size

**Performance:** O(1) lookup time

**Example:**
```ts
const smallFiles = await cache.findKeysBySize(1024); // 1KB files
const largeFiles = await cache.findKeysBySize(1024 * 1024); // 1MB files
```

### `findKeysByDate(date: string): Promise<string[]>`

Finds all cache keys created on the specified date using date index.

**Parameters:**
- `date`: `string` - Date in YYYY-MM-DD format

**Returns:** `Promise<string[]>` - Array of cache keys created on specified date

**Performance:** O(1) lookup time

**Example:**
```ts
const today = new Date().toISOString().split('T')[0];
const todayFiles = await cache.findKeysByDate(today);
const specificFiles = await cache.findKeysByDate("2024-01-15");
```

### `findKeysByAccessCount(accessCount: number): Promise<string[]>`

Finds all cache keys with the specified access count using access count index.

**Parameters:**
- `accessCount`: `number` - Number of access times

**Returns:** `Promise<string[]>` - Array of cache keys with specified access count

**Performance:** O(1) lookup time

**Example:**
```ts
const hotFiles = await cache.findKeysByAccessCount(10); // Frequently accessed
const unusedFiles = await cache.findKeysByAccessCount(0); // Never accessed
```

### `getIndexStats(): IndexStats`

Returns statistics about the cache index system.

**Returns:** `IndexStats` object with:
- `contentHashIndexSize`: `number` - Number of content hash index entries
- `sizeIndexSize`: `number` - Number of size index entries
- `dateIndexSize`: `number` - Number of date index entries
- `accessCountIndexSize`: `number` - Number of access count index entries
- `totalIndexedKeys`: `number` - Total number of indexed keys

**Performance:** O(1) lookup time

**Example:**
```ts
const stats = cache.getIndexStats();
console.log(`Content hash index: ${stats.contentHashIndexSize} entries`);
console.log(`Size index: ${stats.sizeIndexSize} entries`);
```

## Management Operations

### `getStats(): Promise<StatisticData>`

Returns comprehensive cache statistics.

**Returns:** `StatisticData` object with:
- `entriesCount`: `number` - Number of cache entries
- `totalSizeMB`: `number` - Total cache size in MB
- `usagePercentage`: `number` - Cache utilization %
- `maxSizeMB`: `number` - Maximum cache size
- `oldestEntry`: `string` - ISO timestamp of oldest entry
- `newestEntry`: `string` - ISO timestamp of newest entry
- `accessCount`: `number` - Total access count

**Example:**
```ts
const stats = await cache.getStats();
console.log(`${stats.entriesCount} entries, ${stats.usagePercentage}% full`);
```

### `getHealthStatus(): Promise<HealthStatus>`

Performs health check and returns system diagnostics.

**Returns:** `HealthStatus` object with:
- `healthy`: `boolean` - Overall health status
- `issues`: `string[]` - Array of detected problems
- `metadataConsistency`: `number` - Consistency percentage (0-100)
- `filesOnDisk`: `number` - Total files on disk
- `metadataEntries`: `number` - Metadata map entries
- `orphanedFiles`: `number` - Files without metadata
- `corruptedMetadata`: `number` - Size-mismatched entries

**Example:**
```ts
const health = await cache.getHealthStatus();
if (!health.healthy) {
    console.log("Issues:", health.issues);
}
```

### `clearAll(): Promise<void>`

Removes all cached files and metadata.

**Features:**
- Complete cache directory cleanup
- Metadata map reset
- Immediate metadata save
- Safe directory recreation

**Example:**
```ts
await cache.clearAll(); // Complete cache reset
```

## Lifecycle Operations

### `initializeCache(): Promise<void>`

Initializes the cache system (called automatically on construction).

**Features:**
- Directory creation
- Metadata loading
- Consistency validation
- Old entry cleanup

**Example:**
```ts
await cache.initializeCache(); // Manual initialization
```

### `destroy(): Promise<void>`

Gracefully shuts down the cache with data preservation.

**Features:**
- Timer cleanup
- Immediate metadata save
- Resource deallocation
- Safe shutdown handling

**Example:**
```ts
await cache.destroy(); // Graceful shutdown
```

## Cleanup Operations

### `cleanupOldEntries(): Promise<void>`

Removes expired cache entries based on age limits.

**Features:**
- Date-based expiration
- File and metadata cleanup
- Automatic metadata save
- Statistical reporting

**Example:**
```ts
await cache.cleanupOldEntries(); // Manual cleanup
```

### `enforceMaxCacheSize(): Promise<void>`

Manually triggers cache size enforcement using LRU eviction.

**Features:**
- Size limit checking
- Least recently used eviction
- File and metadata cleanup
- Batch metadata saving

**Example:**
```ts
await cache.enforceMaxCacheSize(); // Manual size enforcement
```

## Internal Methods (Advanced)

### `generateCacheKey(data): string`

Generates normalized SHA-256 hash for cache key.

**Parameters:**
- `data`: `string | Record<string, any>` - Data to hash

**Returns:** `string` - 64-character SHA-256 hash

**Example:**
```ts
const hash = cache.generateCacheKey({ userId: 123 });
```

### `validateCacheKeySize(data): void`

Validates cache key size before processing.

**Parameters:**
- `data`: `any` - Data to validate

**Throws:** Error if data exceeds size limits

**Example:**
```ts
try {
    cache.validateCacheKeySize(largeData);
} catch (error) {
    console.log("Data too large:", error.message);
}
```

## Data Types

### `CacheMetadata`
```ts
interface CacheMetadata {
    key: string;           // Original cache key
    createdAt: string;     // ISO timestamp
    lastAccessed: string;  // ISO timestamp  
    dataSize: number;      // File size in bytes
    accessCount: number;   // Access count
}
```

### `StatisticData`
```ts
interface StatisticData {
    entriesCount: number;      // Number of entries
    totalSizeMB: number;       // Total size in MB
    usagePercentage: number;  // Usage percentage
    maxSizeMB: number;        // Maximum size
    oldestEntry: string;       // Oldest entry timestamp
    newestEntry: string;      // Newest entry timestamp
    accessCount: number;      // Total accesses
}
```

### `HealthStatus`
```ts
interface HealthStatus {
    healthy: boolean;              // Overall health
    issues: string[]; // Detected problems
    metadataConsistency: number;   // Consistency %
    filesOnDisk: number;          // Files on disk
    metadataEntries: number;      // Metadata entries
    orphanedFiles: number;        // Orphaned files
    corruptedMetadata: number;    // Corrupted entries
}
```

### `IndexStats`
```ts
interface IndexStats {
    contentHashIndexSize: number;    // Content hash index entries
    sizeIndexSize: number;           // Size index entries
    dateIndexSize: number;           // Date index entries
    accessCountIndexSize: number;    // Access count index entries
    totalIndexedKeys: number;        // Total indexed keys
}
```

## Error Handling

All operations include comprehensive error handling:

- **File System Errors**: Graceful degradation with cleanup
- **Corruption Detection**: Automatic validation and repair
- **Size Enforcement**: LRU eviction with batch saves
- **Process Termination**: Automatic metadata preservation

## Performance Characteristics

- **Get Operations**: O(1) hash lookup and O(1) file read
- **Set Operations**: O(1) hash generation and O(filesize) write
- **Search Operations**: O(n) metadata scan with file size filtering
- **Batch Operations**: Reduced I/O through 100ms timer batching
