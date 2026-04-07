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
                                DriveFolder(
                                        id = row.id,
                                        name = row.name,
                                        parentId = row.parentId,
                                        updatedAt = row.updatedAt,
                                        color = row.color,
                                        isStarred = false
                                )
                        }
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
