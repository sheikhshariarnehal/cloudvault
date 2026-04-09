package com.ndrive.cloudvault.di

import com.ndrive.cloudvault.BuildConfig
import com.ndrive.cloudvault.data.repository.AuthRepositoryImpl
import com.ndrive.cloudvault.domain.repository.AuthRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.postgrest.Postgrest
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AuthModule {

	@Provides
	@Singleton
	fun provideSupabaseClient(): SupabaseClient {
		val url = BuildConfig.SUPABASE_URL.ifBlank { "https://zcigqsiovqqldlsnwiqd.supabase.co" }
		val key = BuildConfig.SUPABASE_ANON_KEY.ifBlank { "invalid-anon-key" }

		return createSupabaseClient(
			supabaseUrl = url,
			supabaseKey = key
		) {
			install(Auth) {
				scheme = "ndrive"
				host = "auth-callback"
			}
			install(Postgrest)
		}
	}

	@Provides
	@Singleton
	fun provideAuthRepository(
		impl: AuthRepositoryImpl
	): AuthRepository = impl
}
