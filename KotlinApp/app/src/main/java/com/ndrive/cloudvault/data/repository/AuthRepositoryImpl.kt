package com.ndrive.cloudvault.data.repository

import com.ndrive.cloudvault.BuildConfig
import com.ndrive.cloudvault.domain.repository.AuthProfile
import com.ndrive.cloudvault.domain.repository.AuthRepository
import com.ndrive.cloudvault.domain.repository.SignUpResult
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.Google
import io.github.jan.supabase.gotrue.providers.builtin.Email
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Singleton
class AuthRepositoryImpl @Inject constructor(
	private val supabaseClient: SupabaseClient
) : AuthRepository {

	override fun isConfigured(): Boolean = configurationError() == null

	override fun hasActiveSession(): Boolean {
		if (!isConfigured()) return false
		return supabaseClient.auth.currentSessionOrNull() != null
	}

	override fun getCurrentAuthProfile(): AuthProfile? {
		if (!isConfigured()) return null
		val user = supabaseClient.auth.currentUserOrNull() ?: return null

		val metadata = user.userMetadata
		val displayName = metadata?.get("display_name")?.jsonPrimitive?.contentOrNull
			?: metadata?.get("full_name")?.jsonPrimitive?.contentOrNull
		val avatarUrl = metadata?.get("avatar_url")?.jsonPrimitive?.contentOrNull
			?: metadata?.get("picture")?.jsonPrimitive?.contentOrNull

		return AuthProfile(
			id = user.id,
			email = user.email,
			displayName = displayName,
			avatarUrl = avatarUrl,
			createdAtIso = user.createdAt.toString(),
			lastSignInAtIso = user.lastSignInAt?.toString()
		)
	}

	override suspend fun signIn(email: String, password: String): Result<Unit> = runCatching {
		ensureConfigured()
		supabaseClient.auth.signInWith(Email) {
			this.email = email.trim()
			this.password = password
		}
		check(hasActiveSession()) { "Sign in succeeded but no active session was found." }
	}

	override suspend fun signInWithGoogle(): Result<Unit> = runCatching {
		ensureConfigured()
		supabaseClient.auth.signInWith(Google) {
			scopes.add("email")
			scopes.add("profile")
		}
	}

	override suspend fun signUp(
		displayName: String,
		email: String,
		password: String
	): Result<SignUpResult> = runCatching {
		ensureConfigured()
		val normalizedDisplayName = displayName.trim()
		supabaseClient.auth.signUpWith(Email) {
			this.email = email.trim()
			this.password = password
			if (normalizedDisplayName.isNotBlank()) {
				data = buildJsonObject {
					put("display_name", normalizedDisplayName)
					put("full_name", normalizedDisplayName)
					put("auth_source", "android")
				}
			}
		}
		SignUpResult(authenticated = hasActiveSession())
	}

	override suspend fun sendPasswordRecovery(email: String): Result<Unit> = runCatching {
		ensureConfigured()
		supabaseClient.auth.resetPasswordForEmail(
			email = email.trim(),
			redirectUrl = null
		)
	}

	override suspend fun signOut(): Result<Unit> = runCatching {
		if (!isConfigured()) return@runCatching
		supabaseClient.auth.signOut()
	}

	private fun ensureConfigured() {
		val error = configurationError()
		check(error == null) { error ?: "Supabase configuration error." }
	}

	private fun configurationError(): String? {
		return when {
			BuildConfig.SUPABASE_URL.isBlank() ->
				"Missing SUPABASE_URL. Add it to local.properties or environment variables."

			BuildConfig.SUPABASE_ANON_KEY.isBlank() ->
				"Missing SUPABASE_ANON_KEY. Add it to local.properties or environment variables."

			else -> null
		}
	}
}
