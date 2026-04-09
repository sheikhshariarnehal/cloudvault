package com.ndrive.cloudvault.domain.repository

data class SignUpResult(
	val authenticated: Boolean
)

data class AuthProfile(
	val id: String,
	val email: String?,
	val displayName: String?,
	val avatarUrl: String?,
	val createdAtIso: String?,
	val lastSignInAtIso: String?
)

interface AuthRepository {
	fun isConfigured(): Boolean

	fun hasActiveSession(): Boolean

	fun getCurrentAuthProfile(): AuthProfile?

	suspend fun signIn(email: String, password: String): Result<Unit>

	suspend fun signInWithGoogle(): Result<Unit>

	suspend fun signUp(displayName: String, email: String, password: String): Result<SignUpResult>

	suspend fun sendPasswordRecovery(email: String): Result<Unit>

	suspend fun signOut(): Result<Unit>
}
