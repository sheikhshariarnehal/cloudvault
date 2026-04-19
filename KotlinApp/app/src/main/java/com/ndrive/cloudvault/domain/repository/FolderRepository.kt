package com.ndrive.cloudvault.domain.repository

import com.ndrive.cloudvault.domain.model.DriveFolder

interface FolderRepository {
        suspend fun getRootFolders(limit: Int = 30): Result<List<DriveFolder>>
        suspend fun getFoldersByParentId(parentId: String, limit: Int = 100): Result<List<DriveFolder>>
        suspend fun getFolderById(folderId: String): Result<DriveFolder?>
        suspend fun createFolder(name: String, parentId: String? = null): Result<DriveFolder>
}
