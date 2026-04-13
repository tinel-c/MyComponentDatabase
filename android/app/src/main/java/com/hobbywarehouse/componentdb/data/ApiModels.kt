package com.hobbywarehouse.componentdb.data

import kotlinx.serialization.Serializable

@Serializable
data class SessionResponse(
    val ok: Boolean = false,
    val user: SessionUser? = null,
)

@Serializable
data class SessionUser(
    val id: String,
    val email: String? = null,
    val role: String,
    val name: String? = null,
)

@Serializable
data class PartEnvelope(
    val part: MobilePart,
)

@Serializable
data class MobilePart(
    val id: String,
    val partNumber: Int,
    val name: String,
    val quantityOnHand: Int,
    val unit: String,
    val imageUrl: String? = null,
    val images: List<MobilePartImage> = emptyList(),
)

@Serializable
data class MobilePartImage(
    val id: String,
    val url: String,
    val sortOrder: Int,
    val caption: String? = null,
)

@Serializable
data class PatchQuantityBody(
    val quantityOnHand: Int,
)

@Serializable
data class ImageUploadResponse(
    val ok: Boolean = false,
    val images: List<MobilePartImage> = emptyList(),
)

@Serializable
data class ErrorBody(
    val error: String? = null,
)
