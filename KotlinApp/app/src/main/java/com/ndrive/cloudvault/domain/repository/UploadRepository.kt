package com.ndrive.cloudvault.domain.repository

import android.net.Uri
import com.ndrive.cloudvault.domain.model.UploadState
import kotlinx.coroutines.flow.Flow

interface UploadRepository {
	fun uploadFile(
		fileUri: Uri,
		folderId: String? = null,
	): Flow<UploadState>
}
