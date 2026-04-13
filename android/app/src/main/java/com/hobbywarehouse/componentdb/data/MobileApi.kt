package com.hobbywarehouse.componentdb.data

import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface MobileApi {
    @GET("api/mobile/session")
    suspend fun session(): SessionResponse

    @GET("api/mobile/parts/by-number")
    suspend fun partByNumber(@Query("partNumber") partNumber: String): PartEnvelope

    @GET("api/mobile/parts/{id}")
    suspend fun part(@Path("id") id: String): PartEnvelope

    @PATCH("api/mobile/parts/{id}")
    suspend fun patchPart(
        @Path("id") id: String,
        @Body body: PatchQuantityBody,
    ): PartEnvelope

    @Multipart
    @POST("api/mobile/parts/{id}/images")
    suspend fun uploadImages(
        @Path("id") id: String,
        @Part files: List<MultipartBody.Part>,
    ): ImageUploadResponse
}
