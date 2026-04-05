package com.ndrive.cloudvault.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToSignUp: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val isDark = isSystemInDarkTheme()

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
                    .padding(top = 48.dp), // Start content slightly below the rounded top
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Login",
                    color = textColor,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(32.dp))

                // Email Field
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(text = "Email", fontSize = 12.sp, color = subtleTextColor)
                    TextField(
                        value = email,
                        onValueChange = { email = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor = primaryColor,
                            unfocusedIndicatorColor = dividerColor,
                        ),
                        modifier = Modifier.fillMaxWidth().height(56.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Password Field
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Password", fontSize = 12.sp, color = subtleTextColor)
                        Text(
                            text = "Forgot?", 
                            fontSize = 12.sp, 
                            color = textColor, 
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { /* Handle forgot password */ }
                        )
                    }
                    TextField(
                        value = password,
                        onValueChange = { password = it },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor = primaryColor,
                            unfocusedIndicatorColor = dividerColor,
                        ),
                        modifier = Modifier.fillMaxWidth().height(56.dp)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Login Button
                Button(
                    onClick = onNavigateToHome,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = primaryColor)
                ) {
                    Text("Log In", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
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
                        onClick = { },
                        modifier = Modifier.weight(1f).height(45.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(text = "G", color = Color(0xFFDB4437), fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Google", color = textColor, fontSize = 14.sp)
                    }
                    OutlinedButton(
                        onClick = { },
                        modifier = Modifier.weight(1f).height(45.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(text = "f", color = Color(0xFF4267B2), fontWeight = FontWeight.Bold)
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
                        modifier = Modifier.clickable { onNavigateToSignUp() }
                    )
                }
            }
        }
    }
}
