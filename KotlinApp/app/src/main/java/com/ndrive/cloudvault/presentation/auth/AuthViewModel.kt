package com.ndrive.cloudvault.presentation.auth

import android.util.Patterns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
	val isConfigured: Boolean = true,
	val isLoading: Boolean = false,
	val errorMessage: String? = null,
	val infoMessage: String? = null,
	val navigateToHome: Boolean = false,
	val navigateToLogin: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
	private val authRepository: AuthRepository
) : ViewModel() {

	private val _uiState = MutableStateFlow(AuthUiState())
	val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

	init {
		if (!authRepository.isConfigured()) {
			_uiState.value = _uiState.value.copy(
				isConfigured = false,
				errorMessage = "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in local.properties."
			)
		} else if (authRepository.hasActiveSession()) {
			_uiState.value = _uiState.value.copy(navigateToHome = true)
		}
	}

	fun signIn(email: String, password: String) {
		val normalizedEmail = email.trim()

		if (!isConfigurationReady()) return
		if (!isValidEmail(normalizedEmail)) {
			setError("Please enter a valid email address.")
			return
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters.")
			return
		}

		runAuthAction {
			authRepository.signIn(normalizedEmail, password)
				.onSuccess {
					_uiState.update {
						it.copy(
							infoMessage = "Signed in successfully.",
							navigateToHome = true
						)
					}
				}
				.onFailure { throwable ->
					setError(throwable.message ?: "Unable to sign in. Please try again.")
				}
		}
	}

	fun signInWithGoogle() {
		if (!isConfigurationReady()) return

		runAuthAction {
			authRepository.signInWithGoogle()
				.onSuccess {
					_uiState.update {
						it.copy(infoMessage = "Continue with Google in your browser, then return to the app.")
					}
				}
				.onFailure { throwable ->
					setError(throwable.message ?: "Unable to start Google sign in. Please try again.")
				}
		}
	}

	fun checkExistingSession() {
		if (!authRepository.isConfigured()) return
		if (authRepository.hasActiveSession()) {
			_uiState.update {
				it.copy(
					navigateToHome = true,
					errorMessage = null
				)
			}
		}
	}

	fun signUp(displayName: String, email: String, password: String) {
		val normalizedDisplayName = displayName.trim()
		val normalizedEmail = email.trim()

		if (!isConfigurationReady()) return
		if (normalizedDisplayName.isBlank()) {
			setError("Display name is required.")
			return
		}
		if (!isValidEmail(normalizedEmail)) {
			setError("Please enter a valid email address.")
			return
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters.")
			return
		}

		runAuthAction {
			authRepository.signUp(
				displayName = normalizedDisplayName,
				email = normalizedEmail,
				password = password
			).onSuccess { result ->
				if (result.authenticated) {
					_uiState.update {
						it.copy(
							infoMessage = "Account created and signed in.",
							navigateToHome = true
						)
					}
				} else {
					_uiState.update {
						it.copy(
							infoMessage = "Account created. Please verify your email, then sign in.",
							navigateToLogin = true
						)
					}
				}
			}.onFailure { throwable ->
				setError(throwable.message ?: "Unable to create account. Please try again.")
			}
		}
	}

	fun sendPasswordRecovery(email: String) {
		val normalizedEmail = email.trim()

		if (!isConfigurationReady()) return
		if (!isValidEmail(normalizedEmail)) {
			setError("Enter a valid email to receive a recovery link.")
			return
		}

		runAuthAction {
			authRepository.sendPasswordRecovery(normalizedEmail)
				.onSuccess {
					_uiState.update {
						it.copy(infoMessage = "Recovery email sent. Check your inbox.")
					}
				}
				.onFailure { throwable ->
					setError(throwable.message ?: "Could not send recovery email.")
				}
		}
	}

	fun clearMessages() {
		_uiState.update { it.copy(errorMessage = null, infoMessage = null) }
	}

	fun onNavigationHandled() {
		_uiState.update {
			it.copy(
				navigateToHome = false,
				navigateToLogin = false
			)
		}
	}

	private fun runAuthAction(block: suspend () -> Unit) {
		viewModelScope.launch {
			_uiState.update { it.copy(isLoading = true, errorMessage = null) }
			try {
				block()
			} catch (exception: Exception) {
				setError(exception.message ?: "Something went wrong. Please try again.")
			} finally {
				_uiState.update { it.copy(isLoading = false) }
			}
		}
	}

	private fun isConfigurationReady(): Boolean {
		if (_uiState.value.isConfigured) return true
		setError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in local.properties.")
		return false
	}

	private fun isValidEmail(email: String): Boolean =
		Patterns.EMAIL_ADDRESS.matcher(email).matches()

	private fun setError(message: String) {
		_uiState.update {
			it.copy(
				errorMessage = message,
				infoMessage = null
			)
		}
	}
}
