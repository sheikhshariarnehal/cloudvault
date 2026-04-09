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
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import com.ndrive.cloudvault.R
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToSignUp: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val isDark = isSystemInDarkTheme()
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(uiState.navigateToHome) {
        if (uiState.navigateToHome) {
            viewModel.onNavigationHandled()
            onNavigateToHome()
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.checkExistingSession()
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val topBgColor = if (isDark) Color(0xFF1E2638) else Color(0xFFCEE3FA)
    val bottomBgColor = if (isDark) Color(0xFF0F1523) else Color(0xFFFFFFFF)
    val textColor = if (isDark) Color.White else Color.Black
    val subtleTextColor = if (isDark) Color.LightGray else Color.DarkGray
    val primaryColor = if (isDark) Color(0xFF1F2937) else Color(0xFF0A1021)
    val dividerColor = if (isDark) Color(0xFF374151) else Color(0xFFB0BEC5)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(topBgColor)
    ) {
        // Top Section Logo
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
                text = "Store Your Files",
                color = textColor.copy(alpha = 0.8f),
                fontSize = 14.sp
            )
        }

        // Bottom Form Section
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.70f)
                .align(Alignment.BottomCenter)
                .clip(RoundedCornerShape(topStart = 40.dp, topEnd = 40.dp))
                .background(bottomBgColor)
                .padding(horizontal = 32.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 48.dp) // Start content slightly below the rounded top
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Login",
                    color = textColor,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )

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
                
                Spacer(modifier = Modifier.height(32.dp))

                // Email Field
                OutlinedTextField(
                    value = email,
                    onValueChange = {
                        email = it
                        viewModel.clearMessages()
                    },
                    label = { Text("Email") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Email, contentDescription = "Email Icon", tint = subtleTextColor)
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

                Spacer(modifier = Modifier.height(24.dp))

                // Password Field
                Column(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            viewModel.clearMessages()
                        },
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(imageVector = Icons.Default.Lock, contentDescription = "Password Icon", tint = subtleTextColor)
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
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Forgot password?", 
                        fontSize = 14.sp, 
                        color = primaryColor, 
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .align(Alignment.End)
                            .clickable(enabled = !uiState.isLoading) {
                                viewModel.sendPasswordRecovery(email)
                            }
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Login Button
                Button(
                    onClick = { viewModel.signIn(email, password) },
                    enabled = !uiState.isLoading && uiState.isConfigured,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = primaryColor)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("Logging in...", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    } else {
                        Text("Log In", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                Text(text = "Or continue with", fontSize = 12.sp, color = subtleTextColor)

                Spacer(modifier = Modifier.height(16.dp))

                // Social Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedButton(
                        onClick = { viewModel.signInWithGoogle() },
                        enabled = !uiState.isLoading && uiState.isConfigured,
                        modifier = Modifier.weight(1f).height(45.dp),
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
                        enabled = !uiState.isLoading,
                        modifier = Modifier.weight(1f).height(45.dp),
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

                Spacer(modifier = Modifier.height(32.dp))

                // Sign Up text
                Row(modifier = Modifier.padding(bottom = 32.dp)) {
                    Text("Don't have account? ", fontSize = 12.sp, color = subtleTextColor)
                    Text(
                        "Create now", 
                        fontSize = 12.sp, 
                        color = textColor,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable(enabled = !uiState.isLoading) { onNavigateToSignUp() }
                    )
                }
            }
        }
    }
}
