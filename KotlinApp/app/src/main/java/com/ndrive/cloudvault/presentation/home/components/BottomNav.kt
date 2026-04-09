package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Photo
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState

@Composable
fun NDriveBottomNav(navController: NavController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val items = listOf("Home", "Starred", "Photos", "Files")
    val routes = listOf("home", "starred", "photos", "files")

    val selectedIcons = listOf(
        Icons.Filled.Home,
        Icons.Filled.Star,
        Icons.Filled.Photo,
        Icons.Filled.Folder
    )
    val unselectedIcons = listOf(
        Icons.Outlined.Home,
        Icons.Outlined.StarBorder,
        Icons.Outlined.Photo,
        Icons.Outlined.Folder
    )

    NavigationBar {
        items.forEachIndexed { index, item ->
            NavigationBarItem(
                icon = {
                    Icon(
                        imageVector = if (currentRoute == routes[index]) selectedIcons[index] else unselectedIcons[index],
                        contentDescription = item
                    )
                },
                label = { Text(item) },
                selected = currentRoute == routes[index],
                onClick = { 
                    if(currentRoute != routes[index]) {
                        navController.navigate(routes[index]) {
                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                }
            )
        }
    }
}
