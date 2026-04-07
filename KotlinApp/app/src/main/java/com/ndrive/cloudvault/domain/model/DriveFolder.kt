package com.ndrive.cloudvault.domain.model

data class DriveFolder(
	val id: String,
	val name: String,
	val parentId: String?,
	val updatedAt: String?,
        val color: String?,
        val isStarred: Boolean = false)