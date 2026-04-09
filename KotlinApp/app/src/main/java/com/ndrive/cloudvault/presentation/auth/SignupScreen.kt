package com.ndrive.cloudvault.presentation.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ndrive.cloudvault.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignupScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var displayName by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var confirmPasswordVisible by rememberSaveable { mutableStateOf(false) }
    var localErrorMessage by rememberSaveable { mutableStateOf<String?>(null) }

    val uiState by viewModel.uiState.collectAsState()
    val isDark = isSystemInDarkTheme()

    val topBgColor = if (isDark) Color(0xFF1E2638) else Color(0xFFCEE3FA)
    val bottomBgColor = if (isDark) Color(0xFF0F1523) else Color(0xFFFFFFFF)
    val textColor = if (isDark) Color.White else Color.Black
    val subtleTextColor = if (isDark) Color.LightGray else Color.DarkGray
    val primaryColor = if (isDark) Color(0xFF1F2937) else Color(0xFF0A1021)
    val dividerColor = if (isDark) Color(0xFF374151) else Color(0xFFB0BEC5)

    fun submitSignup() {
        localErrorMessage = when {
            displayName.trim().isEmpty() -> "Display name is required."
            email.trim().isEmpty() -> "Email is required."
            password.length < 6 -> "Password must be at least 6 characters."
            confirmPassword != password -> "Passwords do not match."
            else -> null
        }

        if (localErrorMessage == null) {
            viewModel.signUp(displayName, email, password)
        }
    }

    LaunchedEffect(uiState.navigateToHome) {
        if (uiState.navigateToHome) {
            viewModel.onNavigationHandled()
            onNavigateToHome()
        }
    }

    LaunchedEffect(uiState.navigateToLogin) {
        if (uiState.navigateToLogin) {
            viewModel.onNavigationHandled()
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(topBgColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 80.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Cloud,
                    contentDescription = "Logo",
                    tint = textColor,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "NDrive",
                    color = textColor,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Create Your Secure Workspace",
                color = textColor.copy(alpha = 0.8f),
                fontSize = 14.sp
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.76f)
                .align(Alignment.BottomCenter)
                .clip(RoundedCornerShape(topStart = 40.dp, topEnd = 40.dp))
                .background(bottomBgColor)
                .padding(horizontal = 32.dp)
        ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                    .padding(top = 40.dp)
                    .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
                Text(
                    text = "Sign Up",
                    color = textColor,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Use your email and password to start syncing files",
                    color = subtleTextColor,
                    style = MaterialTheme.typography.bodySmall
                )

                localErrorMessage?.let { message ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

            uiState.errorMessage?.let { message ->
                    Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            uiState.infoMessage?.let { message ->
                    Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = message,
                        color = Color(0xFF2E7D32),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.fillMaxWidth()
                )
            }

                Spacer(modifier = Modifier.height(24.dp))
            
            OutlinedTextField(
                value = displayName,
                onValueChange = {
                    displayName = it
                        localErrorMessage = null
                    viewModel.clearMessages()
                },
                label = { Text("Display Name") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Display Name",
                            tint = subtleTextColor
                        )
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = primaryColor,
                        unfocusedBorderColor = dividerColor,
                        focusedLabelColor = primaryColor,
                        unfocusedLabelColor = subtleTextColor
                    ),
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading
            )
                Spacer(modifier = Modifier.height(20.dp))

            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                        localErrorMessage = null
                    viewModel.clearMessages()
                },
                label = { Text("Email") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Email,
                            contentDescription = "Email",
                            tint = subtleTextColor
                        )
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = primaryColor,
                        unfocusedBorderColor = dividerColor,
                        focusedLabelColor = primaryColor,
                        unfocusedLabelColor = subtleTextColor
                    ),
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading
            )
                Spacer(modifier = Modifier.height(20.dp))
            
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                        localErrorMessage = null
                    viewModel.clearMessages()
                },
                label = { Text("Password") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Password",
                            tint = subtleTextColor
                        )
                    },
                    trailingIcon = {
                        val image = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff
                        val description = if (passwordVisible) "Hide password" else "Show password"
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(imageVector = image, contentDescription = description, tint = subtleTextColor)
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = primaryColor,
                        unfocusedBorderColor = dividerColor,
                        focusedLabelColor = primaryColor,
                        unfocusedLabelColor = subtleTextColor
                    ),
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading
            )

                Spacer(modifier = Modifier.height(20.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = {
                        confirmPassword = it
                        localErrorMessage = null
                        viewModel.clearMessages()
                    },
                    label = { Text("Confirm Password") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Confirm Password",
                            tint = subtleTextColor
                        )
                    },
                    trailingIcon = {
                        val image = if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff
                        val description = if (confirmPasswordVisible) "Hide password" else "Show password"
                        IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                            Icon(imageVector = image, contentDescription = description, tint = subtleTextColor)
                        }
                    },
                    visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = primaryColor,
                        unfocusedBorderColor = dividerColor,
                        focusedLabelColor = primaryColor,
                        unfocusedLabelColor = subtleTextColor
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !uiState.isLoading
                )

                Spacer(modifier = Modifier.height(26.dp))
            
            Button(
                    onClick = { submitSignup() },
                enabled = !uiState.isLoading && uiState.isConfigured,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = primaryColor)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                        Text("Creating account...", color = Color.White, fontWeight = FontWeight.Bold)
                } else {
                        Text("Create Account", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }

                Spacer(modifier = Modifier.height(16.dp))

                Text(text = "Or continue with", fontSize = 12.sp, color = subtleTextColor)

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedButton(
                        onClick = { },
                        modifier = Modifier
                            .weight(1f)
                            .height(45.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_google),
                            contentDescription = "Google",
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Google", color = textColor, fontSize = 14.sp)
                    }

                    OutlinedButton(
                        onClick = { },
                        modifier = Modifier
                            .weight(1f)
                            .height(45.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_facebook),
                            contentDescription = "Facebook",
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Facebook", color = textColor, fontSize = 14.sp)
                    }
                }
            
                Spacer(modifier = Modifier.height(22.dp))

                Row(modifier = Modifier.padding(bottom = 28.dp)) {
                    Text("Already have account? ", fontSize = 12.sp, color = subtleTextColor)
                    Text(
                        "Sign in",
                        fontSize = 12.sp,
                        color = textColor,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable(enabled = !uiState.isLoading) { onNavigateToLogin() }
                    )
                }
            }
        }
    }
}
