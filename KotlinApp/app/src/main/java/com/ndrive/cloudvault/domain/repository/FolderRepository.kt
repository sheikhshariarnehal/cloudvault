package com.ndrive.cloudvault.domain.repository

import com.ndrive.cloudvault.domain.model.DriveFolder

interface FolderRepository {
        suspend fun getRootFolders(limit: Int = 30): Result<List<DriveFolder>>
}
