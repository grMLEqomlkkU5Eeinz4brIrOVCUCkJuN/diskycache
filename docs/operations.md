# DiskyCache Operations

This document provides detailed sequence diagrams and operation flows for DiskyCache functionality.

## Core Operations Overview

The cache system operates through several key workflows that handle data storage, retrieval, cleanup, and health monitoring.

## Primary Operations

### Set Operation Flow

```mermaid
sequenceDiagram
    participant Client
    participant CacheService
    participant HashManager
    participant MetadataManager
    participant FileManager
    participant BatchScheduler

    Client->>CacheService: set(keyData, data)
    CacheService->>HashManager: normalizeForHashing(keyData)
    HashManager->>CacheService: normalized object
    CacheService->>HashManager: generateCacheKey(normalized)
    HashManager->>CacheService: sha256Hash
    
    CacheService->>FileManager: writeFile(hash.extention, data)
    FileManager->>CacheService: success/failure
    
    CacheService->>MetadataManager: updateMetadata(hash, metadata)
    MetadataManager->>BatchScheduler: scheduleMetadataSave()
    BatchScheduler->>BatchScheduler: setTimeout(100ms)
    
    CacheService->>Client: boolean success
```

### Get Operation Flow

```mermaid
sequenceDiagram
    participant Client
    participant CacheService
    participant HashManager
    participant MetadataManager
    participant FileManager
    participant BatchScheduler

    Client->>CacheService: get(keyData)
    CacheService->>HashManager: generateCacheKey(keyData)
    HashManager->>CacheService: sha256Hash
    
    CacheService->>MetadataManager: getMetadata(hash)
    MetadataManager->>CacheService: metadata/null
    
    alt metadata exists && not expired
        CacheService->>FileManager: readFile(hash.extention)
        FileManager->>CacheService: fileData/null
        
        alt file exists
            CacheService->>MetadataManager: updateAccess(metadata)
            MetadataManager->>BatchScheduler: scheduleMetadataSave()
            CacheService->>Client: Buffer(fileData)
        else file missing
            CacheService->>MetadataManager: removeMetadata(hash)
            CacheService->>Client: null
        end
    else metadata missing or expired
        CacheService->>Client: null
    end
```

### Health Check Operation Flow

```mermaid
sequenceDiagram
    participant Client
    participant CacheService
    participant HealthMonitor
    participant FileManager
    participant MetadataManager

    Client->>CacheService: getHealthStatus()
    CacheService->>HealthMonitor: validateConsistency()
    
    HealthMonitor->>FileManager: readdir(cacheDir)
    FileManager->>HealthMonitor: files[]
    
    HealthMonitor->>MetadataManager: getMetadata()
    MetadataManager->>HealthMonitor: metadataMap
    
    loop for each metadata entry
        HealthMonitor->>FileManager: stat(filePath)
        FileManager->>HealthMonitor: fileStats
        HealthMonitor->>HealthMonitor: compare sizes
        
        alt size mismatch
            HealthMonitor->>HealthMonitor: addIssue("size mismatch")
        end
    end
    
    loop for each file on disk
        HealthMonitor->>MetadataManager: hasMetadata(hash)
        MetadataManager->>HealthMonitor: boolean
        
        alt no metadata
            HealthMonitor->>HealthMonitor: incrementOrphanedCount()
        end
    end
    
    HealthMonitor->>CacheService: HealthStatus
    CacheService->>Client: HealthStatus object
```

## Background Operations

### Cleanup Operation Flow

```mermaid
sequenceDiagram
    participant CleanupTimer
    participant CacheService
    participant DateManager
    participant MetadataManager
    participant FileManager
    participant BatchScheduler

    CleanupTimer->>CacheService: cleanupOldEntries()
    CacheService->>DateManager: getCutoffDate()
    DateManager->>CacheService: cutoffTimestamp
    
    CacheService->>MetadataManager: getMetadataEntries()
    MetadataManager->>CacheService: metadataMap
    
    loop for each metadata entry
        CacheService->>CacheService: checkExpiration(metadata, cutoffDate)
        
        alt expired
            CacheService->>FileManager: removeFile(filePath)
            FileManager->>CacheService: success/failure
            CacheService->>MetadataManager: removeMetadata(hash)
        end
    end
    
    CacheService->>BatchScheduler: scheduleMetadataSave(true)
    BatchScheduler->>MetadataManager: saveMetadata(true)
    MetadataManager->>CacheService: success
```

### Batch Metadata Save Flow

```mermaid
sequenceDiagram
    participant Operations
    participant BatchScheduler
    participant MetadataManager
    participant FileManager
    participant TempFileManager

    Operations->>BatchScheduler: scheduleMetadataSave()
    
    alt immediate save
        BatchScheduler->>MetadataManager: saveMetadata(true)
    else batch save
        BatchScheduler->>BatchScheduler: setTimeout(100ms)
        Note over BatchScheduler: Wait for batch period
        
        BatchScheduler->>MetadataManager: saveMetadata(false)
    end
    
    MetadataManager->>FileManager: serializeMetadata()
    FileManager->>MetadataManager: metadataJSON
    
    MetadataManager->>TempFileManager: writeFile(tempFile, json)
    TempFileManager->>MetadataManager: success/failure
    
    MetadataManager->>FileManager: rename(tempFile, metadataFile)
    FileManager->>MetadataManager: success/failure
    
    MetadataManager->>BatchScheduler: completion
```

## Error Handling Flows

### Graceful Shutdown Flow

```mermaid
sequenceDiagram
    participant Process
    participant SignalHandler
    participant CacheService
    participant MetadataManager
    participant FileManager

    Process->>SignalHandler: SIGINT/SIGTERM/Exception
    SignalHandler->>CacheService: destroy()
    
    CacheService->>BatchScheduler: clearMetadataTimer()
    CacheService->>MetadataManager: saveMetadata(true)
    
    MetadataManager->>FileManager: serializeMetadata()
    FileManager->>MetadataManager: metadataJSON
    
    MetadataManager->>FileManager: atomicWrite(metadataFile)
    FileManager->>MetadataManager: success/failure
    
    MetadataManager->>CacheService: completion
    CacheService->>SignalHandler: ready for exit
    SignalHandler->>Process: process.exit(code)
```

### Error Recovery Flow

```mermaid
sequenceDiagram
    participant CacheService
    participant HealthMonitor
    participant MetadataManager
    participant FileManager
    participant TempFileManager

    CacheService->>HealthMonitor: validateAndCleanMetadata()
    
    loop for each metadata entry
        HealthMonitor->>FileManager: stat(filePath)
        
        alt file missing
            HealthMonitor->>MetadataManager: removeMetadata(hash)
            HealthMonitor->>HealthMonitor: incrementOrphanedCount()
        else file exists
            FileManager->>HealthMonitor: fileStats
            
            alt size mismatch
                HealthMonitor->>HealthMonitor: updateMetadataSize()
                HealthMonitor->>HealthMonitor: incrementCorruptedCount()
            end
        end
    end
    
    loop for each file on disk
        HealthMonitor->>MetadataManager: hasMetadata(hash)
        
        alt no metadata
            HealthMonitor->>FileManager: removeFile(filePath)
            HealthMonitor->>HealthMonitor: incrementOrphanedCount()
        end
    end
    
    HealthMonitor->>MetadataManager: saveMetadata(true)
    MetadataManager->>TempFileManager: cleanupTempFiles()
    
    HealthMonitor->>CacheService: cleanup complete
```

## Advanced Operations

### Search by Value Flow

```mermaid
sequenceDiagram
    participant Client
    participant CacheService
    participant DataProcessor
    participant MetadataManager
    participant FileManager

    Client->>CacheService: findKeyByValue(searchValue)
    CacheService->>DataProcessor: bufferize(searchValue)
    DataProcessor->>CacheService: searchBuffer
    
    CacheService->>DateManager: getCutoffDate()
    DateManager->>CacheService: cutoffDate
    
    CacheService->>MetadataManager: filterCandidates(searchBuffer.length, cutoffDate)
    MetadataManager->>CacheService: candidateHashes[]
    
    loop for each candidate hash
        CacheService->>FileManager: readFile(hash.extention)
        FileManager->>CacheService: fileData/null
        
        alt file exists && size matches
            CacheService->>CacheService: bufferCompare(fileData, searchBuffer)
            
            alt data matches
                CacheService->>Client: return hash
                Note over CacheService,Client: Search successful
            end
        end
    end
    
    CacheService->>Client: return null
    Note over CacheService,Client: No match found
```

### Size Enforcement Flow

```mermaid
sequenceDiagram
    participant CacheService
    participant MetadataManager
    participant LRUManager
    participant FileManager
    participant BatchScheduler

    CacheService->>MetadataManager: getCurrentCacheSize()
    MetadataManager->>CacheService: currentSizeBytes
    
    alt cache size exceeds limit
        CacheService->>LRUManager: sortByAccess()
        LRUManager->>CacheService: sortedEntries[]
        
        loop while size > limit
            CacheService->>LRUManager: getLeastRecentlyUsed()
            LRUManager->>CacheService: lruEntry
            
            CacheService->>FileManager: removeFile(lruEntry.path)
            FileManager->>CacheService: success/failure
            
            CacheService->>MetadataManager: removeMetadata(lruEntry.hash)
        end
        
        CacheService->>BatchScheduler: scheduleMetadataSave()
    end
```

These sequence diagrams illustrate the complex interactions between components during cache operations, showing how the system maintains consistency, handles errors gracefully, and optimizes performance through batching and background operations.
