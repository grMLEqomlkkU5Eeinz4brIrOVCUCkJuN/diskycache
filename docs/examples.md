# Practical Examples & Usage Patterns

This document provides practical examples, common patterns, and real-world usage scenarios for DiskyCache with flexible configuration and comprehensive indexing.

## Basic Usage Patterns

### Simple Key-Value Caching

```typescript
import { CacheService } from 'diskycache';

// Modern configuration object approach (recommended)
const cache = new CacheService({
	cacheDir: "simple-cache",
	maxCacheSize: "100MB",
	maxCacheAge: "7d",
	maxCacheKeySize: "50KB",
	fileExtension: "json"
});

// Store simple string data
await cache.set("user:123", JSON.stringify({
	id: 123,
	name: "John Doe",
	email: "john@example.com"
}));

// Retrieve and parse data
const userData = await cache.get("user:123");
if (userData) {
	const user = JSON.parse(userData.toString());
	console.log(`User: ${user.name}`);
}

// Check if key exists
const exists = await cache.exists("user:123");
console.log("User exists:", exists);

// Delete a cache entry
const deleted = await cache.deleteKey("user:123");
if (deleted) {
	console.log("User data deleted from cache");
}
```

### Flexible Configuration Examples

```typescript
// Configuration object approach with different settings
const smallCache = new CacheService({
	cacheDir: "small",
	maxCacheSize: "10MB",
	maxCacheAge: "1d",
	maxCacheKeySize: "10KB",
	fileExtension: "json",
	metadataSaveDelayMs: 25, // Faster saves
	findKeyBatchSize: 10     // Smaller batches
});

const mediumCache = new CacheService({
	cacheDir: "medium",
	maxCacheSize: "500MB",
	maxCacheAge: "7d",
	maxCacheKeySize: "100KB",
	fileExtension: "json",
	metadataSaveDelayMs: 100, // Default saves
	findKeyBatchSize: 15       // Default batches
});

const largeCache = new CacheService({
	cacheDir: "large",
	maxCacheSize: "1GB",      // Triggers warning
	maxCacheAge: "30d",
	maxCacheKeySize: "1MB",
	fileExtension: "bin",
	metadataSaveDelayMs: 200, // Less frequent saves
	findKeyBatchSize: 30,     // Larger batches
	findAllKeysBatchSize: 40,
	healthCheckConsistencyThreshold: 95 // Stricter health checks
});

// Legacy constructor approach (backward compatible)
const legacyCache = new CacheService("legacy", 100, 7, 50, "json");
```

### Object-Based Cache Keys

```typescript
// Store data using object keys (property order normalized)
await cache.set({ userId: 123, type: "profile" }, profileData);
await cache.set({ type: "profile", userId: 123 }, profileData); // Same key

// Retrieve using object key
const profile = await cache.get({ userId: 123, type: "profile" });
```

### Binary Data Caching

```typescript
// Cache binary data (images, files, etc.) with flexible configuration
const imageCache = new CacheService("image-cache", "500MB", "30d", "500KB", "bin");

// Store image buffer
await imageCache.set("image:logo", imageBuffer);

// Retrieve image
const logoData = await imageCache.get("image:logo");
if (logoData) {
    // Process image data
    fs.writeFileSync("logo.png", logoData);
}
```

## Advanced Search and Index Usage

### Content-Based Searches

```typescript
// Sub-millisecond content searches using index
const cache = new CacheService("search-cache", "200MB", "7d", "100KB", "json");

// Store multiple entries with same content
await cache.set("user:1", JSON.stringify({ name: "John", role: "admin" }));
await cache.set("user:2", JSON.stringify({ name: "Jane", role: "user" }));
await cache.set("user:3", JSON.stringify({ name: "John", role: "admin" })); // Duplicate content

// Find all keys containing specific content (O(1) with index)
const johnKeys = await cache.findAllKeysByValue(JSON.stringify({ name: "John", role: "admin" }));
console.log(`Found ${johnKeys.length} entries with John admin data`);

// Find first key with specific content
const firstJohnKey = await cache.findKeyByValue(JSON.stringify({ name: "John", role: "admin" }));
console.log(`First John admin key: ${firstJohnKey}`);
```

### Multi-Dimensional Searches

```typescript
// Size-based searches
const smallFiles = await cache.findKeysBySize("1KB");
const mediumFiles = await cache.findKeysBySize("100KB");
const largeFiles = await cache.findKeysBySize("1MB");

console.log(`Small files: ${smallFiles.length}, Medium: ${mediumFiles.length}, Large: ${largeFiles.length}`);

// Date-based searches
const today = new Date().toISOString().split('T')[0];
const todayFiles = await cache.findKeysByDate(today);
const yesterdayFiles = await cache.findKeysByDate("2024-01-14");

console.log(`Today's files: ${todayFiles.length}, Yesterday's: ${yesterdayFiles.length}`);

// Access count analysis
const hotFiles = await cache.findKeysByAccessCount(10); // Frequently accessed
const warmFiles = await cache.findKeysByAccessCount(5);  // Moderately accessed
const coldFiles = await cache.findKeysByAccessCount(1);  // Rarely accessed
const unusedFiles = await cache.findKeysByAccessCount(0); // Never accessed

console.log(`Hot: ${hotFiles.length}, Warm: ${warmFiles.length}, Cold: ${coldFiles.length}, Unused: ${unusedFiles.length}`);
```

### Index Statistics and Monitoring

```typescript
// Monitor index performance
const indexStats = cache.getIndexStats();
console.log({
    contentHashIndex: indexStats.contentHashIndexSize,
    sizeIndex: indexStats.sizeIndexSize,
    dateIndex: indexStats.dateIndexSize,
    accessCountIndex: indexStats.accessCountIndexSize,
    totalIndexedKeys: indexStats.totalIndexedKeys
});

// Get current configuration
const config = cache.getConfiguration();
console.log({
    cacheDir: config.cacheDir,
    maxCacheSize: config.maxCacheSize,
    maxCacheAge: config.maxCacheAge,
    cacheKeyLimit: config.cacheKeyLimit,
    fileExtension: config.fileExtension
});
```

## Intermediate Patterns

### API Response Caching

```typescript
class ApiCache {
    private cache: CacheService;
    
	constructor(cacheDir: string) {
		// Modern configuration object approach
		this.cache = new CacheService({
			cacheDir: cacheDir,
			maxCacheSize: "200MB",
			maxCacheAge: "1d",
			maxCacheKeySize: "100KB",
			fileExtension: "json",
			metadataSaveDelayMs: 50, // Faster saves for API responses
			findKeyBatchSize: 20      // Optimized for API lookups
		});
	}
    
    async getCachedResponse(endpoint: string, params: Record<string, any>): Promise<any> {
        const cacheKey = { endpoint, params };
        const cached = await this.cache.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached.toString());
        }
        
        // Fetch from API
        const response = await this.fetchFromApi(endpoint, params);
        
        // Cache successful responses
        if (response.success) {
            await this.cache.set(cacheKey, JSON.stringify(response.data));
        }
        
        return response.data;
    }
    
    private async fetchFromApi(endpoint: string, params: Record<string, any>) {
        // Implementation depends on HTTP client library
        // const response = await fetch(`${baseUrl}/${endpoint}`, { ... });
        // return response.json();
    }
}

// Usage
const apiCache = new ApiCache("api-cache");
const userData = await apiCache.getCachedResponse("users", { id: 123 });
```

### Session Storage Backend

```typescript
class SessionStore {
    private cache: CacheService;
    private sessionTimeout = 3600 * 24; // 24 hours
    
	constructor(sessionDir: string) {
		// High-performance session cache configuration
		this.cache = new CacheService({
			cacheDir: sessionDir,
			maxCacheSize: "50MB",
			maxCacheAge: "1d",
			maxCacheKeySize: "50KB",
			fileExtension: "session",
			metadataSaveDelayMs: 25,  // Very fast saves for sessions
			cutoffDateRecalcIntervalMs: 60000, // Check expiration every minute
			findKeyBatchSize: 10       // Smaller batches for sessions
		});
	}
    
    async getSession(sessionId: string): Promise<any> {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.cache.get(sessionKey);
        
        if (!sessionData) {
            return null;
        }
        
        return JSON.parse(sessionData.toString());
    }
    
    async setSession(sessionId: string, sessionData: any): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        await this.cache.set(sessionKey, JSON.stringify(sessionData));
    }
    
    async deleteSession(sessionId: string): Promise<void> {
        // Session will be cleaned up naturally by cache expiration
        // Or we could implement explicit deletion if needed
    }
    
    async cleanupExpiredSessions(): Promise<void> {
        await this.cache.cleanupOldEntries();
    }
}
```

### Database Query Result Caching

```typescript
class DatabaseCache {
    private cache: CacheService;
    
	constructor(cacheDir: string) {
		// Large cache configuration for database queries
		this.cache = new CacheService({
			cacheDir: cacheDir,
			maxCacheSize: "1GB",      // Large size for query results
			maxCacheAge: "7d",
			maxCacheKeySize: "200KB",
			fileExtension: "query",
			metadataSaveDelayMs: 200, // Less frequent saves for performance
			findKeyBatchSize: 25,     // Larger batches for queries
			findAllKeysBatchSize: 30,
			healthCheckConsistencyThreshold: 95 // Stricter health checks
		});
	}
    
    async cacheQuery<T>(
        query: string, 
        params: TableQueryParams, 
        fetcher: () => Promise<T>
    ): Promise<T> {
        const cacheKey = { 
            query: query.trim(), 
            params: this.normalizeParams(params) 
        };
        
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached.toString());
        }
        
        const result = await fetcher();
        await this.cache.set(cacheKey, JSON.stringify(result));
        
        return result;
    }
    
    private normalizeParams(params: TableQueryParams): TableQueryParams {
        // Sort object keys for consistent cache keys
        const sorted: Record<string, any> = {};
        Object.keys(params).sort().forEach(key => {
            sorted[key] = params[key];
        });
        return sorted;
    }
}

// Usage with database wrapper
class UserRepository {
    private cache: DatabaseCache;
    private db: Database;
    
    constructor() {
        this.cache = new DatabaseCache("db-cache");
        this.db = new Database();
    }
    
    async getUsersByRole(role: string, limit: number = 100) {
        return this.cache.cacheQuery(
            "SELECT * FROM users WHERE role = ? LIMIT ?",
            { role, limit },
            () => this.db.query("SELECT * FROM users WHERE role = ? LIMIT ?", [role, limit])
        );
    }
}
```

## Advanced Patterns

### Multi-Tenant Cache Management

```typescript
class MultiTenantCache {
    private caches: Map<string, CacheService> = new Map();
    private masterCache: CacheService;
    
    constructor(baseDir: string) {
        this.masterCache = new CacheService(baseDir, "100MB", "7d", "50KB", "meta");
    }
    
    async getTenantCache(tenantId: string): Promise<CacheService> {
        // Check if tenant cache exists
        const tenantCacheKey = `tenant_${tenantId}`;
        const cached = await this.masterCache.get(tenantCacheKey);
        
        if (!cached) {
            // Create new tenant-specific cache
            const tenantDir = `cache/${tenantId}`;
            const cache = new CacheService(tenantDir, "200MB", "7d", "100KB", "data");
            this.caches.set(tenantId, cache);
            
            // Track tenant cache info
            await this.masterCache.set(tenantCacheKey, JSON.stringify({
                tenantId,
                createdAt: new Date().toISOString(),
                cacheDir: tenantDir
            }));
            
            return cache;
        }
        
        // Return existing cache
        const cache = this.caches.get(tenantId);
        if (!cache) {
            // Recreate cache from metadata
            const tenantInfo = JSON.parse(cached.toString());
            return this.getTenantCache(tenantId);
        }
        
        return cache;
    }
    
    async setTenantData(tenantId: string, key: string, data: any): Promise<void> {
        const cache = await this.getTenantCache(tenantId);
        await cache.set(key, JSON.stringify(data));
    }
    
    async getTenantData(tenantId: string, key: string): Promise<any> {
        const cache = await this.getTenantCache(tenantId);
        const data = await cache.get(key);
        return data ? JSON.parse(data.toString()) : null;
    }
}
```

### Cache Warming & Preloading

```typescript
class CacheWarmer {
    private cache: CacheService;
    
    constructor(cache: CacheService) {
        this.cache = cache;
    }
    
    async warmCache(criticalData: Array<{key: string, data: any}>) {
        console.log("Starting cache warming...");
        
        const warmingPromises = criticalData.map(async ({ key, data }) => {
            try {
                await this.cache.set(key, JSON.stringify(data));
                console.log(`Warmed: ${key}`);
            } catch (error) {
                console.error(`Failed to warm ${key}:`, error);
            }
        });
        
        await Promise.all(warmingPromises);
        console.log("Cache warming completed");
        
        // Verify warmed data
        const stats = await this.cache.getStats();
        console.log(`Cache stats: ${stats.entriesCount} entries, ${stats.usagePercentage}% full`);
    }
    
    async preloadFromDatabase(repository: DatabaseRepository) {
        const criticalData = await repository.getCriticalData();
        await this.warmCache(criticalData.map(item => ({
            key: `db:${item.entity}:${item.id}`,
            data: item.data
        })));
    }
}
```

### Cache-Aside Pattern with Fallback

```typescript
class SmartCacheService {
    private cache: CacheService;
    
    constructor(dirName: string, maxCacheSizeMB: number, maxCacheAgeDays: number, maxKeySizeKB: number, extention: string) {
        this.cache = new CacheService(dirName, maxCacheSizeMB, maxCacheAgeDays, maxKeySizeKB, extention);
    }
    
    async getOrSet<T>(
        key: string | Record<string, any>, 
        fallbackData: () => Promise<T>
    ): Promise<T> {
        // Try cache first
        const cached = await this.cache.get(key);
        if (cached) {
            return JSON.parse(cached.toString());
        }
        
        // Cache miss - fetch from source
        try {
            const freshData = await fallbackData();
            
            // Cache the fresh data
            await this.cache.set(key, JSON.stringify(freshData));
            
            return freshData;
        } catch (error) {
            // Check if stale data exists in cache
            const staleCached = await this.cache.get(`stale:${JSON.stringify(key)}`);
            if (staleCached) {
                console.log("Using stale data due to fetch failure");
                return JSON.parse(staleCached.toString());
            }
            
            throw error;
        }
    }
    
    async refreshData<T>(
        key: string | Record<string, any>, 
        freshData: () => Promise<T>
    ): Promise<T> {
        // Store current data as stale fallback
        const currentData = await this.cache.get(key);
        if (currentData) {
            await this.cache.set(`stale:${JSON.stringify(key)}`, currentData);
        }
        
        // Fetch fresh data
        const freshDataResult = await freshData();
        await this.cache.set(key, JSON.stringify(freshDataResult));
        
        return freshDataResult;
    }
}
```

## Health Monitoring & Maintenance

### Production Health Dashboard

```typescript
class CacheHealthMonitor {
    private cache: CacheService;
    private healthThresholds = {
        minConsistency: 85,
        maxOrphanedFiles: 10,
        maxUsagePercent: 90
    };
    
    constructor(cache: CacheService) {
        this.cache = cache;
    }
    
    async getHealthReport(): Promise<HealthReport> {
        const [stats, health] = await Promise.all([
            this.cache.getStats(),
            this.cache.getHealthStatus()
        ]);
        
        return {
            healthy: health.healthy && this.checkThresholds(health, stats),
            issues: health.issues,
            alerts: this.generateAlerts(health, stats),
            recommendations: this.generateRecommendations(health, stats),
            metrics: {
                entriesCount: stats.entriesCount,
                usagePercentage: stats.usagePercentage,
                consistency: health.metadataConsistency,
                orphanedFiles: health.orphanedFiles,
                corruptedEntries: health.corruptedMetadata
            }
        };
    }
    
    private checkThresholds(health: HealthStatus, stats: StatisticData): boolean {
        return health.metadataConsistency >= this.healthThresholds.minConsistency &&
               health.orphanedFiles <= this.healthThresholds.maxOrphanedFiles &&
               stats.usagePercentage <= this.healthThresholds.maxUsagePercent;
    }
    
    async performMaintenance(): Promise<MaintenanceReport> {
        const startTime = Date.now();
        
        // Perform cleanup operations
        await this.cache.cleanupOldEntries();
        await this.cache.enforceMaxCacheSize();
        
        const endTime = Date.now();
        
        // Get post-maintenance health
        const healthReport = await this.getHealthReport();
        
        return {
            duration: endTime - startTime,
            cleanupCompleted: true,
            healthReport,
            timestamp: new Date().toISOString()
        };
    }
}

## Configuration Warnings and Best Practices

### Large Cache Size Warnings

```typescript
// This will trigger a warning
const largeCache = new CacheService("large-cache", "1GB", "7d", "1MB", "bin");
// Console output:
// ⚠️  WARNING: Cache size 1.00 GB exceeds 500MB threshold. Diskycache was made for toy projects, not for production environments.
//    Large cache sizes (1.00 GB) have not been thoroughly tested.
//    Consider using a smaller cache size or a different caching solution
//    for production environments requiring >500MB cache storage.
//    Current configuration may experience performance issues or memory problems.

// Runtime updates also trigger warnings
await largeCache.updateCacheSize("2GB");
// Same warning message will appear
```

### Recommended Cache Sizes

```typescript
// Small applications (< 100MB)
const smallAppCache = new CacheService("small", "50MB", "1d", "25KB", "json");

// Medium applications (100-500MB)
const mediumAppCache = new CacheService("medium", "200MB", "7d", "100KB", "json");

// Large applications (500MB+ - use with caution)
const largeAppCache = new CacheService("large", "1GB", "30d", "1MB", "bin");
// ⚠️ Warning: This configuration triggers warnings and is not recommended for production
```

### Configuration Validation

```typescript
function validateCacheConfig(maxSize: string, maxAge: string): boolean {
    try {
        // Test configuration parsing
        const testCache = new CacheService("test", maxSize, maxAge, "100KB", "json");
        
        // Check if configuration triggers warnings
        const config = testCache.getConfiguration();
        const sizeBytes = parseFloat(config.maxCacheSize) * 1024 * 1024; // Convert MB to bytes
        
        if (sizeBytes > 500 * 1024 * 1024) {
            console.warn("Configuration will trigger size warnings");
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Invalid configuration:", error);
        return false;
    }
}

// Usage
const isValid = validateCacheConfig("300MB", "7d"); // Returns true
const isInvalid = validateCacheConfig("1GB", "7d"); // Returns false, triggers warning
```

type HealthReport = {
    healthy: boolean;
    issues: string[];
    alerts: string[];
    recommendations: string[];
    metrics: Record<string, number>;
};

type MaintenanceReport = {
    duration: number;
    cleanupCompleted: boolean;
    healthReport: HealthReport;
    timestamp: string;
};
```

### Graceful Shutdown Integration

```typescript
class CacheApplication {
    private cache: CacheService;
    private isShuttingDown = false;
    
    constructor() {
        this.cache = new CacheService("app-cache", "500MB", "7d", "100KB", "data");
        this.setupSignals();
        this.startPeriodicTasks();
    }
    
    private setupSignals() {
        // Handle graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
        
        // Handle unexpected errors
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.gracefulShutdown(1);
        });
    }
    
    private async gracefulShutdown(exitCode = 0) {
        if (this.isShuttingDown) {
            return; // Prevent multiple shutdowns
        }
        
        this.isShuttingDown = true;
        console.log('Starting graceful shutdown...');
        
        try {
            // Save final cache state
            await this.cache.destroy();
            console.log('Cache gracefully stopped');
            
            process.exit(exitCode);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    
    private startPeriodicTasks() {
        // Periodic cleanup every hour
        setInterval(async () => {
            try {
                await this.cache.cleanupOldEntries();
                console.log('Periodic cleanup completed');
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }, 3600000); // 1 hour
        
        // Health monitoring every 5 minutes
        setInterval(async () => {
            try {
                const health = await this.cache.getHealthStatus();
                if (!health.healthy) {
                    console.warn('Cache health issues detected:', health.issues);
                }
            } catch (error) {
                console.error('Health check error:', error);
            }
        }, 300000); // 5 minutes
    }
}
```

These examples demonstrate practical usage patterns for various scenarios, from simple caching to complex multi-tenant systems. Each pattern includes error handling, best practices, and production-ready considerations.
