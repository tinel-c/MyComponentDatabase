package com.hobbywarehouse.componentdb

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.hobbywarehouse.componentdb.data.SettingsRepository
import com.hobbywarehouse.componentdb.ui.AppNavigation
import com.hobbywarehouse.componentdb.ui.theme.ComponentDbTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val settings = SettingsRepository(applicationContext)
        setContent {
            ComponentDbTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavigation(settings = settings)
                }
            }
        }
    }
}
