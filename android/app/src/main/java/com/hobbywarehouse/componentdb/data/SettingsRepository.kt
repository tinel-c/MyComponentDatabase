package com.hobbywarehouse.componentdb.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "component_db_settings")

class SettingsRepository(private val context: Context) {
    private val baseUrlKey = stringPreferencesKey("base_url")

    val baseUrl: Flow<String> =
        context.dataStore.data.map { prefs ->
            prefs[baseUrlKey] ?: DEFAULT_BASE_URL
        }

    suspend fun setBaseUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[baseUrlKey] = url.trim()
        }
    }

    companion object {
        /** Android emulator → host machine (Next.js default port). */
        const val DEFAULT_BASE_URL: String = "http://10.0.2.2:3000"
    }
}
