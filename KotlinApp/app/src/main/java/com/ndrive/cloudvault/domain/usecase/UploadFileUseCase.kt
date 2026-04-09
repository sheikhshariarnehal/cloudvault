package com.ndrive.cloudvault.domain.usecase

import android.net.Uri
import com.ndrive.cloudvault.domain.model.UploadState
import com.ndrive.cloudvault.domain.repository.UploadRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow

class UploadFileUseCase @Inject constructor(
	private val uploadRepository: UploadRepository,
) {
	operator fun invoke(
		fileUri: Uri,
		folderId: String? = null,
	): Flow<UploadState> = uploadRepository.uploadFile(fileUri = fileUri, folderId = folderId)
}
