package com.ndrive.cloudvault.presentation.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ndrive.cloudvault.presentation.auth.AuthViewModel
import com.ndrive.cloudvault.presentation.auth.LoginScreen
import com.ndrive.cloudvault.presentation.auth.SignupScreen
import com.ndrive.cloudvault.presentation.home.HomeScreen
import com.ndrive.cloudvault.presentation.home.FilesScreen
import com.ndrive.cloudvault.presentation.home.FolderScreen
import com.ndrive.cloudvault.presentation.home.StarredScreen
import com.ndrive.cloudvault.presentation.home.PhotosScreen
import com.ndrive.cloudvault.presentation.preview.PreviewScreen
import com.ndrive.cloudvault.presentation.profile.ProfileScreen
import com.ndrive.cloudvault.presentation.search.SearchScreen
import com.ndrive.cloudvault.presentation.upload.UploadsScreen

@Composable
fun NDriveNavGraph(navController: NavHostController) {
    NavHost(
        navController = navController, 
        startDestination = "startup",
        enterTransition = {
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Left, animationSpec = tween(400)) + fadeIn(animationSpec = tween(400))
        },
        exitTransition = {
            scaleOut(targetScale = 0.95f, animationSpec = tween(400)) + fadeOut(animationSpec = tween(400))
        },
        popEnterTransition = {
            scaleIn(initialScale = 0.95f, animationSpec = tween(400)) + fadeIn(animationSpec = tween(400))
        },
        popExitTransition = {
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Right, animationSpec = tween(400)) + fadeOut(animationSpec = tween(400))
        }
    ) {
        composable("startup") {
            val viewModel: AuthViewModel = hiltViewModel()
            val uiState by viewModel.uiState.collectAsState()

            LaunchedEffect(uiState.isLoading, uiState.navigateToHome) {
                if (uiState.isLoading) return@LaunchedEffect

                val destination = if (uiState.navigateToHome) "home" else "login"
                viewModel.onNavigationHandled()
                navController.navigate(destination) {
                    popUpTo("startup") { inclusive = true }
                    launchSingleTop = true
                }
            }

            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        }

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
        
        // Bottom Nav screens typically use pure fades to avoid huge sliding artifacts
        
        composable("home",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) {
            HomeScreen(navController)
        }
        composable("files",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) {
            FilesScreen(navController)
        }
        composable(
            route = "folder/{folderId}",
            arguments = listOf(
                navArgument("folderId") {
                    type = NavType.StringType
                },
            ),
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) { backStackEntry ->
            val folderId = backStackEntry.arguments?.getString("folderId").orEmpty()
            FolderScreen(
                navController = navController,
                folderId = folderId,
            )
        }
        composable("starred",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) {
            StarredScreen(navController)
        }
        composable("photos",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) {
            PhotosScreen(navController)
        }
        composable(
            route = "profile_route?openTelegramDialog={openTelegramDialog}",
            arguments = listOf(
                navArgument("openTelegramDialog") {
                    type = NavType.BoolType
                    defaultValue = false
                },
            ),
        ) { backStackEntry ->
            val openTelegramDialog = backStackEntry.arguments
                ?.getBoolean("openTelegramDialog")
                ?: false
            ProfileScreen(
                navController = navController,
                openTelegramDialogOnStart = openTelegramDialog,
            )
        }
        composable("search",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) }
        ) {
            SearchScreen(navController)
        }
        composable(
            "uploads",
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) },
        ) {
            UploadsScreen(navController)
        }
        composable(
            route = "preview/{fileId}",
            arguments = listOf(
                navArgument("fileId") {
                    type = NavType.StringType
                },
            ),
            enterTransition = { fadeIn(animationSpec = tween(200)) },
            exitTransition = { fadeOut(animationSpec = tween(200)) },
            popEnterTransition = { fadeIn(animationSpec = tween(200)) },
            popExitTransition = { fadeOut(animationSpec = tween(200)) },
        ) { backStackEntry ->
            val fileId = backStackEntry.arguments?.getString("fileId").orEmpty()
            PreviewScreen(
                navController = navController,
                fileId = fileId,
            )
        }
    }
}
