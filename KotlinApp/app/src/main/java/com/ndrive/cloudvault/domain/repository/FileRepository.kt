package com.ndrive.cloudvault.domain.repository

import com.ndrive.cloudvault.domain.model.DriveFile

interface FileRepository {
        suspend fun getRecentFiles(limit: Int = 50): Result<List<DriveFile>>    
        suspend fun getStarredFiles(limit: Int = 50): Result<List<DriveFile>>   
        suspend fun getRootFiles(limit: Int = 100): Result<List<DriveFile>>
        suspend fun getFilesByFolderId(folderId: String, limit: Int = 200): Result<List<DriveFile>>
}
