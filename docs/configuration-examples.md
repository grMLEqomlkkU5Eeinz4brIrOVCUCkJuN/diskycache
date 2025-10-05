# Configuration Examples

This document demonstrates the flexible configuration options available in the cache system, including the new configuration object approach and legacy constructor support.

## Configuration Object Approach (Recommended)

The modern configuration object approach provides comprehensive control over all cache settings with sensible defaults:

```typescript
import { CacheService } from "./src/cache";

// Minimal configuration (uses defaults for unspecified properties)
const cache1 = new CacheService({
	cacheDir: "my-cache",
	maxCacheSize: "1GB",
	maxCacheAge: "30d"
});

// Full custom configuration
const cache2 = new CacheService({
	cacheDir: "production-cache",
	maxCacheSize: "2GB",
	maxCacheAge: "7d",
	maxCacheKeySize: "1MB",
	fileExtension: "json",
	metadataSaveDelayMs: 50,
	cutoffDateRecalcIntervalMs: 60000, // 1 minute
	floatingPointPrecision: 15,
	healthCheckConsistencyThreshold: 95,
	largeCacheWarningThresholdBytes: 100 * 1024 * 1024, // 100MB
	processMaxListenersIncrement: 5,
	findKeyBatchSize: 10,
	findAllKeysBatchSize: 15,
	jsonIndentSpaces: 4,
	sizeFormatDecimalPlaces: 3,
	timeFormatDecimalPlaces: 3,
	statsDecimalPlaces: 15
});

// High-performance configuration
const cache3 = new CacheService({
	cacheDir: "fast-cache",
	maxCacheSize: "500MB",
	maxCacheAge: "1d",
	metadataSaveDelayMs: 25, // Faster saves
	findKeyBatchSize: 25, // Larger batches
	findAllKeysBatchSize: 30
});
```

## Legacy Constructor (Backward Compatible)

The traditional constructor still works for existing code:

```typescript
// Traditional numeric values (backward compatible)
const cache1 = new CacheService("cache_dir", 500, 7, 100, "bin");

// Flexible string units
const cache2 = new CacheService("cache_dir", "500MB", "7d", "100KB", "bin");
```

## Configuration Object Properties

The configuration object supports all internal cache settings with sensible defaults:

### Core Settings
- `cacheDir`: Cache directory path (default: "cache")
- `maxCacheSize`: Maximum cache size (default: "500MB")
- `maxCacheAge`: Maximum age before expiration (default: "7d")
- `maxCacheKeySize`: Maximum key size (default: "100KB")
- `fileExtension`: File extension for cached files (default: "cache")

### Performance Settings
- `metadataSaveDelayMs`: Batch metadata save delay (default: 100ms)
- `cutoffDateRecalcIntervalMs`: Cutoff date recalculation interval (default: 5 minutes)
- `findKeyBatchSize`: Batch size for findKeyByValue operations (default: 15)
- `findAllKeysBatchSize`: Batch size for findAllKeysByValue operations (default: 20)

### Precision Settings
- `floatingPointPrecision`: Hash normalization precision (default: 10)
- `sizeFormatDecimalPlaces`: Size formatting precision (default: 2)
- `timeFormatDecimalPlaces`: Time formatting precision (default: 2)
- `statsDecimalPlaces`: Statistics calculation precision (default: 10)

### System Settings
- `healthCheckConsistencyThreshold`: Health check threshold percentage (default: 90%)
- `largeCacheWarningThresholdBytes`: Large cache warning threshold (default: 500MB)
- `processMaxListenersIncrement`: Process listener increment (default: 10)
- `jsonIndentSpaces`: JSON formatting indentation (default: 2)

## Size Configuration

The cache size parameter supports multiple units:

### Supported Size Units
- **B**: Bytes
- **KB**: Kilobytes (1024 bytes)
- **MB**: Megabytes (1024 KB)
- **GB**: Gigabytes (1024 MB)
- **TB**: Terabytes (1024 GB)

### Examples
```typescript
// Different ways to specify 500MB
new CacheService("dir", "500MB", "7d", "100KB", "bin");
new CacheService("dir", "500 MB", "7d", "100KB", "bin");  // Space optional
new CacheService("dir", "0.5GB", "7d", "100KB", "bin");   // Fractional values
new CacheService("dir", "512000KB", "7d", "100KB", "bin"); // Different unit

// Large cache sizes
new CacheService("dir", "2GB", "7d", "100KB", "bin");
new CacheService("dir", "1TB", "7d", "100KB", "bin");

// Small cache sizes
new CacheService("dir", "10MB", "7d", "100KB", "bin");
new CacheService("dir", "1024KB", "7d", "100KB", "bin");
```

## Time Configuration

The cache age parameter supports multiple time units:

### Supported Time Units
- **ms**: Milliseconds
- **s**: Seconds
- **m**: Minutes
- **h**: Hours
- **d**: Days
- **w**: Weeks

### Examples
```typescript
// Different ways to specify 7 days
new CacheService("dir", "500MB", "7d", "100KB", "bin");
new CacheService("dir", "500MB", "7 days", "100KB", "bin");  // Space optional
new CacheService("dir", "500MB", "168h", "100KB", "bin");    // Hours
new CacheService("dir", "500MB", "604800s", "100KB", "bin"); // Seconds
new CacheService("dir", "500MB", "1w", "100KB", "bin");      // Weeks

// Short-lived cache
new CacheService("dir", "500MB", "1h", "100KB", "bin");
new CacheService("dir", "500MB", "30m", "100KB", "bin");

// Long-lived cache
new CacheService("dir", "500MB", "30d", "100KB", "bin");
new CacheService("dir", "500MB", "4w", "100KB", "bin");
```

## Cache Key Limit Configuration

The cache key limit supports the same size units as cache size:

### Examples
```typescript
// Different ways to specify 100KB key limit
new CacheService("dir", "500MB", "7d", "100KB", "bin");
new CacheService("dir", "500MB", "7d", "100 KB", "bin");  // Space optional
new CacheService("dir", "500MB", "7d", "102400B", "bin"); // Bytes
new CacheService("dir", "500MB", "7d", "0.1MB", "bin");   // Fractional MB

// Large key limits
new CacheService("dir", "500MB", "7d", "1MB", "bin");
new CacheService("dir", "500MB", "7d", "2MB", "bin");

// Small key limits
new CacheService("dir", "500MB", "7d", "10KB", "bin");
new CacheService("dir", "500MB", "7d", "512B", "bin");
```

## Runtime Configuration Updates

You can update cache configuration at runtime:

```typescript
const cache = new CacheService("dir", "500MB", "7d", "100KB", "bin");

// Update cache size
await cache.updateCacheSize("1GB");
await cache.updateCacheSize("2TB");

// Update cache age
cache.updateCacheAge("24h");
cache.updateCacheAge("1w");
cache.updateCacheAge("30d");

// Update key limit
cache.updateCacheKeyLimit("1MB");
cache.updateCacheKeyLimit("500KB");

// Get current configuration
const config = cache.getConfiguration();
console.log(`Current size: ${config.maxCacheSize}`);
console.log(`Current age: ${config.maxCacheAge}`);
console.log(`Current key limit: ${config.cacheKeyLimit}`);
```

## Configuration Validation

The parser provides clear error messages for invalid configurations:

```typescript
try {
    new CacheService("dir", "500INVALID", "7d", "100KB", "bin");
} catch (error) {
    console.error(error.message);
    // "Unsupported size unit: INVALID. Supported units: B, KB, MB, GB, TB"
}

try {
    new CacheService("dir", "500MB", "7INVALID", "100KB", "bin");
} catch (error) {
    console.error(error.message);
    // "Unsupported time unit: INVALID. Supported units: ms, s, m, h, d, w"
}
```

## Practical Examples

### Development Environment
```typescript
// Configuration object approach
const devCache = new CacheService({
	cacheDir: "dev_cache",
	maxCacheSize: "100MB",    // Small size
	maxCacheAge: "1h",        // Short lifetime
	maxCacheKeySize: "50KB",  // Small key limit
	fileExtension: "dev",
	metadataSaveDelayMs: 25,  // Faster saves for development
	findKeyBatchSize: 10      // Smaller batches
});

// Legacy approach
const devCacheLegacy = new CacheService(
	"dev_cache",
	"100MB",    // Small size
	"1h",       // Short lifetime
	"50KB",     // Small key limit
	"dev"
);
```

### Production Environment
```typescript
// Configuration object approach
const prodCache = new CacheService({
	cacheDir: "prod_cache",
	maxCacheSize: "10GB",     // Large size
	maxCacheAge: "30d",       // Long lifetime
	maxCacheKeySize: "1MB",   // Large key limit
	fileExtension: "prod",
	metadataSaveDelayMs: 200, // Less frequent saves for performance
	findKeyBatchSize: 30,     // Larger batches
	findAllKeysBatchSize: 40,
	healthCheckConsistencyThreshold: 95, // Stricter health checks
	largeCacheWarningThresholdBytes: 2 * 1024 * 1024 * 1024 // 2GB warning
});

// Legacy approach
const prodCacheLegacy = new CacheService(
	"prod_cache",
	"10GB",     // Large size
	"30d",      // Long lifetime
	"1MB",      // Large key limit
	"prod"
);
```

### Testing Environment
```typescript
// Configuration object approach
const testCache = new CacheService({
	cacheDir: "test_cache",
	maxCacheSize: "50MB",     // Medium size
	maxCacheAge: "5m",        // Very short lifetime
	maxCacheKeySize: "100KB", // Standard key limit
	fileExtension: "test",
	metadataSaveDelayMs: 10, // Very fast saves for testing
	cutoffDateRecalcIntervalMs: 30000, // Check expiration every 30 seconds
	findKeyBatchSize: 5      // Small batches for testing
});

// Legacy approach
const testCacheLegacy = new CacheService(
	"test_cache",
	"50MB",     // Medium size
	"5m",       // Very short lifetime
	"100KB",    // Standard key limit
	"test"
);
```

### High-Performance Environment
```typescript
// Configuration object approach
const perfCache = new CacheService({
	cacheDir: "perf_cache",
	maxCacheSize: "1TB",      // Maximum size - WARNING: Will trigger size warning
	maxCacheAge: "1w",         // Long lifetime
	maxCacheKeySize: "2MB",    // Large key limit
	fileExtension: "perf",
	metadataSaveDelayMs: 50,  // Balanced save frequency
	findKeyBatchSize: 50,     // Large batches for throughput
	findAllKeysBatchSize: 60,
	cutoffDateRecalcIntervalMs: 120000, // Check expiration every 2 minutes
	healthCheckConsistencyThreshold: 98, // Very strict health checks
	largeCacheWarningThresholdBytes: 5 * 1024 * 1024 * 1024 // 5GB warning
});

// Legacy approach
const perfCacheLegacy = new CacheService(
	"perf_cache",
	"1TB",      // Maximum size - WARNING: Will trigger size warning
	"1w",       // Long lifetime
	"2MB",      // Large key limit
	"perf"
);
```

**Note**: Cache sizes above 500MB will trigger a warning message as these configurations have not been thoroughly tested.

## Size Warnings

Cache sizes above 500MB will trigger warning messages:

```typescript
// This will trigger warnings
const largeCache = new CacheService("dir", "1GB", "7d", "100KB", "bin");

// Console output:
// ⚠️  WARNING: Cache size 1.00 GB exceeds 500MB threshold.
//    Large cache sizes (1.00 GB) have not been thoroughly tested.
//    Consider using a smaller cache size or a different caching solution
//    for production environments requiring >500MB cache storage.
//    Current configuration may experience performance issues or memory problems.
```

**Recommendations for large caches:**
- Test thoroughly in your specific environment
- Monitor memory usage and performance
- Consider alternative caching solutions for very large datasets
- Use smaller cache sizes for production unless specifically tested

## Error Handling

Invalid configurations fall back to defaults with warnings:

```typescript
// Invalid size - falls back to 500MB
const cache1 = new CacheService("dir", "invalid", "7d", "100KB", "bin");
// Warning: "Invalid cache size format: invalid, using default 500MB"

// Invalid age - falls back to 7 days
const cache2 = new CacheService("dir", "500MB", "invalid", "100KB", "bin");
// Warning: "Invalid cache age format: invalid, using default 7 days"

// Invalid key limit - falls back to 100KB
const cache3 = new CacheService("dir", "500MB", "7d", "invalid", "bin");
// Warning: "Invalid cache key limit format: invalid, using default 100KB"
```

## Best Practices

### Configuration Object Approach
1. **Use configuration objects**: Prefer the modern configuration object approach for new projects
2. **Specify only what you need**: Use minimal configuration and let defaults handle the rest
3. **Group related settings**: Organize configuration by purpose (core, performance, precision, system)
4. **Document custom settings**: Add comments for non-default values explaining why they're needed
5. **Use meaningful names**: Choose descriptive cache directory names and file extensions

### Legacy Constructor Approach
1. **Use descriptive units**: "500MB" is clearer than "500"
2. **Choose appropriate units**: Use "GB" for large sizes, "KB" for small sizes
3. **Be consistent**: Use the same unit type throughout your application
4. **Validate configurations**: Check for errors in configuration parsing
5. **Monitor usage**: Use `getConfiguration()` to verify settings
6. **Update dynamically**: Use update methods for runtime configuration changes

### General Recommendations
1. **Start with defaults**: Begin with default configuration and tune as needed
2. **Test thoroughly**: Especially for large cache sizes (>500MB)
3. **Monitor performance**: Use health checks and statistics to monitor cache behavior
4. **Plan for growth**: Consider cache size requirements as your application scales
5. **Use appropriate lifetimes**: Balance cache hit rates with memory usage
6. **Handle errors gracefully**: Implement proper error handling for cache operations
