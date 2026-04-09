package com.ndrive.cloudvault.di

import com.ndrive.cloudvault.data.repository.FileRepositoryImpl
import com.ndrive.cloudvault.data.repository.FolderRepositoryImpl
import com.ndrive.cloudvault.data.repository.TelegramRepositoryImpl
import com.ndrive.cloudvault.data.repository.UploadRepositoryImpl
import com.ndrive.cloudvault.domain.repository.FileRepository
import com.ndrive.cloudvault.domain.repository.FolderRepository
import com.ndrive.cloudvault.domain.repository.TelegramRepository
import com.ndrive.cloudvault.domain.repository.UploadRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

	@Binds
	abstract fun bindFileRepository(
		impl: FileRepositoryImpl
	): FileRepository

	@Binds
	abstract fun bindFolderRepository(
		impl: FolderRepositoryImpl
	): FolderRepository

	@Binds
	abstract fun bindUploadRepository(
		impl: UploadRepositoryImpl
	): UploadRepository

	@Binds
	abstract fun bindTelegramRepository(
		impl: TelegramRepositoryImpl
	): TelegramRepository
}
