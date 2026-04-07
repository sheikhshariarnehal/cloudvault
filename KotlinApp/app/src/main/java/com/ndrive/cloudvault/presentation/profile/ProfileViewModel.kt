package com.ndrive.cloudvault.presentation.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.model.TelegramVerifyState
import com.ndrive.cloudvault.domain.repository.AuthProfile
import com.ndrive.cloudvault.domain.repository.AuthRepository
import com.ndrive.cloudvault.domain.repository.TelegramRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class TelegramConnectStep {
	PHONE,
	CODE,
	PASSWORD,
	SUCCESS,
}

data class ProfileUiState(
    val isLoading: Boolean = false,
    val isConfigured: Boolean = true,
    val profile: AuthProfile? = null,
    val isTelegramStatusLoading: Boolean = false,
    val isTelegramActionLoading: Boolean = false,
    val isTelegramConnected: Boolean = false,
    val telegramPhone: String? = null,
    val telegramDialogOpen: Boolean = false,
    val telegramConnectStep: TelegramConnectStep = TelegramConnectStep.PHONE,
    val telegramFlowError: String? = null,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val navigateToLogin: Boolean = false
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val telegramRepository: TelegramRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState(isLoading = true))
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        refreshProfile()
    }

    fun refreshProfile() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    infoMessage = null,
                )
            }

            if (!authRepository.isConfigured()) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isConfigured = false,
                        errorMessage = "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in local.properties."
                    )
                }
                return@launch
            }

            val profile = authRepository.getCurrentAuthProfile()
            if (profile == null) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        profile = null,
                        isTelegramConnected = false,
                        telegramPhone = null,
                        errorMessage = "No active session found. Please sign in again.",
                        navigateToLogin = true
                    )
                }
                return@launch
            }

            _uiState.update {
                it.copy(
                    isLoading = false,
                    profile = profile,
                )
            }

            refreshTelegramStatus()
        }
    }

    fun refreshTelegramStatus() {
        if (_uiState.value.profile == null) return

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isTelegramStatusLoading = true,
                    telegramFlowError = null,
                )
            }

            telegramRepository.getStatus()
                .onSuccess { status ->
                    _uiState.update {
                        it.copy(
                            isTelegramStatusLoading = false,
                            isTelegramConnected = status.connected,
                            telegramPhone = status.phone,
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(
                            isTelegramStatusLoading = false,
                            errorMessage = throwable.message ?: "Failed to load Telegram status.",
                        )
                    }
                }
        }
    }

    fun openTelegramDialog() {
        _uiState.update {
            it.copy(
                telegramDialogOpen = true,
                telegramConnectStep = TelegramConnectStep.PHONE,
                telegramFlowError = null,
            )
        }
    }

    fun closeTelegramDialog() {
        _uiState.update {
            it.copy(
                telegramDialogOpen = false,
                telegramConnectStep = TelegramConnectStep.PHONE,
                telegramFlowError = null,
                isTelegramActionLoading = false,
            )
        }
    }

    fun sendTelegramCode(phone: String) {
        if (phone.isBlank()) {
            _uiState.update { it.copy(telegramFlowError = "Phone number is required.") }
            return
        }

        runTelegramAction {
            telegramRepository.sendCode(phone)
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            telegramConnectStep = TelegramConnectStep.CODE,
                            telegramFlowError = null,
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(telegramFlowError = throwable.message ?: "Failed to send Telegram code.")
                    }
                }
        }
    }

    fun verifyTelegramCode(code: String) {
        if (code.isBlank()) {
            _uiState.update { it.copy(telegramFlowError = "Verification code is required.") }
            return
        }

        runTelegramAction {
            telegramRepository.verifyCode(code)
                .onSuccess { result ->
                    when (result.state) {
                        TelegramVerifyState.PASSWORD_REQUIRED -> {
                            _uiState.update {
                                it.copy(
                                    telegramConnectStep = TelegramConnectStep.PASSWORD,
                                    telegramFlowError = null,
                                )
                            }
                        }
                        TelegramVerifyState.READY -> {
                            _uiState.update {
                                it.copy(
                                    telegramConnectStep = TelegramConnectStep.SUCCESS,
                                    telegramFlowError = null,
                                    infoMessage = "Telegram connected successfully.",
                                )
                            }
                            refreshTelegramStatus()
                        }
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(telegramFlowError = throwable.message ?: "Failed to verify code.")
                    }
                }
        }
    }

    fun verifyTelegramPassword(password: String) {
        if (password.isBlank()) {
            _uiState.update { it.copy(telegramFlowError = "Password is required.") }
            return
        }

        runTelegramAction {
            telegramRepository.verifyPassword(password)
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            telegramConnectStep = TelegramConnectStep.SUCCESS,
                            telegramFlowError = null,
                            infoMessage = "Telegram connected successfully.",
                        )
                    }
                    refreshTelegramStatus()
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(telegramFlowError = throwable.message ?: "Failed to verify password.")
                    }
                }
        }
    }

    fun disconnectTelegram() {
        runTelegramAction {
            telegramRepository.disconnect()
                .onSuccess {
                    _uiState.update {
                        it.copy(infoMessage = "Telegram disconnected.")
                    }
                    refreshTelegramStatus()
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(errorMessage = throwable.message ?: "Failed to disconnect Telegram.")
                    }
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            authRepository.signOut()
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            infoMessage = "Signed out successfully.",
                            navigateToLogin = true
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = throwable.message ?: "Failed to sign out. Please try again."
                        )
                    }
                }
        }
    }

    fun clearMessages() {
		_uiState.update { it.copy(errorMessage = null, infoMessage = null, telegramFlowError = null) }
    }

    fun onNavigationHandled() {
        _uiState.update { it.copy(navigateToLogin = false) }
    }

    private fun runTelegramAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isTelegramActionLoading = true,
                    telegramFlowError = null,
                )
            }

            try {
                block()
            } finally {
                _uiState.update { it.copy(isTelegramActionLoading = false) }
            }
        }
    }
}
