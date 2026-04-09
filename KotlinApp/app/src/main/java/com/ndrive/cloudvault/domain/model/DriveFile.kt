package com.ndrive.cloudvault.domain.model

data class DriveFile(
	val id: String,
	val name: String,
	val mimeType: String,
	val sizeBytes: Long,
	val folderId: String?,
	val updatedAt: String?,
	val isStarred: Boolean,
	val thumbnailUrl: String?
)
