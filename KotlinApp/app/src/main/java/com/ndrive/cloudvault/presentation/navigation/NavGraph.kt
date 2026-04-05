package com.ndrive.cloudvault.presentation.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.ndrive.cloudvault.presentation.auth.LoginScreen
import com.ndrive.cloudvault.presentation.auth.SignupScreen
import com.ndrive.cloudvault.presentation.home.HomeScreen
import com.ndrive.cloudvault.presentation.home.FilesScreen
import com.ndrive.cloudvault.presentation.home.StarredScreen
import com.ndrive.cloudvault.presentation.home.PhotosScreen
import androidx.compose.material3.Scaffold
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav

@Composable
fun NDriveNavGraph(navController: NavHostController) {
    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                onNavigateToHome = { navController.navigate("home") { popUpTo("login") { inclusive = true } } },
                onNavigateToSignUp = { navController.navigate("signup") }
            )
        }
        composable("signup") {
            SignupScreen(
                onNavigateToHome = { navController.navigate("home") { popUpTo("login") { inclusive = true } } },
                onNavigateToLogin = { navController.navigate("login") { popUpTo("signup") { inclusive = true } } }
            )
        }
        composable("home") {
            HomeScreen(navController)
        }
        composable("files") {
            FilesScreen(navController)
        }
        composable("starred") {
            StarredScreen(navController)
        }
        composable("photos") {
            PhotosScreen(navController)
        }
    }
}
