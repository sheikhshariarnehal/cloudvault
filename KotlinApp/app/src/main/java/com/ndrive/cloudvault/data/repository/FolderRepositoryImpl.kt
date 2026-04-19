package com.ndrive.cloudvault.data.repository

import com.ndrive.cloudvault.domain.model.DriveFolder
import com.ndrive.cloudvault.domain.repository.FolderRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.postgrest.query.Order
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Singleton
class FolderRepositoryImpl @Inject constructor(
        private val supabaseClient: SupabaseClient
) : FolderRepository {

        override suspend fun getRootFolders(limit: Int): Result<List<DriveFolder>> = runCatching {
                supabaseClient
                        .from("folders")
                        .select(
                                Columns.list(
                                        "id",
                                        "name",
                                        "parent_id",
                                        "updated_at",
                                        "color"
                                )
                        ) {
                                filter {
                                        filter("parent_id", FilterOperator.IS, "null")
                                        eq("is_trashed", false)
                                }
                                order(column = "updated_at", order = Order.DESCENDING)
                                limit(limit.toLong())
                        }
                        .decodeList<FolderRow>()
                        .map { row ->
                                row.toDomain()
                        }
        }

        override suspend fun getFoldersByParentId(parentId: String, limit: Int): Result<List<DriveFolder>> = runCatching {
                supabaseClient
                        .from("folders")
                        .select(
                                Columns.list(
                                        "id",
                                        "name",
                                        "parent_id",
                                        "updated_at",
                                        "color"
                                )
                        ) {
                                filter {
                                        eq("parent_id", parentId)
                                        eq("is_trashed", false)
                                }
                                order(column = "updated_at", order = Order.DESCENDING)
                                limit(limit.toLong())
                        }
                        .decodeList<FolderRow>()
                        .map { row ->
                                row.toDomain()
                        }
        }

        override suspend fun getFolderById(folderId: String): Result<DriveFolder?> = runCatching {
                supabaseClient
                        .from("folders")
                        .select(
                                Columns.list(
                                        "id",
                                        "name",
                                        "parent_id",
                                        "updated_at",
                                        "color"
                                )
                        ) {
                                filter {
                                        eq("id", folderId)
                                        eq("is_trashed", false)
                                }
                                limit(1)
                        }
                        .decodeList<FolderRow>()
                        .firstOrNull()
                        ?.toDomain()
        }

        override suspend fun createFolder(name: String, parentId: String?): Result<DriveFolder> = runCatching {
                val payload = buildJsonObject {
                        put("name", name)
                        if (parentId.isNullOrBlank()) put("parent_id", JsonNull) else put("parent_id", parentId)
                        put("is_trashed", false)
                        put("color", JsonNull)
                }

                supabaseClient
                        .from("folders")
                        .insert(payload) {
                                select(
                                        columns = Columns.list(
                                                "id",
                                                "name",
                                                "parent_id",
                                                "updated_at",
                                                "color"
                                        )
                                )
                        }
                        .decodeSingle<FolderRow>()
                        .toDomain()
        }

        private fun FolderRow.toDomain(): DriveFolder {
                return DriveFolder(
                        id = id,
                        name = name,
                        parentId = parentId,
                        updatedAt = updatedAt,
                        color = color,
                        isStarred = false
                )
        }

        @Serializable
        private data class FolderRow(
                val id: String,
                val name: String,
                @SerialName("parent_id") val parentId: String? = null,
                @SerialName("updated_at") val updatedAt: String? = null,        
                val color: String? = null
        )
}
