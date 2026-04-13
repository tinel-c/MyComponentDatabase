package com.hobbywarehouse.componentdb.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val colors =
    lightColorScheme(
        primary = androidx.compose.ui.graphics.Color(0xFF0F766E),
        secondary = androidx.compose.ui.graphics.Color(0xFF115E59),
        tertiary = androidx.compose.ui.graphics.Color(0xFF134E4A),
    )

@Composable
fun ComponentDbTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        content = content,
    )
}
