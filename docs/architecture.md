# DiskyCache Architecture

This document explains the system architecture, design principles, and component interactions of the DiskyCache library.

## System Overview

DiskyCache is a disk-backed caching system designed for Node.js applications. It provides persistent caching with automatic cleanup, metadata tracking, and data protection mechanisms.

### Core Design Principles

1. **Persistence**: Data survives application restarts
2. **Reliability**: Atomic operations prevent data corruption
3. **Performance**: Efficient I/O operations with batching
4. **Maintainability**: Consistent cleanup and health monitoring
5. **Scalability**: Configurable size limits and LRU eviction

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DiskyCache System                      │
├─────────────────────────────────────────────────────────────┤
│  Core Components                                           │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐    │
│  │ Hash    │  │ Metadata │  │ File    │  │ Health     │    │
│  │ Manager │  │ Manager  │  │ Manager │  │ Monitor    │    │
│  └─────────┘  └──────────┘  └─────────┘  └─────────────┘    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                Metadata Map                             │ │
│ │ Key: SHA-256 Hash                                       │ │
│ │ Value: { createdAt, lastAccessed, dataSize, accessCount } │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   File System Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Cache Directory                                            │
│  ├─ metadata.json           # Metadata persistence file    │
│  ├─ {hash}.{ext}           # Data files                   │
│  └─ metadata.json.tmp.*    # Temporary metadata files     │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Hash Manager
- **Key Normalization**: Converts objects to consistent string representations
- **SHA-256 Generation**: Creates collision-resistant cache keys
- **Size Validation**: Ensures keys don't exceed limits

### Metadata Manager
- **Memory Map**: In-memory HashMap for fast lookups
- **Persistence**: JSON serialization for disk storage
- **Batching**: Timer-based saves to reduce I/O operations
- **Atomic Writes**: Temporary files prevent corruption

### File Manager
- **Data Storage**: Writes Buffers/strings to disk
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
