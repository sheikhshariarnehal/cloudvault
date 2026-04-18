package com.ndrive.cloudvault.presentation.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage

private data class ProfileOption(
    val title: String,
    val icon: ImageVector,
    val isDestructive: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    navController: NavController,
    openTelegramDialogOnStart: Boolean = false,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val profile = uiState.profile

    val displayName = profile?.displayName
        ?.takeIf { name -> name.isNotBlank() }
        ?: profile?.email?.substringBefore("@")
        ?: "NDrive User"

    val initials = remember(displayName) {
        displayName
            .split(" ")
            .filter { it.isNotBlank() }
            .take(2)
            .joinToString(separator = "") { it.first().uppercase() }
            .ifBlank { "U" }
    }

    val joinedDate = remember(profile?.createdAtIso) {
        profile?.createdAtIso
            ?.take(10)
            ?: "Unknown"
    }

    val lastSignInDate = remember(profile?.lastSignInAtIso) {
        profile?.lastSignInAtIso
            ?.take(10)
            ?: "Unknown"
    }

    val settingsOptions = remember {
        listOf(
            ProfileOption("Account details", Icons.Outlined.ManageAccounts),
            ProfileOption("Security & Privacy", Icons.Outlined.Security),
            ProfileOption("Notifications", Icons.Outlined.Notifications),
            ProfileOption("Language", Icons.Outlined.Language)
        )
    }

    val supportOptions = remember {
        listOf(
            ProfileOption("Help & Feedback", Icons.AutoMirrored.Outlined.HelpOutline),
            ProfileOption("About", Icons.Outlined.Info)
        )
    }

    val snackbarHostState = remember { SnackbarHostState() }
    var telegramPhoneInput by rememberSaveable { mutableStateOf("") }
    var telegramCodeInput by rememberSaveable { mutableStateOf("") }
    var telegramPasswordInput by rememberSaveable { mutableStateOf("") }
    var pendingAutoOpenTelegramDialog by rememberSaveable(openTelegramDialogOnStart) {
        mutableStateOf(openTelegramDialogOnStart)
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { message -> snackbarHostState.showSnackbar(message) }
    }

    LaunchedEffect(uiState.infoMessage) {
        uiState.infoMessage?.let { message -> snackbarHostState.showSnackbar(message) }
    }

    LaunchedEffect(uiState.navigateToLogin) {
        if (uiState.navigateToLogin) {
            viewModel.onNavigationHandled()
            while (navController.popBackStack()) {
                // Clear stack after sign out.
            }
            navController.navigate("login")
        }
    }

    LaunchedEffect(uiState.telegramDialogOpen) {
        if (!uiState.telegramDialogOpen) {
            telegramPhoneInput = ""
            telegramCodeInput = ""
            telegramPasswordInput = ""
        }
    }

    LaunchedEffect(
        pendingAutoOpenTelegramDialog,
        uiState.profile,
        uiState.isTelegramStatusLoading,
        uiState.isTelegramConnected,
        uiState.telegramDialogOpen,
    ) {
        if (!pendingAutoOpenTelegramDialog) return@LaunchedEffect
        if (uiState.profile == null || uiState.isTelegramStatusLoading) return@LaunchedEffect

        pendingAutoOpenTelegramDialog = false
        if (!uiState.isTelegramConnected && !uiState.telegramDialogOpen) {
            telegramPhoneInput = uiState.telegramPhone ?: ""
            viewModel.openTelegramDialog()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile", fontWeight = FontWeight.Medium) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refreshProfile() }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh profile")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        if (uiState.isLoading && profile == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                item(key = "Profile_Header") {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (!profile?.avatarUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = profile?.avatarUrl,
                                contentDescription = "Profile photo",
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape)
                            )
                        } else {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFF4C6A9B),
                                modifier = Modifier.size(96.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = initials,
                                        color = Color.White,
                                        fontSize = 34.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = displayName,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )

                        Text(
                            text = profile?.email ?: "No email found",
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        FilledTonalButton(
                            onClick = { viewModel.refreshProfile() },
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text("Refresh details", fontWeight = FontWeight.Medium)
                        }

                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }

                item(key = "Account_Info") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                            .padding(20.dp)
                    ) {
                        ProfileInfoRow(label = "User ID", value = profile?.id ?: "Unknown")
                        Spacer(modifier = Modifier.height(8.dp))
                        ProfileInfoRow(label = "Joined", value = joinedDate)
                        Spacer(modifier = Modifier.height(8.dp))
                        ProfileInfoRow(label = "Last sign in", value = lastSignInDate)
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }

                item(key = "Sync_Status") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                            .padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.Cloud,
                                contentDescription = null,
                                tint = Color(0xFF0B57D0)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Supabase Auth", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = if (profile != null) "Session active and profile loaded." else "No active session found.",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }

                item(key = "Telegram_Storage") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                            .padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.PhoneAndroid,
                                contentDescription = null,
                                tint = Color(0xFF0B57D0)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Telegram Storage", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        if (uiState.isTelegramStatusLoading) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    "Checking connection...",
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        } else if (uiState.isTelegramConnected) {
                            Text(
                                text = uiState.telegramPhone?.let { "Connected: $it" } ?: "Connected",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Uploads are stored in your own Telegram account.",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            OutlinedButton(
                                onClick = { viewModel.disconnectTelegram() },
                                enabled = !uiState.isTelegramActionLoading,
                            ) {
                                if (uiState.isTelegramActionLoading) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Text("Disconnect Telegram")
                            }
                        } else {
                            Text(
                                text = "Connect your Telegram number to store uploads in your own account.",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Button(
                                onClick = {
                                    telegramPhoneInput = uiState.telegramPhone ?: ""
                                    viewModel.openTelegramDialog()
                                },
                                enabled = !uiState.isTelegramActionLoading,
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Link,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Connect Telegram")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }

                item(key = "Settings_Header") {
                    Text(
                        text = "Settings",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                    )
                }

                items(settingsOptions, key = { it.title }) { option ->
                    ProfileOptionRow(icon = option.icon, title = option.title, onClick = { viewModel.clearMessages() })
                }

                item(key = "Support_Header") {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Support",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                    )
                }

                items(supportOptions, key = { it.title }) { option ->
                    ProfileOptionRow(icon = option.icon, title = option.title, onClick = { viewModel.clearMessages() })
                }

                item(key = "SignOut_Btn") {
                    Spacer(modifier = Modifier.height(28.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !uiState.isLoading) { viewModel.signOut() }
                            .padding(horizontal = 24.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.size(16.dp))
                        Text(
                            text = if (uiState.isLoading) "Signing out..." else "Sign out",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }

    if (uiState.telegramDialogOpen) {
        AlertDialog(
            onDismissRequest = {
                if (!uiState.isTelegramActionLoading) {
                    viewModel.closeTelegramDialog()
                }
            },
            title = {
                Text(
                    when (uiState.telegramConnectStep) {
                        TelegramConnectStep.PHONE -> "Connect Telegram"
                        TelegramConnectStep.CODE -> "Enter Verification Code"
                        TelegramConnectStep.PASSWORD -> "Enter 2FA Password"
                        TelegramConnectStep.SUCCESS -> "Telegram Connected"
                    }
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = when (uiState.telegramConnectStep) {
                            TelegramConnectStep.PHONE -> "Use full international format, e.g. +8801XXXXXXXXX"
                            TelegramConnectStep.CODE -> "We sent a code to your Telegram app."
                            TelegramConnectStep.PASSWORD -> "Your account has two-factor authentication enabled."
                            TelegramConnectStep.SUCCESS -> "All new uploads will be stored in your Telegram account."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    when (uiState.telegramConnectStep) {
                        TelegramConnectStep.PHONE -> {
                            OutlinedTextField(
                                value = telegramPhoneInput,
                                onValueChange = { telegramPhoneInput = it },
                                label = { Text("Phone Number") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                            )
                        }
                        TelegramConnectStep.CODE -> {
                            OutlinedTextField(
                                value = telegramCodeInput,
                                onValueChange = { telegramCodeInput = it.filter(Char::isDigit) },
                                label = { Text("Code") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                            )
                        }
                        TelegramConnectStep.PASSWORD -> {
                            OutlinedTextField(
                                value = telegramPasswordInput,
                                onValueChange = { telegramPasswordInput = it },
                                label = { Text("Password") },
                                singleLine = true,
                            )
                        }
                        TelegramConnectStep.SUCCESS -> {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Filled.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF2E7D32)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Verification complete")
                            }
                        }
                    }

                    if (!uiState.telegramFlowError.isNullOrBlank()) {
                        Text(
                            text = uiState.telegramFlowError ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            },
            confirmButton = {
                when (uiState.telegramConnectStep) {
                    TelegramConnectStep.PHONE -> {
                        Button(
                            onClick = { viewModel.sendTelegramCode(telegramPhoneInput) },
                            enabled = !uiState.isTelegramActionLoading && telegramPhoneInput.isNotBlank(),
                        ) {
                            if (uiState.isTelegramActionLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Send Code")
                        }
                    }
                    TelegramConnectStep.CODE -> {
                        Button(
                            onClick = { viewModel.verifyTelegramCode(telegramCodeInput) },
                            enabled = !uiState.isTelegramActionLoading && telegramCodeInput.isNotBlank(),
                        ) {
                            if (uiState.isTelegramActionLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Verify Code")
                        }
                    }
                    TelegramConnectStep.PASSWORD -> {
                        Button(
                            onClick = { viewModel.verifyTelegramPassword(telegramPasswordInput) },
                            enabled = !uiState.isTelegramActionLoading && telegramPasswordInput.isNotBlank(),
                        ) {
                            if (uiState.isTelegramActionLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Submit Password")
                        }
                    }
                    TelegramConnectStep.SUCCESS -> {
                        Button(onClick = { viewModel.closeTelegramDialog() }) {
                            Text("Done")
                        }
                    }
                }
            },
            dismissButton = {
                if (uiState.telegramConnectStep != TelegramConnectStep.SUCCESS) {
                    OutlinedButton(
                        onClick = { viewModel.closeTelegramDialog() },
                        enabled = !uiState.isTelegramActionLoading,
                    ) {
                        Text("Cancel")
                    }
                }
            },
        )
    }
}

@Composable
private fun ProfileInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.size(12.dp))
        Text(
            text = value,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1
        )
    }
}

@Composable
private fun ProfileOptionRow(icon: ImageVector, title: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.size(16.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
    }
}
