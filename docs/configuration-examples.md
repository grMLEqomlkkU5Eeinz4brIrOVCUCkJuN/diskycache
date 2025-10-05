# Configuration Examples

This document demonstrates the flexible configuration options available in the cache system.

## Basic Usage

```typescript
import { CacheService } from "./src/cache";

// Traditional numeric values (backward compatible)
const cache1 = new CacheService("cache_dir", 500, 7, 100, "bin");

// Flexible string units
const cache2 = new CacheService("cache_dir", "500MB", "7d", "100KB", "bin");
```

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
// Small cache for development
const devCache = new CacheService(
    "dev_cache",
    "100MB",    // Small size
    "1h",       // Short lifetime
    "50KB",     // Small key limit
    "dev"
);
```

### Production Environment
```typescript
// Large cache for production
const prodCache = new CacheService(
    "prod_cache",
    "10GB",     // Large size
    "30d",      // Long lifetime
    "1MB",      // Large key limit
    "prod"
);
```

### Testing Environment
```typescript
// Fast-expiring cache for testing
const testCache = new CacheService(
    "test_cache",
    "50MB",     // Medium size
    "5m",       // Very short lifetime
    "100KB",    // Standard key limit
    "test"
);
```

### High-Performance Environment
```typescript
// Maximum performance cache
const perfCache = new CacheService(
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

1. **Use descriptive units**: "500MB" is clearer than "500"
2. **Choose appropriate units**: Use "GB" for large sizes, "KB" for small sizes
3. **Be consistent**: Use the same unit type throughout your application
4. **Validate configurations**: Check for errors in configuration parsing
5. **Monitor usage**: Use `getConfiguration()` to verify settings
6. **Update dynamically**: Use update methods for runtime configuration changes
