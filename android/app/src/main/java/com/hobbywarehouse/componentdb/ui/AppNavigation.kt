package com.hobbywarehouse.componentdb.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.hobbywarehouse.componentdb.data.SettingsRepository
import com.hobbywarehouse.componentdb.ui.screens.CaptureRoute
import com.hobbywarehouse.componentdb.ui.screens.HomeRoute
import com.hobbywarehouse.componentdb.ui.screens.PartDetailRoute
import com.hobbywarehouse.componentdb.ui.screens.ScanRoute
import kotlinx.coroutines.launch

@Composable
fun AppNavigation(
    settings: SettingsRepository,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf(SettingsRepository.DEFAULT_BASE_URL) }

    LaunchedEffect(Unit) {
        settings.baseUrl.collect { baseUrl = it }
    }

    NavHost(
        navController = navController,
        startDestination = "home",
        modifier = modifier,
    ) {
        composable("home") {
            HomeRoute(
                baseUrl = baseUrl,
                onBaseUrlChange = { baseUrl = it },
                onSaveBaseUrl = {
                    scope.launch {
                        settings.setBaseUrl(baseUrl)
                    }
                },
                onOpenScan = { navController.navigate("scan") },
            )
        }
        composable("scan") {
            ScanRoute(
                baseUrl = baseUrl,
                onPartFound = { partId ->
                    navController.navigate("part/$partId") {
                        launchSingleTop = true
                    }
                },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            route = "part/{partId}",
            arguments = listOf(navArgument("partId") { type = NavType.StringType }),
        ) { entry ->
            val partId = entry.arguments?.getString("partId").orEmpty()
            PartDetailRoute(
                partId = partId,
                baseUrl = baseUrl,
                onOpenCapture = { navController.navigate("capture/$partId") },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            route = "capture/{partId}",
            arguments = listOf(navArgument("partId") { type = NavType.StringType }),
        ) { entry ->
            val partId = entry.arguments?.getString("partId").orEmpty()
            CaptureRoute(
                partId = partId,
                baseUrl = baseUrl,
                onDone = { navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }
    }
}
