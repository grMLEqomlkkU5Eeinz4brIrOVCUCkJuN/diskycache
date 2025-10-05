# DiskyCache Architecture

This document explains the system architecture, design principles, and component interactions of the DiskyCache library with comprehensive indexing and flexible configuration.

## System Overview

DiskyCache is a high-performance disk-backed caching system designed for Node.js applications. It features comprehensive indexing for sub-millisecond searches, flexible configuration with human-readable units, and automatic cleanup with data protection mechanisms.

### Core Design Principles

1. **Persistence**: Data survives application restarts
2. **Reliability**: Atomic operations prevent data corruption
3. **Performance**: Sub-millisecond searches with comprehensive indexing
4. **Flexibility**: Human-readable configuration with runtime updates
5. **Maintainability**: Consistent cleanup and health monitoring
6. **Scalability**: Configurable size limits with production warnings
7. **Efficiency**: O(1) lookups for indexed content and metadata

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DiskyCache System                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Core Components                                                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  ┌─────────┐  │
│  │ Hash    │  │ Metadata │  │ File    │  │ Health     │  │ Config  │  │
│  │ Manager │  │ Manager  │  │ Manager │  │ Monitor    │  │ Parser  │  │
│  └─────────┘  └──────────┘  └─────────┘  └─────────────┘  └─────────┘  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                    Index System                                     │ │
│ │ ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐ │ │
│ │ │ Content     │ │ Size    │ │ Date    │ │ Access Count            │ │ │
│ │ │ Hash Index  │ │ Index   │ │ Index   │ │ Index                   │ │ │
│ │ │ Map<hash,   │ │ Map<    │ │ Map<    │ │ Map<count,              │ │ │
│ │ │ Set<keys>>  │ │ size,   │ │ date,   │ │ Set<keys>>              │ │ │
│ │ │             │ │ Set<    │ │ Set<    │ │                         │ │ │
│ │ │             │ │ keys>>  │ │ keys>>  │ │                         │ │ │
│ │ └─────────────┘ └─────────┘ └─────────┘ └─────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                Metadata Map                                         │ │
│ │ Key: SHA-256 Hash                                                   │ │
│ │ Value: { createdAt, lastAccessed, dataSize, accessCount }           │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       File System Layer                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Cache Directory                                                        │
│  ├─ metadata.json           # Metadata persistence file               │
│  ├─ {hash}.{ext}           # Data files                               │
│  └─ metadata.json.tmp.*    # Temporary metadata files                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Hash Manager
- **Key Normalization**: Converts objects to consistent string representations
- **SHA-256 Generation**: Creates collision-resistant cache keys
- **Content Hashing**: Generates SHA-256 hashes for content indexing

### Metadata Manager
- **In-Memory Storage**: Maintains metadata map for fast lookups
- **Persistence**: Batched saves to prevent I/O bottlenecks
- **Atomic Operations**: Temporary files prevent corruption
- **Index Maintenance**: Updates all indexes during metadata changes

### File Manager
- **Data Persistence**: Stores actual cache data on disk
- **Extension Handling**: Supports configurable file extensions
- **Size Validation**: Enforces cache size limits
- **Content Hash Caching**: Reduces file I/O for repeated searches

### Health Monitor
- **Consistency Checks**: Validates metadata against file system
- **Orphan Detection**: Identifies files without metadata
- **Corruption Detection**: Validates file sizes and integrity
- **Issue Reporting**: Provides detailed diagnostics

### Configuration Parser
- **Unit Parsing**: Supports human-readable size and time units
- **Validation**: Provides clear error messages for invalid configurations
- **Fallback Handling**: Uses defaults with warnings for invalid input
- **Runtime Updates**: Enables dynamic configuration changes

### Index System
- **Content Hash Index**: O(1) content-based lookups
- **Size Index**: O(1) size-based queries
- **Date Index**: O(1) date-based queries
- **Access Count Index**: O(1) usage pattern analysis
- **Automatic Building**: Indexes built during operations
- **Parallel Processing**: Non-indexed searches use parallel file reading

## Index System Architecture

### Content Hash Index
```
Map<string, Set<string>>
├─ Key: SHA-256 hash of file content
└─ Value: Set of cache keys containing that content

Example:
"a1b2c3d4..." → Set(["key1", "key2", "key3"])
"e5f6g7h8..." → Set(["key4", "key5"])
```

### Size Index
```
Map<number, Set<string>>
├─ Key: File size in bytes
└─ Value: Set of cache keys with that size

Example:
1024 → Set(["small1", "small2"])
1048576 → Set(["large1", "large2"])
```

### Date Index
```
Map<string, Set<string>>
├─ Key: Creation date (YYYY-MM-DD)
└─ Value: Set of cache keys created on that date

Example:
"2024-01-15" → Set(["today1", "today2"])
"2024-01-14" → Set(["yesterday1"])
```

### Access Count Index
```
Map<number, Set<string>>
├─ Key: Number of access times
└─ Value: Set of cache keys accessed that many times

Example:
0 → Set(["unused1", "unused2"])
10 → Set(["hot1", "hot2"])
```

## Configuration System Architecture

### Flexible Unit Parsing
```
ConfigParser
├─ parseSize(value): number
│   ├─ Supports: B, KB, MB, GB, TB
│   ├─ Case insensitive
│   └─ Returns bytes
├─ parseTime(value): number
│   ├─ Supports: ms, s, m, h, d, w
│   ├─ Case insensitive
│   └─ Returns milliseconds
└─ formatBytes(bytes): string
    └─ Human-readable size formatting
```

### Runtime Configuration Updates
```
CacheService
├─ updateCacheSize(newSize): Promise<boolean>
│   ├─ Parses new size with ConfigParser
│   ├─ Triggers warning if > 500MB
│   └─ Enforces new size limit
├─ updateCacheAge(newAge): boolean
│   ├─ Parses new age with ConfigParser
│   └─ Updates internal age limit
└─ updateCacheKeyLimit(newLimit): boolean
    ├─ Parses new limit with ConfigParser
    └─ Updates internal key limit
```

## Data Flow Architecture

### Cache Set Operation
```
1. Input Validation
   ├─ Parse configuration with ConfigParser
   ├─ Validate key size limits
   └─ Check cache size constraints

2. Content Processing
   ├─ Generate SHA-256 hash of content
   ├─ Calculate content hash for indexing
   └─ Determine file size

3. Index Updates
   ├─ Remove old entry from all indexes
   ├─ Add new entry to content hash index
   ├─ Add new entry to size index
   ├─ Add new entry to date index
   └─ Add new entry to access count index

4. File Operations
   ├─ Write data to disk
   ├─ Update metadata map
   └─ Schedule metadata persistence
```

### Content Search Operation
```
1. Index Check
   ├─ Calculate content hash
   ├─ Check content hash index
   └─ Return O(1) result if found

2. Fallback Search (if not indexed)
   ├─ Parallel file reading (15-20 files)
   ├─ Content hash calculation
   ├─ Add to content hash index
   └─ Return search results

3. Index Building
   ├─ Process files in batches
   ├─ Cache content hashes
   └─ Update indexes for future searches
```
- **Data Retrieval**: Reads files with existence validation
- **Size Enforcement**: LRU-based cleanup when limits exceeded
- **Access Tracking**: Updates metadata on read operations

### Health Monitor
- **Consistency Checks**: Validates file-metadata alignment
- **Orphan Detection**: Finds files without metadata or vice versa
- **Performance Metrics**: Tracks I/O efficiency and cache health
- **Diagnostics**: Provides detailed system status

## Data Structures

### CacheMetadata
```typescript
interface CacheMetadata {
    key: string;              // Original cache key (for reference)
    createdAt: string;        // ISO timestamp
    lastAccessed: string;     // ISO timestamp
    dataSize: number;         // File size in bytes
    accessCount: number;      // Number of accesses
}
```

### HealthStatus
```typescript
interface HealthStatus {
    healthy: boolean;          // Overall system health
    issues: string[];          // Array of detected problems
    metadataConsistency: number; // Percentage consistency (0-100)
    filesOnDisk: number;       // Total cached files
    metadataEntries: number;   // Metadata map entries
    orphanedFiles: number;     // Files without metadata
    corruptedMetadata: number; // Metadata with mismatched sizes
}
```

## Data Flow Patterns

### Write Operation Flow
```
Client Request → Key Normalization → SHA-256 Hash → Metadata Update → File Write → Batch Save
```

### Read Operation Flow
```
Client Request → SHA-256 Hash → Metadata Lookup → File Existence Check → File Read → Metadata Update → Batch Save
```

### Cleanup Operation Flow
```
Timer Trigger → Expiration Check → Orphan Detection → File Deletion → Metadata Cleanup → Batch Save
```

## Memory Management

### Metadata Storage
- **Primary**: In-memory Map for O(1) lookups
- **Secondary**: JSON file for persistence
- **Strategy**: Batched saves every 100ms to reduce I/O

### Memory Efficiency
- **Key Storage**: Only SHA-256 hashes stored in memory
- **Metadata Size**: Minimal per-entry overhead (~200 bytes)
- **Cleanup**: Automatic removal of expired/orphaned entries

## Error Handling Strategy

### Graceful Degradation
- **File Errors**: Continue operation, remove invalid metadata
- **Corruption**: Automatic detection and cleanup
- **Disk Full**: LRU eviction and size enforcement
- **Permissions**: Clear error messages and cleanup attempts

### Recovery Mechanisms
- **Startup Validation**: Consistency checks on initialization
- **Runtime Cleanup**: Continuous orphan detection and removal
- **Emergency Saves**: Immediate persistence on graceful shutdown
- **Process Signals**: Automatic metadata save on termination

## Performance Characteristics

### Scalability
- **Linear Growth**: O(n) metadata operations
- **Hash-Based Lookups**: O(1) key resolution
- **Batch Operations**: Reduced I/O frequency
- **LRU Eviction**: Automatic size management

### Resource Usage
- **Disk I/O**: Minimal through batching
- **Memory Usage**: Proportional to active cache entries
- **CPU Overhead**: Primarily hash generation and JSON serialization
- **Network Impact**: None (file system based)

This architecture ensures reliable, efficient, and maintainable disk-backed caching for Node.js applications.
