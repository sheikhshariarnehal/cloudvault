package com.ndrive.cloudvault.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.OkHttpClient

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

	@Provides
	@Singleton
	fun provideOkHttpClient(): OkHttpClient {
		return OkHttpClient.Builder()
			.connectTimeout(30, TimeUnit.SECONDS)
			.readTimeout(120, TimeUnit.SECONDS)
			.writeTimeout(120, TimeUnit.SECONDS)
			.callTimeout(0, TimeUnit.SECONDS)
			.build()
	}
}
